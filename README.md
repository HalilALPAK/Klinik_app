# Alpotech Klinik Paneli

Diş kliniği için hasta takip paneli: hasta listesi, FDI numaralı diş paneli, işlem tabloları, diş üzeri kayıtlar (işlem, hastalık, kanal tedavisi, implant), röntgen ve görsel sekmeleri.

Bu dosya, klinik sunucusunda bu proje üzerinde çalışacak geliştiriciler ve **sunucudaki Claude** için yazıldı. Özellikle [Hasta No kuralı](#hasta-no-kuralı) ve [Sunucu entegrasyonu](#sunucu-entegrasyonu-planlanan) bölümleri, sunucu tarafının uyması gereken sözleşmeyi tanımlar.

## Mevcut durum

- Sadece tarayıcıda çalışan, derleme gerektirmeyen düz HTML/CSS/JavaScript uygulaması. Kütüphane, `npm` veya sunucu yok.
- Çalıştırmak için `index.html` dosyasını Edge veya Chrome ile açmak yeterli.
- Veriler şimdilik **o bilgisayardaki tarayıcının deposunda** tutuluyor:
  - Hastalar `localStorage`'da.
  - Röntgen ve görsel dosyaları `IndexedDB`'de.
- Bu yüzden şu an her bilgisayarın verisi ayrı. Sunucuya taşınma işi aşağıdaki [planda](#sunucu-entegrasyonu-planlanan) anlatılıyor; henüz yapılmadı.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html` | Tüm ekranlar: hasta listesi, hasta sayfası, sekmeler, pencereler |
| `stil.css` | Görünüm |
| `hastalar.js` | Hasta listesi, arama, yeni hasta, hasta bilgisi formu, **Hasta No** üretimi, sayfa yönlendirme (`#hasta/<id>`). Sayfayı başlatan dosya |
| `dis_paneli.js` | SVG diş paneli: 32 diş (FDI 11–48), seçim, çene düğmeleri, eksik diş, kanal rengi, implant vidası, işaretler |
| `islemler.js` | Yapılacak / Yapılan İşlemler tabloları |
| `dis_kayitlari.js` | Dişe sağ tık menüsü, diş üzeri kayıtlar, yazdıkça gelen öneriler |
| `gorseller.js` | Diş Paneli / Röntgenler / Görseller sekmeleri, IndexedDB'deki dosyalar, büyük görüntüleyici |
| `logo.png` | Alpotech logosu |
| `kullanim_videosu.mp4` | Kullanım tanıtımı. Kanal, implant, sekmeler ve Hasta No eklenmeden önce çekildi |

Betikler `index.html` sonunda şu sırayla yüklenir ve ortak üst düzey isimleri paylaşır: `dis_paneli.js`, `islemler.js`, `dis_kayitlari.js`, `gorseller.js`, `hastalar.js`.

## Hasta No kuralı

Her hastaya, röntgen ve görsellerin sunucudan doğru hastaya bağlanması için bir **Hasta No** verilir.

- 1'den başlar, her yeni hastada 1 artar: 1, 2, 3, ...
- **Değişmez ve asla yeniden kullanılmaz.** Son verilen numara ayrıca saklanır (`localStorage["klinik.sonHastaNo"]`); bir hasta kaydı silinse bile numarası başka hastaya verilmez.
- Bu numaradan önce eklenmiş hastalara, sayfa açılınca eklenme sırasıyla numara verilir.
- Hasta listesinde ilk sütunda ve hasta sayfasında başlığın yanında ("Hasta No: 12") görünür. Arama kutusu numarayla da arar.
- TC kimlik numarası eşleştirme anahtarı **değildir**: yanlış yazılabilir ve sonradan düzeltilebilir. Dış sistemler hastayı yalnızca Hasta No ile tanır.
- Uygulamanın içindeki `id` alanı (rastgele metin, adres çubuğunda `#hasta/<id>`) sadece iç kullanım içindir. Sunucu tarafı onu kullanmamalı.

## Kaydedilen veriler

### Hasta (`localStorage["klinik.hastalar"]`, hasta nesnelerinden oluşan JSON dizisi)

```json
{
  "id": "mhx3k2a9f0q1zt",
  "hastaNo": 12,
  "ad": "Ayşe",
  "soyad": "Demir",
  "tc": "12345678901",
  "dogumTarihi": "1985-04-12",
  "ozelBilgi": "Penisilin alerjisi",
  "islemler": [],
  "eksikDisler": [],
  "disKayitlari": []
}
```

| Alan | Tür | Açıklama |
|---|---|---|
| `id` | metin | İç kimlik, değişmez |
| `hastaNo` | tam sayı | [Hasta No kuralı](#hasta-no-kuralı) |
| `ad`, `soyad` | metin | Zorunlu, baş ve sondaki boşluklar atılır |
| `tc` | metin | 11 hane, 0 ile başlamaz, hastalar arasında benzersiz. Kontrol hanesi hesabı yapılmaz |
| `dogumTarihi` | metin `YYYY-AA-GG` | Zorunlu. Yaş saklanmaz, bu alandan hesaplanır |
| `ozelBilgi` | metin | Alerji, kronik hastalık, kullandığı ilaçlar vb. Boş olabilir |
| `islemler` | dizi | Yapılacak ve yapılan işlemler, aşağıda. Alan olmayabilir; yoksa boş dizi kabul edilir |
| `eksikDisler` | tam sayı dizisi | Hastada olmayan (silinen) dişlerin FDI numaraları. Alan olmayabilir |
| `disKayitlari` | dizi | Dişe sağ tıkla eklenen kayıtlar, aşağıda. Alan olmayabilir |

### İşlem (`hasta.islemler[]`)

```json
{
  "id": "mhx3m1c2ab12cd",
  "tedavi": "Kompozit Dolgu",
  "disler": [24, 25],
  "acil": true,
  "doktor": "Dt. Elif Arslan",
  "not": "İki yüzlü",
  "yapildi": false,
  "yapilmaTarihi": null
}
```

- Ekranda görünen sıra numarası (1, 2, 3...) saklanmaz; dizideki konumdan hesaplanır. Bir işlem silinince sonrakiler kayar.
- `yapildi: true` olunca `yapilmaTarihi` o günün tarihi (`YYYY-AA-GG`) olur, işlem Yapılan İşlemler tablosuna geçer. Tik kaldırılınca `false` / `null` olur.
- `tedavi` ve `doktor` zorunlu, `disler` boş olabilir (örneğin muayene).

### Diş kaydı (`hasta.disKayitlari[]`)

```json
{ "id": "mhx3n8d4ef56gh", "dis": 26, "tur": "islem", "ad": "Kanal Tedavisi" }
```

- `tur` değeri `"islem"` (önceden yapılmış işlem) ya da `"hastalik"` olabilir.
- Görünüm kayıt adından türetilir, ayrıca saklanmaz:
  - Türü `islem` ve adında **"kanal"** geçen kayıt, o dişin kanallarını turuncu gösterir.
  - Türü `islem` ve adında **"implant"** geçen kayıt, dişin yerine vida çizer. İmplantlı diş `eksikDisler` içinde olsa da eksik sayılmaz.
  - Eşleşme Türkçe küçük harfe çevrilerek yapılır, `ı` harfi `i` sayılır ("IMPLANT" da eşleşir).
- Öneriler ayrıca saklanmaz: yazarken tüm hastalardaki aynı türden kayıt adları önerilir.

### Röntgen ve görseller (IndexedDB `klinik_dosyalar`, depo `gorseller`)

```json
{ "id": "...", "hastaId": "<hasta.id>", "tur": "rontgen", "ad": "panoramik.jpg",
  "tarih": "2026-11-18", "eklenme": 1795000000000, "dosya": "<Blob>" }
```

- `tur` değeri `"rontgen"` ya da `"gorsel"`. `hastaId` alanı için `hastaId` adlı bir dizin vardır.
- Şu an bunlar sadece elle yüklenen JPG/PNG dosyalarıdır; tarayıcının açamadığı biçimler (DICOM, TIFF) reddedilir.
- Sunucu entegrasyonunda röntgen ve görseller sunucudan **Hasta No** ile gelecek (aşağıda).

### Diş numaralama

FDI sistemi kullanılır:

| Bölge | Dişler |
|---|---|
| Sağ üst | 18 → 11 |
| Sol üst | 21 → 28 |
| Sol alt | 31 → 38 |
| Sağ alt | 48 → 41 |

Panelde hastanın sağı ekranın solundadır. Süt dişleri (51–85) yoktur.

## Sunucu entegrasyonu (planlanan)

Bu bölüm henüz yapılmadı. Sunucu tarafını kuran, bu sözleşmeye uymalı; sözleşme değişirse bu README de güncellenmeli.

### Klinik ağı

```
ÜST KAT   Sunucu (Windows PC, 1 TB) ─ modem ─ switch
                                         │ Cat6
ALT KAT   MyRay röntgen + laptop · Klinik 1 PC · Klinik 2 PC · Sekreter PC
```

- Dışarıdan (internetten) erişim yok ve gerekmiyor. Modemde port açılmayacak.
- Klinik ve sekreter bilgisayarları uygulamayı sunucudan açar: Edge uygulama penceresi, masaüstü ikonu, `--app=http://<sunucu-ip>`. Kurulum dosyası (.exe) yok.

### Röntgen akışı

1. Çekim MyRay cihazıyla yapılır, görüntü cihazın laptopundaki yazılıma (iRYS) gelir.
2. Doktor görüntüyü kontrol eder. Uygunsa yazılımdan sunucuya **DICOM** olarak gönderir (Cat6). Uygun bulunmayan gönderilmez.
3. Sunucuda DICOM deposu (öneri: **Orthanc**) görüntüyü alır ve saklar.
4. Görüntü, **DICOM `PatientID (0010,0020)` = Hasta No** ile hastaya bağlanır.
   - Değer, başında sıfır olmayan ondalık metindir; 12 numaralı hasta için `"12"`.
   - Bunun için çekimden önce iRYS'te hasta numarası olarak Hasta No girilir. Cihaz destekliyorsa ileride DICOM Worklist ile hasta listesi cihaza gönderilir, böylece numara elle yazılmaz.
5. `PatientID` boş olan ya da hiçbir Hasta No ile eşleşmeyen çekim silinmez; "eşleşmeyenler" listesine düşer ve elle hastaya atanır.
6. Panelde hastanın **Röntgenler** sekmesi bu röntgenleri listeler. Tıklayınca parlaklık/kontrast ve ölçüm yapılabilen bir DICOM görüntüleyici açılır. Röntgen gönderildikten sonra açık ekranlarda birkaç saniye içinde görünmeli.

Görseller (ağız içi fotoğraflar vb.) de aynı şekilde sunucuda tutulur ve Hasta No ile bağlanır.

### Panelin sunucudan bekleyeceği uçlar (öneri)

| İstek | Dönen |
|---|---|
| `GET /api/hastalar/{hastaNo}/rontgenler` | `[{ "id", "tarih": "YYYY-AA-GG", "tur": "PX/IO/CT...", "aciklama", "onizlemeUrl", "goruntuleyiciUrl" }]`, en yeni başta |
| `GET /api/hastalar/{hastaNo}/gorseller` | `[{ "id", "tarih", "ad", "onizlemeUrl", "tamUrl" }]` |
| `GET /api/eslesmeyenler` | Hasta No ile eşleşmeyen çekimler |
| `POST /api/eslesmeyenler/{id}/ata` gövde `{ "hastaNo": 12 }` | Çekimi hastaya bağlar |

Hasta, işlem ve diş kayıtları da sunucudaki bir veritabanına (öneri: SQLite) taşınacak; alan adları yukarıdaki [kaydedilen veriler](#kaydedilen-veriler) ile aynı kalmalı. Taşımada, mevcut `localStorage` verisi bir kerelik dışa aktarılıp sunucuya yüklenir. `hastaNo` değerleri **olduğu gibi korunur**, yeniden numaralanmaz.

### Sunucu için diğer gereksinimler

- Sunucuda sabit IP, uyku modu kapalı. Uygulama ve DICOM deposu Windows açılınca kendiliğinden başlayan servis olarak çalışır.
- Gece otomatik yedek (harici disk ve dışarıda şifreli bir kopya), UPS.
- Doktor ve sekreter için kullanıcı girişi, değişiklik kaydı. Bunlar sağlık verisi olduğu için KVKK kapsamında.

## Gizlilik

Bu depo herkese açık. Depoya **gerçek hasta verisi, röntgen ya da hasta fotoğrafı eklenmemeli**. Örneklerdeki ad ve TC numaraları uydurmadır; TC numaraları kontrol hanesi kuralına uymadığı için gerçek bir kişiye ait olamaz.
