"use strict";

/*
 * Hasta sekmeleri, röntgenler, görseller ve eşleşmeyen röntgenler (SUNUCU-BAGLANTISI.md §4, §4b).
 * - Röntgenleri sunucu oluşturur, panel yalnızca okur. Önizleme Authorization başlığı
 *   istediği için fetch ile alınıp blob adresine çevrilir.
 * - Görsel dosyaları korumalıdır; kısa ömürlü dosya anahtarıyla <img> adresi kurulur.
 */

const RONTGEN_KUCUK_GENISLIK = 300;
const GORSEL_KUCUK = "300x0";
const MODALITE_ADLARI = { PX: "Panoramik", IO: "Ağız içi", CT: "Tomografi", CR: "Röntgen", DX: "Röntgen" };

const sekmeDugmeleri = [...document.querySelectorAll(".sekme")];
const sekmeIcerikleri = [...document.querySelectorAll(".sekme-icerik")];
const rontgenGalerisi = document.getElementById("sekme-rontgen");
const gorselGalerisi = document.getElementById("sekme-gorsel");
const eslesmeyenListesi = document.getElementById("eslesmeyen-listesi");
const eslesmeyenBos = document.getElementById("eslesmeyen-bos");
const eslesmeyenSayisi = document.getElementById("eslesmeyen-sayisi");
const goruntuleyici = document.getElementById("gorsel-goruntuleyici");
const goruntuAlani = document.getElementById("goruntu-alani");
const goruntuResmi = document.getElementById("goruntu-resmi");
const goruntuBasligi = document.getElementById("goruntu-basligi");
const goruntuOnceki = document.getElementById("goruntu-onceki");
const goruntuSonraki = document.getElementById("goruntu-sonraki");

let acikSekme = "dis";
const blobAdresleri = new Map(); // sahibi -> o sahibin oluşturduğu blob adresleri
let gosterilenler = [];
let gosterilenSira = 0;

const modaliteAdi = (m) => MODALITE_ADLARI[m] || m || "Röntgen";
// "YYYY-AA-GG" olduğu gibi; sunucunun UTC zaman damgası ("2026-11-19 22:10:00.000Z") yerel tarihe çevrilir
function tarihYazisi(t) {
  if (!t) return "";
  if (t.length <= 10) return tarihGoster(t);
  return new Date(t.replace(" ", "T")).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const onizlemeYolu = (id, genislik) => `/api/klinik/rontgenler/${id}/onizleme${genislik ? `?genislik=${genislik}` : ""}`;

function blobAdresiKaydet(sahibi, adres) {
  if (!blobAdresleri.has(sahibi)) blobAdresleri.set(sahibi, []);
  blobAdresleri.get(sahibi).push(adres);
  return adres;
}

function blobAdresleriniBirak(sahibi) {
  (blobAdresleri.get(sahibi) || []).forEach((a) => URL.revokeObjectURL(a));
  blobAdresleri.delete(sahibi);
}

const galeriDurumu = (galeri, metin) => {
  galeri.querySelector(".galeri-durum").textContent = metin;
};

/* Sekmeler */

function sekmeGoster(ad) {
  acikSekme = ad;
  sekmeDugmeleri.forEach((d) => d.setAttribute("aria-pressed", String(d.dataset.sekme === ad)));
  sekmeIcerikleri.forEach((icerik) => {
    icerik.hidden = icerik.id !== `sekme-${ad}`;
  });
  acikGaleriyiTazele();
}

function acikGaleriyiTazele() {
  if (acikSekme === "rontgen") rontgenleriCiz();
  else if (acikSekme === "gorsel") gorselleriCiz();
}

/*
 * Galeri öğesi: { baslik, altYazi, kucuk: () => Promise<adres>, buyuk: () => Promise<adres> }
 * kucuk/buyuk blob adresi döndürürse sahibine kaydedilip sonra bırakılır.
 */
function resimDugmesi(oge, liste, sira, etiket) {
  const dugme = document.createElement("button");
  dugme.type = "button";
  dugme.className = "galeri-kucuk";
  dugme.setAttribute("aria-label", `${oge.baslik} büyüt`);
  const resim = document.createElement("img");
  resim.alt = oge.baslik;
  dugme.append(resim);
  if (etiket) {
    const yazi = document.createElement("span");
    yazi.className = "galeri-etiket";
    yazi.textContent = etiket;
    dugme.append(yazi);
  }
  oge.kucuk().then((adres) => {
    resim.src = adres;
  }).catch(() => {
    dugme.classList.add("yuklenemedi");
  });
  dugme.addEventListener("click", () => goruntuleyiciyiAc(liste, sira));
  return dugme;
}

function kutucukYazisi(oge, ekDugmeler) {
  const yazi = document.createElement("figcaption");
  const ad = document.createElement("span");
  ad.className = "galeri-ad";
  ad.textContent = oge.baslik;
  ad.title = oge.baslik;
  const tarih = document.createElement("span");
  tarih.className = "galeri-tarih";
  tarih.textContent = oge.altYazi;
  yazi.append(ad, tarih, ...ekDugmeler);
  return yazi;
}

/* Röntgenler */

function rontgenOgesi(kayit) {
  const baslik = [modaliteAdi(kayit.modalite), kayit.aciklama].filter(Boolean).join(" - ");
  return {
    kayit,
    baslik,
    altYazi: tarihYazisi(kayit.cekimTarihi || kayit.created),
    kucuk: async () => blobAdresiKaydet(rontgenGalerisi, await yetkiliResimAdresi(onizlemeYolu(kayit.id, RONTGEN_KUCUK_GENISLIK))),
    buyuk: async () => blobAdresiKaydet(goruntuleyici, await yetkiliResimAdresi(onizlemeYolu(kayit.id))),
  };
}

async function rontgenleriCiz() {
  const hastaId = acikHastaId;
  let kayitlar;
  try {
    kayitlar = await istek(() => pb.collection("rontgenler").getFullList({
      filter: pb.filter("hasta = {:hasta}", { hasta: hastaId }),
      sort: "-cekimTarihi,-created",
    }));
  } catch {
    galeriDurumu(rontgenGalerisi, "Röntgenler alınamadı.");
    return;
  }
  if (hastaId !== acikHastaId) return;
  galeriDurumu(rontgenGalerisi, "");
  blobAdresleriniBirak(rontgenGalerisi);
  rontgenGalerisi.dataset.kayitlar = kayitlar.map((k) => k.id).join(",");

  const liste = kayitlar.map(rontgenOgesi);
  rontgenGalerisi.querySelector(".galeri-izgara").replaceChildren(...liste.map((oge, sira) => {
    const kutu = document.createElement("figure");
    kutu.className = "galeri-oge";
    const ayir = ikonDugmesi(IKON_IPTAL, `${oge.baslik} röntgenini bu hastadan ayır`, () => rontgeniAyir(oge.kayit));
    kutu.append(resimDugmesi(oge, liste, sira), kutucukYazisi(oge, [ayir]));
    return kutu;
  }));
  rontgenGalerisi.querySelector(".liste-bos").hidden = liste.length > 0;
}

// hastaNo: null röntgeni eşleşmeyenlere geri gönderir
async function rontgeniAta(id, hastaNo) {
  return istek(() => pb.send(`/api/klinik/rontgenler/${id}/ata`, { method: "POST", body: { hastaNo } }));
}

async function rontgeniAyir(kayit) {
  if (!confirm("Bu röntgen bu hastadan ayrılıp eşleşmeyen röntgenlere taşınsın mı?")) return;
  try {
    await rontgeniAta(kayit.id, null);
  } catch (hata) {
    kayitHatasiniGoster(hata);
  }
  rontgenleriCiz();
}

/* Eşleşmeyen röntgenler */

async function eslesmeyenSayisiniGuncelle() {
  try {
    const sonuc = await istek(() => pb.collection("rontgenler").getList(1, 1, { filter: 'hasta = ""' }));
    eslesmeyenSayisi.textContent = sonuc.totalItems;
    eslesmeyenSayisi.parentElement.classList.toggle("uyari", sonuc.totalItems > 0);
  } catch {
    // Sayı gösterilemezse düğme yine çalışır
  }
}

function eslesmeyenleriGoster() {
  acikHastaId = null;
  sayfaGoster(eslesmeyenSayfasi);
  eslesmeyenleriCiz();
}

function bilgiSatiri(etiket, deger) {
  const satir = document.createElement("div");
  const e = document.createElement("span");
  e.className = "eslesmeyen-etiket";
  e.textContent = etiket;
  const d = document.createElement("span");
  d.textContent = deger || "-";
  satir.append(e, d);
  return satir;
}

function atamaFormu(kayit) {
  const form = document.createElement("form");
  form.className = "atama-formu";
  const girdi = document.createElement("input");
  girdi.type = "number";
  girdi.min = "1";
  girdi.step = "1";
  girdi.required = true;
  girdi.placeholder = "Hasta No";
  girdi.setAttribute("aria-label", "Atanacak Hasta No");
  const dugme = document.createElement("button");
  dugme.type = "submit";
  dugme.className = "dugme birincil";
  dugme.textContent = "Ata";
  const onizleme = document.createElement("span");
  onizleme.className = "atama-onizleme";
  girdi.addEventListener("input", () => {
    girdi.setCustomValidity("");
    const hasta = hastalar.find((h) => h.hastaNo === Number(girdi.value));
    onizleme.textContent = hasta ? tamAd(hasta) : "";
  });
  form.addEventListener("submit", async (olay) => {
    olay.preventDefault();
    dugme.disabled = true;
    try {
      await rontgeniAta(kayit.id, Number(girdi.value));
      eslesmeyenleriCiz();
      eslesmeyenSayisiniGuncelle();
    } catch (hata) {
      if (hata.status === 404) {
        girdi.setCustomValidity("Bu numarada hasta yok.");
        girdi.reportValidity();
      } else kayitHatasiniGoster(hata);
    } finally {
      dugme.disabled = false;
    }
  });
  form.append(girdi, dugme, onizleme);
  return form;
}

async function eslesmeyenleriCiz() {
  let kayitlar;
  try {
    kayitlar = await istek(() => pb.collection("rontgenler").getFullList({ filter: 'hasta = ""', sort: "-created" }));
  } catch {
    return;
  }
  if (eslesmeyenSayfasi.hidden) return;
  blobAdresleriniBirak(eslesmeyenSayfasi);
  const liste = kayitlar.map((kayit) => ({
    ...rontgenOgesi(kayit),
    kucuk: async () => blobAdresiKaydet(eslesmeyenSayfasi, await yetkiliResimAdresi(onizlemeYolu(kayit.id, RONTGEN_KUCUK_GENISLIK))),
  }));
  eslesmeyenListesi.replaceChildren(...liste.map((oge, sira) => {
    const { kayit } = oge;
    const kart = document.createElement("article");
    kart.className = "eslesmeyen-kart";
    const bilgi = document.createElement("div");
    bilgi.className = "eslesmeyen-bilgi";
    bilgi.append(
      bilgiSatiri("Cihazdaki hasta no", kayit.dicomPatientId),
      bilgiSatiri("Cihazdaki ad", kayit.dicomPatientName),
      bilgiSatiri("Çekim tarihi", tarihYazisi(kayit.cekimTarihi)),
      bilgiSatiri("Tür", modaliteAdi(kayit.modalite)),
      atamaFormu(kayit),
    );
    kart.append(resimDugmesi(oge, liste, sira), bilgi);
    return kart;
  }));
  eslesmeyenBos.hidden = liste.length > 0;
  eslesmeyenSayisi.textContent = liste.length;
}

/* Görseller */

async function gorselleriCiz() {
  const hastaId = acikHastaId;
  let kayitlar;
  let anahtar;
  try {
    kayitlar = await istek(() => pb.collection("gorseller").getFullList({
      filter: pb.filter("hasta = {:hasta}", { hasta: hastaId }),
      sort: "-created",
    }));
    anahtar = await istek(() => pb.files.getToken());
  } catch {
    galeriDurumu(gorselGalerisi, "Görseller alınamadı.");
    return;
  }
  if (hastaId !== acikHastaId) return;
  gorselGalerisi.dataset.kayitlar = kayitlar.map((k) => k.id).join(",");

  const ogeOlustur = (kayit) => ({
    kayit,
    baslik: kayit.tur === "gemini" ? "Gemini önizlemesi" : (kayit.aciklama || kayit.ad || "Görsel"),
    altYazi: tarihYazisi(kayit.created),
    kucuk: async () => pb.files.getURL(kayit, kayit.dosya, { token: anahtar, thumb: GORSEL_KUCUK }),
    buyuk: async () => pb.files.getURL(kayit, kayit.dosya, { token: await istek(() => pb.files.getToken()) }),
  });

  // Gemini sonuçları kaynak görselin yanında "önce / sonra" olarak gösterilir
  const kimlikler = new Set(kayitlar.map((k) => k.id));
  const sonuclar = new Map();
  kayitlar.forEach((k) => {
    if (k.tur === "gemini" && kimlikler.has(k.kaynakGorsel)) {
      if (!sonuclar.has(k.kaynakGorsel)) sonuclar.set(k.kaynakGorsel, []);
      sonuclar.get(k.kaynakGorsel).push(k);
    }
  });
  const gruplar = kayitlar
    .filter((k) => !(k.tur === "gemini" && kimlikler.has(k.kaynakGorsel)))
    .map((k) => [k, ...(sonuclar.get(k.id) || [])]);
  const liste = gruplar.flat().map(ogeOlustur);

  let sira = 0;
  gorselGalerisi.querySelector(".galeri-izgara").replaceChildren(...gruplar.map((grup) => {
    const kutu = document.createElement("figure");
    kutu.className = grup.length > 1 ? "galeri-oge galeri-cift" : "galeri-oge";
    const resimler = document.createElement("div");
    resimler.className = "galeri-resimler";
    grup.forEach((kayit, i) => {
      const etiket = grup.length > 1 ? (i === 0 ? "Önce" : "Sonra") : "";
      resimler.append(resimDugmesi(liste[sira], liste, sira, etiket));
      sira += 1;
    });
    const anaOge = liste[sira - grup.length];
    const sil = doktorMu() ? [ikonDugmesi(IKON_COP, `${anaOge.baslik} sil`, () => gorselSil(grup))] : [];
    kutu.append(resimler, kutucukYazisi(anaOge, sil));
    return kutu;
  }));
  gorselGalerisi.querySelector(".liste-bos").hidden = liste.length > 0;
}

async function gorselSil(grup) {
  const ek = grup.length > 1 ? " Gemini önizlemesi de silinecek." : "";
  if (!confirm(`Bu görsel silinsin mi?${ek}`)) return;
  try {
    for (const kayit of [...grup].reverse()) await istek(() => pb.collection("gorseller").delete(kayit.id));
  } catch (hata) {
    kayitHatasiniGoster(hata);
  }
  gorselleriCiz();
}

// Tarayıcının gösteremediği biçimler (TIFF, DICOM...) baştan reddedilir
async function gosterilebilirMi(dosya) {
  try {
    (await createImageBitmap(dosya)).close();
    return true;
  } catch {
    return false;
  }
}

async function gorselleriYukle(dosyalar) {
  const hastaId = acikHastaId;
  const reddedilen = [];
  galeriDurumu(gorselGalerisi, "Yükleniyor...");
  for (const dosya of dosyalar) {
    if (!(await gosterilebilirMi(dosya))) {
      reddedilen.push(dosya.name);
      continue;
    }
    const veri = new FormData();
    veri.append("hasta", hastaId);
    veri.append("dosya", dosya);
    veri.append("tur", "orijinal");
    veri.append("kaynak", "panel");
    veri.append("ad", dosya.name);
    try {
      await istek(() => pb.collection("gorseller").create(veri));
    } catch (hata) {
      kayitHatasiniGoster(hata);
      reddedilen.push(dosya.name);
    }
  }
  galeriDurumu(gorselGalerisi, reddedilen.length
    ? `Bu dosyalar eklenemedi (JPG, PNG gibi bir resim olmalı): ${reddedilen.join(", ")}`
    : "");
  if (hastaId === acikHastaId) gorselleriCiz();
}

/* Anlık olaylar */

const galeridekiMi = (galeri, id) => (galeri.dataset.kayitlar || "").split(",").includes(id);

function rontgenOlayi({ record }) {
  eslesmeyenSayisiniGuncelle();
  if (!eslesmeyenSayfasi.hidden) eslesmeyenleriCiz();
  if (acikHastaId && acikSekme === "rontgen"
    && (record.hasta === acikHastaId || galeridekiMi(rontgenGalerisi, record.id))) rontgenleriCiz();
}

function gorselOlayi({ record }) {
  if (acikHastaId && acikSekme === "gorsel"
    && (record.hasta === acikHastaId || galeridekiMi(gorselGalerisi, record.id))) gorselleriCiz();
}

/* Büyük görüntüleyici */

async function goruntuyuGoster() {
  const sira = gosterilenSira;
  const oge = gosterilenler[sira];
  goruntuBasligi.textContent = `${oge.baslik}${oge.altYazi ? ` - ${oge.altYazi}` : ""} (${sira + 1}/${gosterilenler.length})`;
  goruntuAlani.classList.remove("buyuk");
  goruntuResmi.removeAttribute("src");
  goruntuResmi.alt = "Yükleniyor...";
  try {
    const adres = await oge.buyuk();
    if (sira !== gosterilenSira || !goruntuleyici.open) return;
    goruntuResmi.src = adres;
    goruntuResmi.alt = oge.baslik;
  } catch {
    if (sira === gosterilenSira) goruntuResmi.alt = "Görüntü yüklenemedi.";
  }
}

function goruntuleyiciyiAc(liste, sira) {
  gosterilenler = liste;
  gosterilenSira = sira;
  goruntuOnceki.hidden = liste.length < 2;
  goruntuSonraki.hidden = liste.length < 2;
  goruntuleyici.showModal();
  goruntuyuGoster();
}

function goruntuyuKaydir(yon) {
  if (gosterilenler.length < 2) return;
  gosterilenSira = (gosterilenSira + yon + gosterilenler.length) % gosterilenler.length;
  goruntuyuGoster();
}

/* Olaylar */

sekmeDugmeleri.forEach((d) => d.addEventListener("click", () => sekmeGoster(d.dataset.sekme)));

const gorselSecici = gorselGalerisi.querySelector('input[type="file"]');
gorselGalerisi.querySelector(".galeri-ekle").addEventListener("click", () => gorselSecici.click());
gorselSecici.addEventListener("change", () => {
  const dosyalar = [...gorselSecici.files];
  gorselSecici.value = "";
  if (dosyalar.length) gorselleriYukle(dosyalar);
});

goruntuOnceki.addEventListener("click", () => goruntuyuKaydir(-1));
goruntuSonraki.addEventListener("click", () => goruntuyuKaydir(1));
document.getElementById("goruntu-kapat").addEventListener("click", () => goruntuleyici.close());
goruntuleyici.addEventListener("close", () => {
  goruntuResmi.removeAttribute("src");
  blobAdresleriniBirak(goruntuleyici);
});
goruntuResmi.addEventListener("click", () => goruntuAlani.classList.toggle("buyuk"));
goruntuleyici.addEventListener("keydown", (olay) => {
  if (olay.key === "ArrowLeft") goruntuyuKaydir(-1);
  else if (olay.key === "ArrowRight") goruntuyuKaydir(1);
});
