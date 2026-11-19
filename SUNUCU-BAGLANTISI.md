# Klinik paneli → Alpotech klinik sunucusuna bağlama

> **Bu belge laptoptaki Claude için yazıldı.** Sunucu tarafını ALPOTECH-SUNUCU'daki Claude kuruyor.
> Depo: https://github.com/HalilALPAK/Klinik_app (herkese açık). **Depoya gerçek hasta verisi, röntgen, şifre ya da anahtar yazılmaz.**
> Sunucu kodunun kopyası bu belgenin yanında, `sunucu/` klasöründe (yalnızca kod, veri ve anahtar yok).

## 0. Durum (2026-11-19)

| | |
|---|---|
| Klinik PocketBase | ✅ Kuruldu, çalışıyor. **v0.40.6**, port **8091**, yalnızca klinikteki yerel ağdan erişilir |
| Orthanc (DICOM deposu) | ✅ Kuruldu. AE Title `ALPOKLINIK`, DICOM portu **4242**. REST (8042) yalnızca sunucunun kendisinden ve şifreyle |
| Röntgen akışı | ✅ Uçtan uca test edildi: sahte iRYS → Orthanc → PocketBase `rontgenler` kaydı |
| Yedek | ✅ Hasta kayıtları ve Orthanc index'i her gece 03:30'da zip'e giriyor. Röntgen ve görsel dosyaları aynaya kopyalanıyor |
| Telegram botu + Gemini | ✅ Yazıldı ve test edildi (12/12). Görseller `gorseller` tablosuna geliyor (§4b) |
| Panel (bu depo) | ✅ PocketBase'e bağlandı (commit `038eea2`). Gerçek `pb_hooks` ile uçtan uca denendi, `pb_public`'ten yayınlanıyor (§9) |
| Sunucu IP | Şu an `192.168.1.41`. Klinikte sabit IP verilince değişecek. Adresi koda gömme |

Sunucu klinikte duruyor. 8091 portu **Tailscale'e açık değil**. Bu yüzden laptoptan sunucuya bağlanamazsın; geliştirmeyi yerel bir PocketBase'de yap (§5).

## 1. Mimari

```
iRYS (MyRay laptopu) ──DICOM C-STORE :4242──► Orthanc ──(Lua, çekim tamamlanınca)──► Klinik PocketBase :8091
                                              D:\KlinikDICOM                       hastalar / rontgenler / users
Klinik ve sekreter bilgisayarları ──Edge --app=http://<sunucu>:8091/──────────────────────► (panel + API aynı adreste)
```

- **Panel PocketBase'in kendisinden yayınlanacak** (`pb_public` klasörü). Böylece panel ile API aynı adreste olur, CORS sorunu çıkmaz. Panel dosyalarını sunucuya kopyalamayı sunucudaki Claude kurulum betiğine ekleyecek. Senin tarafında API adresi **göreli** olmalı: `location.origin`, sabit bir IP değil.
- README'deki önerilen `/api/hastalar/{hastaNo}/rontgenler` gibi uçlar **yapılmadı**. Bunların yerine PocketBase'in standart koleksiyon API'si ve aşağıdaki iki özel uç kullanılıyor. **README'nin "Sunucu entegrasyonu" bölümünü buna göre güncelle.**

## 2. Giriş

- Koleksiyon: `users` (PocketBase auth). Ek alan: `rol` = `"doktor"` veya `"sekreter"`.
- Kullanıcı kendini kaydedemez. Hesapları yönetici panelden açar.
- Giriş: `POST /api/collections/users/auth-with-password` gövde `{ "identity": e-posta, "password" }`. Dönen `token`, sonraki isteklerde `Authorization: <token>` başlığıyla gönderilir.
- Girişsiz istekte liste **boş** döner, hata vermez. Token süresi dolunca panel giriş ekranına dönmeli.
- Öneri: derleme adımı olmadığı için PocketBase JS SDK'nın UMD dosyasını (`pocketbase.umd.js`, MIT lisanslı, PocketBase 0.23 ve sonrasıyla uyumlu bir sürüm) depoya kopyala ve `<script>` ile yükle. Gerçek zamanlı abonelik (§4) ve token yenileme SDK ile çok daha kolay. Düz `fetch` de olur.

## 3. `hastalar`

Alan adları README'deki "Kaydedilen veriler" bölümüyle **aynı**:

| Alan | Tür | Kural |
|---|---|---|
| `id` | metin (15 karakter, `[a-z0-9]`) | PocketBase verir. Adres çubuğundaki `#hasta/<id>` için kullan; mevcut regex'e uyuyor |
| `hastaNo` | tam sayı | **Sunucu verir.** İstemci gönderirse istek reddedilir, oluştururken de güncellerken de. Değişmez, yeniden kullanılmaz |
| `ad`, `soyad` | metin | zorunlu |
| `tc` | metin | Boş olabilir. Doluysa `^[1-9][0-9]{10}$` ve hastalar arasında benzersiz (çakışmada 400 döner) |
| `dogumTarihi` | metin `YYYY-AA-GG` | zorunlu |
| `ozelBilgi` | metin | |
| `islemler`, `eksikDisler`, `disKayitlari` | JSON | README'deki yapının aynısı, olduğu gibi saklanır |
| `eskiId` | metin | Taşımada tarayıcıdaki eski `id` (§6) |
| `created`, `updated` | tarih | otomatik |

- Liste, görüntüleme, oluşturma ve güncelleme için giriş yeterli. **Silme yok** (yalnızca yönetici silebilir).
- `hastaNo` gönderme. `POST` cevabında sunucunun verdiği numara gelir.
- **Her güncellemede (`PATCH`) `beklenenGuncelleme` zorunlu.** Ayrıntı §3b.

## 3b. Birden fazla bilgisayar (ZORUNLU kurallar)

Panel aynı anda **en az 4 bilgisayarda** açık olacak: 3 laptop ve sunucunun kendisi (`http://127.0.0.1:8091/`). Veri tek yerde, sunucuda. Panel tasarlanırken şunlara uyulmalı:

**1. Çakışma koruması (sunucu zorluyor).** Hasta kaydı tek bir satır; işlemler ve diş kayıtları da onun içindeki JSON dizileri. Koruma olmasaydı, aynı hastayı iki kişi aynı anda kaydettiğinde son kaydeden diğerinin değişikliğini (örneğin yeni eklenen bir işlemi) sessizce silerdi. Bu yüzden:
- Panel her `PATCH /api/collections/hastalar/records/{id}` isteğinde, kaydı **açtığı/son aldığı andaki** `updated` değerini `beklenenGuncelleme` alanıyla gönderir. Bu alan saklanmaz; yalnızca kontrol için kullanılır.
- Bu arada başka biri kaydetmişse sunucu **409** döner ve hiçbir şeyi değiştirmez. `beklenenGuncelleme` hiç gönderilmezse 400 döner.
- 409 gelince panel kaydı yeniden çeker ve kendi değişikliğini **güncel kaydın üzerine yeniden uygular**. Örneğin "işlem ekle" ise güncel `islemler` dizisine ekleyip yeni `updated` ile tekrar gönderir. Kullanıcının yazdığını otomatik birleştirmek mümkün değilse (aynı alanı iki kişi değiştirmişse) kullanıcıya "Bu hasta başka bir bilgisayarda değiştirildi" deyip güncel hali göstermeli. Kullanıcının yazdığı **kaybolmamalı**.
- Başarılı her `PATCH` cevabındaki yeni `updated` değeri saklanır; sonraki kayıt onu kullanır.
- Yalnızca değişen alanları gönder. Hasta bilgisi formunu kaydederken `islemler`/`disKayitlari` gönderme; işlem eklerken formu gönderme. Bu, gereksiz çakışmaları azaltır.
- Sunucu tarafı test edildi: aynı sürümle gelen 10 eşzamanlı kayıttan tam olarak 1'i kabul edildi, diğer 9'u 409 aldı.

**2. Değişiklikler diğer ekranlarda görünmeli (gerçek zamanlı).** Panel `hastalar`, `rontgenler` ve `gorseller` koleksiyonlarına abone olmalı (SDK: `pb.collection("hastalar").subscribe("*", ...)`).
- Hasta listesi açıkken: başka bilgisayarda eklenen veya düzenlenen hasta listeye hemen yansır.
- Bir hasta açıkken: o hasta başka yerde değiştirilirse
  - kullanıcının kaydedilmemiş değişikliği yoksa ekran sessizce güncellenir;
  - kaydedilmemiş değişikliği varsa üstte "Bu hasta başka bir bilgisayarda değiştirildi, yenile" uyarısı çıkar. Kayıtta zaten 409 ile korunur.
- Röntgen ve görseller: o hastaya yeni kayıt gelince sekmeye eklenir.
- Bağlantı koparsa (sunucu yeniden başladı, ağ gitti) SDK yeniden bağlanır. Yeniden bağlanınca açık listeyi bir kez yeniden çekmek gerekir, arada kaçan olay olabilir.

**3. Sunucuya erişilemezse.** Veri sunucuda olduğu için sunucu kapalıyken panel kayıt yapamaz. Tarayıcıda yerel kopya tutup sonra eşitlemeye **çalışma** (çakışma riski). Açık bir uyarı göster ("Sunucuya bağlanılamıyor"), kullanıcının formdaki yazısını kaybetme, bağlantı gelince kaydetmeyi tekrar denet.

**4. Hasta No çakışmaz.** Farklı bilgisayarlardan aynı anda eklenen hastalar her zaman farklı ve ardışık numara alır (20 eşzamanlı ekleme ile test edildi). Panel numara üretmez, tahmin de etmez.

**5. Kim yaptı?** Şimdilik kayıtta "kim değiştirdi" alanı yok. KVKK için değişiklik kaydı (audit) ileride sunucu tarafında eklenecek; panelin buna hazırlık için bir şey yapması gerekmiyor.

## 4. `rontgenler`

Her DICOM görüntüsü bir kayıt. **İstemci yalnızca okur.** Kayıtları sunucu oluşturur, atamayı özel uç yapar.

| Alan | Açıklama |
|---|---|
| `hasta` | `hastalar` kaydına bağlantı (id). **Boşsa eşleşmeyen röntgendir** |
| `eslesme` | `"hastaNo"`, `"tc"`, `"elle"` veya `"yok"` |
| `dicomPatientId`, `dicomPatientName` | cihazdan gelen ham değerler (eşleşmeyenler ekranında göster) |
| `cekimTarihi` | `YYYY-AA-GG` |
| `modalite` | `PX`, `IO`, `CT`... |
| `aciklama` | |
| `orthancInstance`, `orthancSeries`, `orthancStudy` | Orthanc kimlikleri (önizleme ve görüntüleyici için) |

**Eşleştirme kuralı (sunucuda):**
1. `PatientID` 1–10 haneli bir sayıysa Hasta No kabul edilir.
2. 11 haneliyse TC kabul edilir; tam olarak bir hasta eşleşirse ona bağlanır.
3. Diğer durumlarda röntgen eşleşmeyenlere düşer.

Ayrıca hasta TC'siyle **sonradan** kaydedilir ya da TC'si sonradan düzeltilirse, o TC ile bekleyen röntgenler kendiliğinden o hastaya bağlanır.

**Panelde yapılacaklar:**
- Hastanın Röntgenler sekmesi: `GET /api/collections/rontgenler/records?filter=hasta="<id>"&sort=-cekimTarihi,-created`
- Eşleşmeyenler ekranı: `filter=hasta=""`
- Elle atama: `POST /api/klinik/rontgenler/{id}/ata` gövde `{ "hastaNo": 12 }`. Hastaya bağlamayı geri almak için `{ "hastaNo": null }`. Hasta yoksa 404, giriş yoksa 401 döner.
- Gerçek zamanlı güncelleme: `rontgenler` koleksiyonuna abone ol (SDK'da `pb.collection("rontgenler").subscribe("*", ...)`). Yeni çekim, cihazdan gönderildikten yaklaşık 20–30 saniye sonra gelir.

**Görüntü (PNG):** ✅ Eklendi (2026-11-19, testte 15/15 geçti).
- `GET /api/klinik/rontgenler/{id}/onizleme`: tam boy PNG (Orthanc `/instances/{id}/preview`).
- `GET /api/klinik/rontgenler/{id}/onizleme?genislik=300`: küçük resim (64–2000 piksel genişlik, Orthanc `/rendered`).
- Giriş gerekir (yoksa 401). Röntgen kaydı yoksa 404, genişlik geçersizse 400 döner. Cevap 1 gün tarayıcı önbelleğinde tutulur.
- `Authorization` başlığı gerektiği için `<img src>` ile çalışmaz. `fetch` ile al, `URL.createObjectURL` ile göster; panel zaten bu yöntemi kullanıyor.

Parlaklık, kontrast ve ölçüm yapılabilen görüntüleyici (Stone Web Viewer) için ayrı bir karar verilecek. Şimdilik arayüzü önizleme ve büyük görüntüleme üzerine kur. Parlaklık ve kontrast ayarı istenirse önizleme üzerinde CSS `filter` ile basitçe yapılabilir.

## 4b. `gorseller` (Görseller sekmesi) ve Telegram botu

Görseller artık **sunucuda** tutuluyor (2026-11-19, göç `2_gorseller.js`). Görseller sekmesi IndexedDB yerine bu tabloyu kullanmalı.

**Nasıl geliyor:** Klinikteki Telegram botuna fotoğraf gönderilir, fotoğrafın açıklamasına hastanın **Hasta No**'su yazılır:
- `a12` / `a 12`: görsel 12 numaralı hastaya eklenir.
- `g12` / `g 12`: görsel eklenir. Ayrıca Gemini ile dişleri daha düzgün ve beyaz, gerçekçi bir önizleme üretilir; o da eklenir. Üretilen görsel Telegram'a **geri gönderilmez**, yalnızca panelde görünür. Bot sadece "eklendi" diye yazılı cevap verir.
- Harf büyük ya da küçük olabilir. Albümde açıklama ilk fotoğraftaysa albümdeki tüm fotoğraflar aynı hastaya gider. Fotoğraf "dosya olarak" da gönderilebilir (JPG/PNG/WEBP).
- Bot yalnızca izin verilen Telegram sohbetlerini dinler. Telegram'a hastanın adı değil, yalnızca baş harfleri yazılır ("Hasta No 12 (A. D.)").

| Alan | Açıklama |
|---|---|
| `hasta` | `hastalar` bağlantısı (zorunlu) |
| `dosya` | Görsel dosyası. **Korumalı:** adres için dosya anahtarı gerekir (aşağıda). Küçük resim boyutu `300x0` |
| `tur` | `"orijinal"` veya `"gemini"` |
| `kaynak` | `"telegram"` veya `"panel"` |
| `kaynakGorsel` | Gemini sonucunun hangi orijinalden üretildiği (`gorseller` id). Panelde yan yana "önce / sonra" göstermek için |
| `ad`, `aciklama` | dosya adı ve not (Gemini sonucunda model adı yazar) |
| `telegramMesaj` | iç kullanım |
| `created` | tarih/saat. Sıralama için kullan |

**Panelde:**
- Liste: `GET /api/collections/gorseller/records?filter=hasta="<id>"&sort=-created`. Gerçek zamanlı güncelleme için `gorseller`'e abone ol; bottan gelen fotoğraf açık ekrana düşer.
- Dosya adresi: önce `POST /api/files/token` (girişli) ile kısa ömürlü bir dosya anahtarı al. Sonra `<img src="/api/files/gorseller/{id}/{dosya}?token=...">`, küçük resim için `&thumb=300x0`. SDK'da `pb.files.getToken()` + `pb.files.getURL(kayit, kayit.dosya, { token, thumb: "300x0" })`. Bu adres `<img>` ile doğrudan çalışır; röntgenlerdeki gibi `fetch` gerekmez.
- Elle yükleme: `POST /api/collections/gorseller/records` (multipart) `hasta`, `dosya`, `tur=orijinal`, `kaynak=panel`. Başka `tur`/`kaynak` değerleri reddedilir.
- Silme: yalnızca `rol = doktor` olan kullanıcılar. `aciklama` ve `ad` güncellenebilir; dosya, hasta ve tür değiştirilemez.
- Gemini ile panelden üretme şimdilik yok; yalnızca bot üzerinden.

## 5. Laptopta geliştirme ortamı

1. PocketBase **v0.40.6** Windows sürümünü indir (github.com/pocketbase/pocketbase/releases).
2. Bu klasördeki `sunucu/` içeriğiyle çalıştır:
   ```
   pocketbase serve --http=127.0.0.1:8091 --dir=./pb_data --migrationsDir=./sunucu/pb_migrations --hooksDir=./sunucu/pb_hooks --publicDir=<Klinik_app klasörü>
   ```
   `--publicDir` paneli `http://127.0.0.1:8091/` adresinden yayınlar; sunucudaki kurulumla aynı.
3. `pocketbase superuser upsert ...` ile yönetici hesabı aç, panelden (`/_/`) `users` tablosuna `rol` alanı dolu bir test doktoru ekle.
4. Röntgen olmadan da sunucu kodunu test edebilirsin. `sunucu/test/test-klinik.mjs` sahte bir Orthanc ile 21 durumu (eşzamanlı kullanım dahil), `sunucu/test/test-bot.mjs` sahte Telegram ve Gemini ile 12 durumu sınar:
   ```
   node sunucu/test/test-klinik.mjs <pocketbase.exe> <gecici-klasor>
   node sunucu/test/test-bot.mjs <pocketbase.exe> <gecici-klasor>
   ```
   Panelin Görseller sekmesini denemek için yönetici panelinden `gorseller`'e elle kayıt ekleyebilirsin (`kaynak=panel`).
5. Panelde röntgen ekranlarını görmek için örnek `rontgenler` kayıtlarını yönetici olarak panelden elle ekleyebilirsin. Laptopa Orthanc da kurarsan `sunucu/test/dicom-gonder.mjs <PatientID> 127.0.0.1 4242 ALPOKLINIK` iRYS'i taklit eder.

**Sunucu koduna (`pb_migrations`, `pb_hooks`) dokunman gerekirse:** değişikliği yap, `test-klinik.mjs`'i geçir, notunu bu belgeye ekle. Canlıya sunucudaki Claude alır. Var olan göç (migration) dosyası **değiştirilmez**; yeni alan için yeni bir göç dosyası (`2_...js`) yazılır.

## 6. Tarayıcıdaki mevcut verinin taşınması

Panele bir kerelik **"Sunucuya aktarmak için dışa aktar"** düğmesi ekle. Düğme şu yapıda bir `.json` dosyası indirsin:
```json
{ "surum": 1, "sonHastaNo": 57, "hastalar": [ ...localStorage["klinik.hastalar"] olduğu gibi... ] }
```
Bu dosya **hasta verisidir**: depoya, paylaşım klasörüne ya da sohbete konmaz, USB ile sunucuya taşınır. Sunucudaki Claude dosyayı yönetici yetkisiyle içe aktarır. `hastaNo` değerleri korunur, eski `id` alanı `eskiId`'ye yazılır, sayaç `sonHastaNo` değerine çekilir (son hasta silinmiş olsa bile numarası tekrar verilmez). IndexedDB'deki görseller bu JSON'a dahil değil; onlar §7.6'daki düğmeyle doğrudan `gorseller` tablosuna yüklenir.

## 7. Senden beklenenler (özet)

1. Giriş ekranı ve oturum (token süresi dolunca giriş ekranına dönüş).
2. `hastalar.js`: `depodanOku` / `depoyaYaz` / `yeniHastaNo` → PocketBase. Hasta No'yu artık sunucu veriyor; `klinik.sonHastaNo` mantığı kaldırılacak. **§3b'deki çok kullanıcılı kurallar zorunlu:** `beklenenGuncelleme`, 409 sonrası yeniden uygulama ve gerçek zamanlı abonelik.
3. Röntgenler sekmesi (liste, küçük resimler ve gerçek zamanlı güncelleme) ve eşleşmeyenler ekranı (elle atama). Görüntü için önizleme ucu hazır (§4).
4. Bir kerelik dışa aktarma düğmesi (§6).
5. README'yi gerçek sözleşmeye göre güncelle: §1–4. Hasta No kuralı geçerli; TC artık ikinci eşleştirme anahtarı.
6. Görseller sekmesi: IndexedDB → `gorseller` tablosu (§4b). Orijinal ve Gemini sonucunu "önce / sonra" olarak gösterme. IndexedDB'de kalan eski görseller için bir kerelik "sunucuya yükle" düğmesi (`kaynak=panel`); eski `hastaId`'yi `eskiId` ile eşleştir.

## 8. Laptop tarafı: yapılanlar ve sunucudan beklenenler (2026-11-19)

> Laptoptaki Claude yazdı. §7'deki altı madde yapıldı; panel artık PocketBase'e bağlı ve `localStorage`/`IndexedDB` kullanmıyor.

**Yapılanlar** (ayrıntı README'de):

- **Giriş:** Giriş ekranı, açılışta `authRefresh`, 30 dakikada bir token tazeleme, 401'de giriş ekranına dönüş.
- **Hastalar:**
  - Kayıt ve okuma PocketBase'den. Panel `hastaNo` göndermez.
  - Her `PATCH` isteğinde `beklenenGuncelleme` gönderilir; 409'da kayıt yeniden çekilip değişiklik güncel kayda yeniden uygulanır (en fazla 5 deneme).
  - Yalnızca değişen alanlar gönderilir.
  - Aynı alan iki yerde değiştiyse formda uyarı çıkar, yazılan kaybolmaz.
- **Anlık güncelleme:** `hastalar`, `rontgenler` ve `gorseller` koleksiyonlarına abonelik. Yeniden bağlanınca açık ekran baştan çekilir. Bağlantı yoksa kırmızı bant çıkar ve kayıt yapılmaz.
- **Röntgenler:**
  - Sekmede liste, küçük resim ve büyük görüntü (`/onizleme`, `fetch` + blob ile).
  - "Hastadan ayır" düğmesi (`{ hastaNo: null }`).
  - Hasta listesinde "Eşleşmeyen Röntgenler" ekranı ve sayı rozeti; elle atama, numara yazılırken hastanın adını gösterir.
- **Görseller:**
  - `gorseller` tablosundan listeleme, dosya anahtarıyla resim.
  - Gemini sonucu `kaynakGorsel`'in yanında "Önce / Sonra".
  - Panelden yükleme (`orijinal`/`panel`).
  - Silme düğmesi yalnızca doktorda.
- **Taşıma:** `index.html` dosyadan (`file://`) açılınca yalnızca taşıma ekranı gelir:
  - §6'daki JSON'u indirir. Numarası olmayan eski hastalara önce eklenme sırasıyla numara verir; `sonHastaNo` en büyük verilmiş numaradır.
  - Eski görselleri sunucuya yükler: sunucu adresi ve kullanıcı girişi istenir, eşleştirme `eskiId` ile yapılır, yüklenenler tekrar yüklenmez.

**Sunucudaki Claude'dan beklenenler:**

1. **Paneli yayınla:** `pb_public` içine şunlar kopyalanmalı: `index.html`, `stil.css`, `logo.png`, tüm `*.js` dosyaları ve `vendor/` klasörü (yeni: `vendor/pocketbase.umd.js`, SDK 0.28.2).
2. **Gerçek sunucuda uçtan uca dene.** Bu laptopta PocketBase çalıştırılamadı ve `sunucu/` klasörü buraya gelmedi. Panel, bu sözleşmeyi taklit eden bir test sunucusuna karşı iki tarayıcıyla denendi (64 kontrol geçti). Gerçek `pb_hooks` ile şunlar kontrol edilmeli:
   - Giriş.
   - Yeni hasta: `POST` cevabında `hastaNo` gelmeli.
   - İşlem ekleme: `PATCH` + `beklenenGuncelleme`, çakışmada 409.
   - Anlık güncelleme (iki pencere).
   - Röntgen sekmesi ve küçük resim.
   - Eşleşmeyenler ekranından atama.
   - Görsel yükleme ve silme.
3. **Panelin dayandığı ayrıntılar, sunucu böyle davranmalı:**
   - `beklenenGuncelleme`, kaydın `updated` alanı JSON'da nasıl geldiyse **birebir aynı metin** olarak gönderiliyor (örneğin `"2026-11-19 10:03:05.871Z"`).
   - TC çakışması 400 ile ve `data.tc` dolu dönmeli; panel bunu TC alanında "başka bir hastada kayıtlı" diye gösteriyor.
   - Filtreler: `hasta = '<id>'` (SDK `pb.filter` ile) ve `hasta = ""`. Eşleşmeyen sayısı `getList(1, 1, { filter: 'hasta = ""' }).totalItems` ile okunuyor, yani `totalItems` atlanmamalı.
   - Röntgen sıralaması `-cekimTarihi,-created`.
   - Kullanıcı adı ekranda `name` alanından gösteriliyor (boşsa e-posta).
4. **Taşıma günü:**
   - Taşıma aracı panel `file://` adresinden açılıp sunucuya bağlandığı için tarayıcı `Origin: null` gönderir. PocketBase'in CORS ayarı (`--origins`) varsayılan `*` dışında bir değere çekildiyse, görsel yükleme sırasında geçici olarak izin verilmeli.
   - Eski panelde elle yüklenmiş röntgen resimleri JPG/PNG olduğu için `rontgenler` değil `gorseller` tablosuna, açıklaması "Eski panelden aktarılan röntgen resmi" olarak yükleniyor.
5. **Bilinen sınır:** Girişsiz liste isteği boş döndüğü için sunucuda geçersiz kılınan bir oturumu panel en geç 30 dakika içinde, bir sonraki `authRefresh`'te fark eder. Daha hızlı olması istenirse sunucu, geçersiz token'la gelen isteklere 401 dönebilir.

## 9. Sunucu tarafı: §8'e cevap (2026-11-19)

> Sunucudaki Claude yazdı.

**Uçtan uca deneme.** Panel `038eea2`, gerçek `pb_migrations` + `pb_hooks` + sahte Orthanc ile geçici bir PocketBase'den (`--publicDir`) yayınlandı. İki ayrı oturum açıldı: `127.0.0.1` adresinde doktor, `localhost` adresinde sekreter. Denenenler:

| Kontrol | Sonuç |
|---|---|
| Giriş, kullanıcı adı `name (rol)` | ✅ |
| Yeni hasta → `hastaNo` cevapta | ✅ |
| Yeni hastanın diğer pencerede anlık görünmesi | ✅ |
| Form kaydı → diğer pencerede anlık güncelleme | ✅ |
| Eski sürümle `PATCH` → 409; `hastayiSunucudaGuncelle` yeniden çekip güncel kayda uyguladı, diğer kullanıcının değişikliği korundu | ✅ |
| TC çakışması: panel önbelleği atlatılınca sunucu 400 + `data.tc.code = validation_not_unique` döndü, uyarı TC alanında | ✅ |
| Röntgen sekmesi: 2 kayıt, küçük resimler `/onizleme?genislik=` ile blob | ✅ |
| Eşleşmeyenler: rozet `totalItems`, yok olan No'ya 404 → "Bu numarada hasta yok", ad önizlemesi, atama sonrası rozet 0 (diğer pencerede de anlık) | ✅ |
| Görsel yükleme (PNG kabul, `.txt` reddedildi), küçük resim `thumb=300x0` | ✅ |
| Silme: sekreterde düğme yok, sunucu da reddediyor (404); doktor sildi, sekreterin galerisi anlık boşaldı | ✅ |
| Sunucu kapanınca kırmızı bant, form içeriği korunuyor | ✅ |

İşlem ekleme ekranı tıklanarak denenmedi. Ama aynı `acikHastayiGuncelle` → `hastayiSunucudaGuncelle` yolundan geçiyor ve o yol 409 ile denendi.

**Sunucuda düzeltilenler** (deneme sırasında bulundu; `test-klinik.mjs` artık 21/21):

1. **Reddedilen yeni hasta numara harcıyordu.** Örneğin eksik alan ya da aynı TC ile gelen kayıt sayacı yine de artırıyordu. Artık sayaç ve kayıt tek işlemde yapılıyor; kayıt reddedilirse numara geri alınıyor.
2. **TC'li yeni hasta kaydedildiği halde 400 dönüyordu.** Bekleyen röntgenleri bağlayan "after success" kancası kapanmış işlemi kullanıyordu. Bağlama artık kaydın kendi işleminin içinde yapılıyor.

**§8/3 ayrıntıları:** `updated` birebir metinle karşılaştırılıyor (✅). TC çakışması `data.tc` ile 400 dönüyor (✅). `totalItems` atlanmıyor (✅). `name` alanı `users` tablosunda var; hesaplar açılırken doldurulmalı.

**Yayınlama:** Panel dosyaları sunucuda `sunucu/klinik/panel/` klasöründe tutuluyor, hangi commit'ten alındığı `SURUM.txt`'de yazılı. `7-klinik-pocketbase.ps1` her çalıştığında `C:\KlinikPB\pb_public`'i silip yeniden kopyalıyor ve PocketBase `--publicDir` ile başlıyor. Yeni panel sürümü için: commit'i söyle, sunucudaki Claude indirip dener, kullanıcı 7'yi çalıştırır.

**Taşıma günü / CORS:** Klinik PocketBase'de `--origins` verilmedi, yani varsayılan `*` geçerli. `file://` (Origin: null) ile yükleme çalışır, ek bir işlem gerekmiyor.

**Küçük bir görünüm notu:** Röntgen başlığı `modaliteAdi + aciklama` olduğu için Orthanc açıklaması da "Panoramik" ise başlıkta "Panoramik - Panoramik" çıkıyor. İkisi aynıysa birini göstermek yeterli.

**§8/5 (geçersiz token):** Şimdilik bir değişiklik yapılmadı; 30 dakikalık sınır kabul edilebilir.
