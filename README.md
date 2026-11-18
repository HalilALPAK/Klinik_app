# Alpotech Klinik Paneli

Diş kliniği için hasta takip paneli:
- hasta listesi,
- FDI numaralı diş paneli,
- işlem tabloları,
- diş üzeri kayıtlar (işlem, hastalık, kanal tedavisi, implant),
- sunucudan gelen röntgen ve görseller.

Bu dosya projeye katılan geliştiriciler ve **sunucudaki Claude** için yazıldı.

- Sunucu ile panel arasındaki ayrıntılı sözleşme [SUNUCU-BAGLANTISI.md](SUNUCU-BAGLANTISI.md) dosyasındadır. İkisi çelişirse o belge geçerlidir; bir taraf değişirse ikisi de güncellenir.
- Bu README, panelin o sözleşmeyi nasıl kullandığını anlatır.

## Mimari

```
iRYS (MyRay laptopu) ──DICOM :4242──► Orthanc ──► Klinik PocketBase :8091 ◄── Telegram botu (+ Gemini)
                                                   hastalar / rontgenler / gorseller / users
Klinik ve sekreter bilgisayarları ──Edge --app=http://<sunucu>:8091/──► panel (pb_public) + API
```

- **Sunucu tarafı:** Panel, klinik sunucusundaki PocketBase'in kendisinden yayınlanır (`pb_public` ya da `--publicDir`). Panel ile API aynı adrestedir; panelde sunucu adresi yazmaz, `location.origin` kullanılır.
- **Veri:** Hastalar, işlemler, diş kayıtları, röntgenler ve görseller **yalnızca sunucuda** durur. Tarayıcıda kalıcı veri tutulmaz; yalnızca giriş anahtarı (PocketBase `authStore`) saklanır.
- **Aynı anda kullanım:** Panel aynı anda en az 4 bilgisayarda açık olabilir. Çakışma koruması ve anlık güncelleme zorunludur (aşağıda).
- **Sunucu kapalıysa:** Panel kayıt yapamaz. Kırmızı "Sunucuya bağlanılamıyor" bandı çıkar, kullanıcının yazdığı formda kalır, bağlantı gelince tekrar kaydedilir. Tarayıcıda yerel kopya tutulmaz.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html` | Tüm ekranlar: giriş, taşıma, hasta listesi, eşleşmeyen röntgenler, hasta sayfası, pencereler |
| `stil.css` | Görünüm |
| `vendor/pocketbase.umd.js` | PocketBase JS SDK 0.28.2 (MIT, lisans `vendor/pocketbase-LICENSE.md`). Derleme adımı olmadığı için depoda |
| `sunucu.js` | SDK istemcisi, oturum, bağlantı bandı, hata yönetimi, anlık abonelik |
| `hastalar.js` | Giriş, hasta listesi, yeni hasta, hasta bilgisi formu, çakışma korumalı güncelleme (`hastayiSunucudaGuncelle`), yönlendirme. Sayfayı başlatan dosya |
| `dis_paneli.js` | SVG diş paneli: 32 diş (FDI 11–48), seçim, çene düğmeleri, eksik diş, kanal rengi, implant vidası, işaretler |
| `islemler.js` | Yapılacak / Yapılan İşlemler tabloları |
| `dis_kayitlari.js` | Dişe sağ tık menüsü, diş üzeri kayıtlar, yazdıkça gelen öneriler |
| `gorseller.js` | Sekmeler, Röntgenler, Görseller (önce / sonra), Eşleşmeyen Röntgenler, büyük görüntüleyici |
| `tasima.js` | Eski tarayıcı verisini sunucuya taşıma ekranı (yalnızca `file://` ile açılınca) |
| `logo.png` | Alpotech logosu |
| `kullanim_videosu.mp4` | Eski tanıtım videosu. Sunucu sürümünden, kanal/implant/sekmelerden ve Hasta No'dan önce çekildi |

Betikler `index.html` sonunda şu sırayla yüklenir ve ortak üst düzey isimleri paylaşır:

`vendor/pocketbase.umd.js`, `sunucu.js`, `dis_paneli.js`, `islemler.js`, `dis_kayitlari.js`, `gorseller.js`, `tasima.js`, `hastalar.js`

## Giriş

- **Kullanıcılar:** PocketBase `users` koleksiyonu; `rol` alanı `"doktor"` ya da `"sekreter"`. Hesapları yönetici açar, kendi kendine kayıt yoktur.
- **Oturum açma:** Panel `authWithPassword` ile girer, açılışta `authRefresh` yapar ve açık kaldığı sürece token'ı 30 dakikada bir tazeler.
- **Giriş ekranına dönüş:** Token süresi dolunca ya da sunucu 401 dönünce panel giriş ekranına döner. Tekrar girişte kaldığı sayfaya geri gelir.
- **Görünür olmayan geçersiz oturum:** Girişsiz liste isteği hata vermeden boş döndüğü için, sunucuda geçersiz kılınan bir oturumu panel ancak bir sonraki tazelemede (en geç 30 dakika) fark eder.
- **Rol farkı:** Görsel silme düğmesi yalnızca `rol = doktor` kullanıcılarda görünür; sunucu da bunu zorlar.

## Hasta No kuralı

- **Sunucu verir:** Her hastanın **Hasta No**'sunu sunucu verir. 1'den başlar, artar; değişmez ve asla yeniden kullanılmaz.
- **Panel göndermez:** Panel numara üretmez, tahmin etmez ve `hastaNo` alanını hiçbir istekte göndermez (gönderirse sunucu reddeder). Yeni hasta kaydedilince numara `POST` cevabından okunur.
- **Görünüm:** Numara hasta listesinin ilk sütununda ve hasta sayfasında ("Hasta No: 12") görünür. Arama kutusu numarayla da arar.
- **Röntgen eşleştirme:** Röntgen hastaya önce **Hasta No** ile bağlanır; TC ikinci eşleştirme anahtarıdır. Kural sunucudadır (SUNUCU-BAGLANTISI.md §4):
  - DICOM `PatientID` 1–10 haneliyse Hasta No sayılır.
  - 11 haneliyse TC sayılır.
  - Diğer durumlarda röntgen eşleşmeyenlere düşer.
- **İç id:** Uygulamanın `id` alanı (PocketBase kayıt kimliği, adres çubuğunda `#hasta/<id>`) yalnızca iç kullanım içindir.

## Veriler

### `hastalar`

```json
{
  "id": "k3m9x2a7f0q1zt8",
  "hastaNo": 12,
  "ad": "Ayşe",
  "soyad": "Demir",
  "tc": "12345678901",
  "dogumTarihi": "1985-04-12",
  "ozelBilgi": "Penisilin alerjisi",
  "islemler": [],
  "eksikDisler": [],
  "disKayitlari": [],
  "eskiId": "",
  "created": "2026-11-19 09:12:44.120Z",
  "updated": "2026-11-19 10:03:05.871Z"
}
```

| Alan | Tür | Açıklama |
|---|---|---|
| `id` | metin | PocketBase verir, değişmez |
| `hastaNo` | tam sayı | Sunucu verir, bkz. [Hasta No kuralı](#hasta-no-kuralı) |
| `ad`, `soyad` | metin | Zorunlu |
| `tc` | metin | Sunucuda boş olabilir; doluysa 11 hane, 0 ile başlamaz, benzersiz. Panel formu TC'yi zorunlu tutar |
| `dogumTarihi` | metin `YYYY-AA-GG` | Zorunlu. Yaş saklanmaz, bu alandan hesaplanır |
| `ozelBilgi` | metin | Alerji, kronik hastalık, kullandığı ilaçlar vb. |
| `islemler` | JSON dizi | Yapılacak ve yapılan işlemler, aşağıda |
| `eksikDisler` | JSON dizi | Hastada olmayan dişlerin FDI numaraları |
| `disKayitlari` | JSON dizi | Dişe sağ tıkla eklenen kayıtlar, aşağıda |
| `eskiId` | metin | Taşımada tarayıcıdaki eski `id` |

Panel JSON alanları `null` gelirse boş dizi kabul eder.

**İşlem** (`islemler[]`):

```json
{ "id": "mhx3m1c2ab12cd", "tedavi": "Kompozit Dolgu", "disler": [24, 25], "acil": true,
  "doktor": "Dt. Elif Arslan", "not": "İki yüzlü", "yapildi": false, "yapilmaTarihi": null }
```

- Sıra numarası (1, 2, 3...) saklanmaz; dizideki konumdan hesaplanır.
- Tik işaretlenince `yapildi: true` olur ve `yapilmaTarihi` o günün `YYYY-AA-GG` tarihini alır.
- `tedavi` ve `doktor` zorunlu, `disler` boş olabilir.

**Diş kaydı** (`disKayitlari[]`):

```json
{ "id": "mhx3n8d4ef56gh", "dis": 26, "tur": "islem", "ad": "Kanal Tedavisi" }
```

- `tur` değeri `"islem"` ya da `"hastalik"` olabilir.
- Türü `islem` ve adında "kanal" geçen kayıt, dişin kanallarını turuncu gösterir.
- Türü `islem` ve adında "implant" geçen kayıt, diş yerine vida çizer; böyle bir diş `eksikDisler`'de olsa da eksik sayılmaz.
- Eşleşme Türkçe küçük harfle yapılır ve `ı` harfi `i` sayılır.
- Yazarken çıkan öneriler tüm hastaların kayıt adlarından üretilir, ayrıca saklanmaz.

### `rontgenler` (panel yalnızca okur)

| Panelin kullandığı | Nasıl |
|---|---|
| Hastanın röntgenleri | `filter: hasta = '<id>'`, `sort: -cekimTarihi,-created` |
| Eşleşmeyenler | `filter: hasta = ""` (listede sayısı rozet olarak görünür) |
| Küçük resim / büyük görüntü | `GET /api/klinik/rontgenler/{id}/onizleme?genislik=300` ve parametresiz hali. `Authorization` gerektiği için `fetch` + `URL.createObjectURL` |
| Elle atama | `POST /api/klinik/rontgenler/{id}/ata` `{ "hastaNo": 12 }`. Röntgen sekmesindeki "hastadan ayır" düğmesi `{ "hastaNo": null }` gönderir |
| Gösterilen bilgiler | `modalite` (PX → Panoramik, IO → Ağız içi, CT → Tomografi), `cekimTarihi`, `aciklama`; eşleşmeyenlerde ayrıca `dicomPatientId`, `dicomPatientName` |

### `gorseller`

| Panelin kullandığı | Nasıl |
|---|---|
| Liste | `filter: hasta = '<id>'`, `sort: -created` |
| Resim adresi | `pb.files.getToken()` + `pb.files.getURL(kayit, kayit.dosya, { token, thumb: "300x0" })` |
| Önce / sonra | `tur = "gemini"` olan kayıt, `kaynakGorsel`'deki orijinalin yanında "Önce / Sonra" olarak gösterilir |
| Elle yükleme | multipart `hasta`, `dosya`, `tur=orijinal`, `kaynak=panel`, `ad`. Tarayıcının açamadığı biçimler (DICOM, TIFF) yüklenmeden reddedilir |
| Silme | Yalnızca doktor. Önce/sonra çifti birlikte silinir |

Görseller klinikteki Telegram botundan da gelir; ayrıntılar SUNUCU-BAGLANTISI.md §4b'de.

### Diş numaralama

FDI sistemi kullanılır:

| Bölge | Dişler |
|---|---|
| Sağ üst | 18 → 11 |
| Sol üst | 21 → 28 |
| Sol alt | 31 → 38 |
| Sağ alt | 48 → 41 |

Panelde hastanın sağı ekranın solundadır. Süt dişleri yoktur.

## Aynı anda birden çok bilgisayar

**Çakışma koruması (`hastalar.js` → `hastayiSunucudaGuncelle`):**
- Her `PATCH` isteği, kaydın son bilinen `updated` değerini `beklenenGuncelleme` alanıyla gönderir.
- 409 gelirse kayıt yeniden çekilir ve değişiklik güncel kaydın üzerine **yeniden uygulanır**. Değişiklikler "listeye işlem ekle", "şu işlemi yapıldı yap" gibi işlevler olarak tanımlıdır; en fazla 5 deneme yapılır.
- Panel yalnızca değişen alanları gönderir: işlem eklerken formu, formu kaydederken `islemler`'i göndermez.

**Hasta bilgisi formu:**
- Gönderilen yalnızca kullanıcının değiştirdiği alanlardır. Başka bilgisayar farklı bir alanı değiştirdiyse ikisi birleşir.
- Aynı alanı iki kişi değiştirdiyse kayıt yapılmaz. Formun üstünde sunucudaki değeri gösteren bir uyarı çıkar, kullanıcının yazdığı kaybolmaz.
- Kullanıcı "Benimkini kaydet" ya da "Sunucudakini al" seçeneğinden birini seçer.

**Silinmiş işlem:** Düzeltilen ya da tiklenen işlem başka bilgisayarda silinmişse kayıt yapılmaz ve kullanıcıya söylenir.

**Anlık güncelleme:** Panel `hastalar`, `rontgenler` ve `gorseller` koleksiyonlarına abonedir.
- Açık liste, açık hasta ve açık sekmeler kendiliğinden güncellenir.
- Kaydedilmemiş form varken gelen değişiklik formu ezmez, yalnızca uyarı çıkarır.
- Yeniden bağlanınca açık ekran bir kez baştan çekilir.

## Eski verinin taşınması

Eski panel veriyi her bilgisayarın tarayıcısında, `file://` adresine bağlı olarak tutuyordu. Sunucudan açılan panel o depoyu okuyamaz. Bu yüzden `index.html` dosyası doğrudan (`file://`) açılınca panel yalnızca **Sunucuya Taşıma** ekranını gösterir:

1. **Hastaları Dışa Aktar:** Şu yapıda bir dosya indirir. Numarası olmayan eski hastalara önce eklenme sırasıyla numara verilir.

   ```json
   { "surum": 1, "sonHastaNo": 57, "hastalar": [ ... ] }
   ```

   Dosya hasta verisidir; yalnızca USB ile sunucuya taşınır. Sunucudaki Claude dosyayı içe aktarırken `hastaNo` değerlerini korur ve eski `id`'yi `eskiId`'ye yazar.
2. **Görselleri Yükle:** Sunucu adresi ve kullanıcı girişiyle eski IndexedDB görsellerini `gorseller` tablosuna yükler.
   - Eşleştirme hastanın `eskiId` alanıyla yapılır.
   - Eski panelde elle yüklenmiş röntgen resimleri (JPG/PNG) de buraya gider; açıklamaları "Eski panelden aktarılan röntgen resmi" olur.
   - Yüklenenler işaretlenir, ikinci çalıştırmada tekrar yüklenmez.

## Geliştirme ve deneme

- **Yerel çalıştırma:** PocketBase v0.40.6 ile çalıştırılır (SUNUCU-BAGLANTISI.md §5). `--publicDir` bu klasörü gösterir, panel `http://127.0.0.1:8091/` adresinden açılır.
- **Sunucusuz açılış:** `index.html` doğrudan açılırsa yalnızca taşıma ekranı gelir.
- **Laptop tarafındaki testler:**
  - Bu sürüm, sözleşmeyi taklit eden bir test sunucusuyla iki tarayıcı oturumunda (doktor + sekreter) denendi.
  - Denenenler: giriş, sunucunun Hasta No vermesi, 409 sonrası yeniden uygulama, form çakışması, anlık güncelleme, bağlantı kopması, röntgen ve eşleşmeyenler, görseller, oturum süresi ve taşıma.
  - Gerçek PocketBase ve `pb_hooks` ile uçtan uca deneme sunucuda yapılmalı.

## Gizlilik

Bu depo herkese açık. Depoya **gerçek hasta verisi, röntgen, hasta fotoğrafı, şifre ya da anahtar eklenmemeli**. Örneklerdeki ad ve TC numaraları uydurmadır.
