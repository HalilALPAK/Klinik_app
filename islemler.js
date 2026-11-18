"use strict";

/*
 * Hastanın işlemleri: hasta.islemler dizisinde eklenme sırasıyla tutulur,
 * sıra numarası bu dizideki konumdur. Aynı anda tek satır düzenlenebilir;
 * satır açıkken diş panelindeki seçim o satırın dişleri olur.
 */

const ikonSvg = (yol) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${yol}"/></svg>`;
const IKON_KALEM = ikonSvg("M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4");
const IKON_COP = ikonSvg("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5");
const IKON_ONAY = ikonSvg("M5 12.5l4.5 4.5L19 7.5");
const IKON_IPTAL = ikonSvg("M6 6l12 12M18 6L6 18");

const DIS_IPUCU = "Panelden seçin";

const yapilacakSatirlari = document.getElementById("yapilacak-satirlari");
const yapilanSatirlari = document.getElementById("yapilan-satirlari");
const yapilacakBos = document.getElementById("yapilacak-bos");
const yapilanBos = document.getElementById("yapilan-bos");

// { id: düzenlenen işlem (yeni satırda null), alanlar, disHucresi }
let islemTaslagi = null;
let islemTaslakDegisti = false;
let islemKaydediliyor = false;

const hastaninIslemleri = (hasta) => hasta.islemler || [];
const acikHastaIslemleri = () => hastaninIslemleri(acikHasta());

// degistir(güncel işlem listesi) yeni listeyi döndürür; sunucuda çakışma olursa
// güncel kayıt üzerinde yeniden çalıştırılır (hastalar.js)
const islemleriDegistir = (degistir) => acikHastayiGuncelle((hasta) => ({ islemler: degistir(hastaninIslemleri(hasta)) }));

function islemVarMi(liste, id) {
  if (!liste.some((i) => i.id === id)) throw new CakismaHatasi("Bu işlem başka bir bilgisayarda silinmiş.");
}
const tarihGoster = (tarih) => tarih.split("-").reverse().join(".");
const disYazisi = (disler) => disler.join(", ");

function hucreOlustur(icerik, sinif) {
  const hucre = document.createElement("td");
  if (sinif) hucre.className = sinif;
  hucre.append(icerik);
  return hucre;
}

function ikonDugmesi(ikon, etiket, tiklaninca) {
  const dugme = document.createElement("button");
  dugme.type = "button";
  dugme.className = "ikon-dugme";
  dugme.innerHTML = ikon;
  dugme.title = etiket;
  dugme.setAttribute("aria-label", etiket);
  dugme.addEventListener("click", tiklaninca);
  return dugme;
}

function onayKutusu(isaretli, etiket) {
  const kutu = document.createElement("input");
  kutu.type = "checkbox";
  kutu.checked = isaretli;
  kutu.setAttribute("aria-label", etiket);
  return kutu;
}

function metinKutusu(deger, etiket, zorunlu) {
  const kutu = document.createElement("input");
  kutu.value = deger;
  kutu.autocomplete = "off";
  kutu.setAttribute("aria-label", etiket);
  if (zorunlu) {
    kutu.required = true;
    kutu.pattern = ".*\\S.*";
  }
  return kutu;
}

function eylemHucresi(...dugmeler) {
  const hucre = document.createElement("td");
  hucre.className = "islem-eylem";
  hucre.append(...dugmeler);
  return hucre;
}

function islemSatiri(islem, sira) {
  const kilitli = islemTaslagi !== null;
  const satir = document.createElement("tr");
  satir.classList.toggle("acil-satir", islem.acil);

  const tamam = onayKutusu(islem.yapildi, `${sira} numaralı işlem yapıldı`);
  tamam.disabled = kilitli;
  tamam.addEventListener("change", () => islemDurumunuDegistir(islem.id, tamam.checked));

  const acil = onayKutusu(islem.acil, "Acil");
  acil.disabled = true;
  acil.className = "acil-kutu";

  const duzelt = ikonDugmesi(IKON_KALEM, `${sira} numaralı işlemi düzelt`, () => taslakAc(islem.id));
  const sil = ikonDugmesi(IKON_COP, `${sira} numaralı işlemi sil`, () => islemSil(islem.id, sira));
  duzelt.disabled = kilitli;
  sil.disabled = kilitli;

  satir.append(
    hucreOlustur(tamam),
    hucreOlustur(String(sira)),
    ...(islem.yapildi ? [hucreOlustur(tarihGoster(islem.yapilmaTarihi), "islem-tarih")] : []),
    hucreOlustur(islem.tedavi),
    hucreOlustur(disYazisi(islem.disler)),
    hucreOlustur(acil),
    hucreOlustur(islem.doktor),
    hucreOlustur(islem.not, "islem-not"),
    eylemHucresi(duzelt, sil),
  );
  return satir;
}

function taslakSatiri(islem, sira) {
  const alanlar = {
    tedavi: metinKutusu(islem.tedavi, "Tedavi adı", true),
    acil: onayKutusu(islem.acil, "Acil"),
    doktor: metinKutusu(islem.doktor, "Doktor adı", true),
    not: metinKutusu(islem.not, "Not", false),
  };
  alanlar.acil.className = "acil-kutu";

  const disHucresi = hucreOlustur("", "taslak-disler");
  islemTaslagi.alanlar = alanlar;
  islemTaslagi.disHucresi = disHucresi;
  taslakDisleriniGoster(disPaneli.secim());

  const satir = document.createElement("tr");
  satir.className = "taslak-satir";
  satir.append(
    hucreOlustur(""),
    hucreOlustur(String(sira)),
    ...(islem.yapildi ? [hucreOlustur(tarihGoster(islem.yapilmaTarihi), "islem-tarih")] : []),
    hucreOlustur(alanlar.tedavi),
    disHucresi,
    hucreOlustur(alanlar.acil),
    hucreOlustur(alanlar.doktor),
    hucreOlustur(alanlar.not),
    eylemHucresi(
      ikonDugmesi(IKON_ONAY, "İşlemi kaydet", taslagiKaydet),
      ikonDugmesi(IKON_IPTAL, "Vazgeç", taslagiKapat),
    ),
  );

  satir.addEventListener("input", () => {
    islemTaslakDegisti = true;
  });
  satir.addEventListener("keydown", (olay) => {
    if (olay.key === "Escape") taslagiKapat();
    else if (olay.key === "Enter" && olay.target.tagName === "INPUT") taslagiKaydet();
  });
  return satir;
}

function islemleriCiz() {
  const islemler = acikHastaIslemleri();
  const satirCiz = (islem, i) => (
    islemTaslagi && islemTaslagi.id === islem.id ? taslakSatiri(islem, i + 1) : islemSatiri(islem, i + 1)
  );
  const yapilacak = [];
  const yapilan = [];
  islemler.forEach((islem, i) => (islem.yapildi ? yapilan : yapilacak).push(satirCiz(islem, i)));

  if (islemTaslagi && islemTaslagi.id === null) {
    const bosIslem = { tedavi: "", disler: [], acil: false, doktor: "", not: "", yapildi: false };
    yapilacak.push(taslakSatiri(bosIslem, islemler.length + 1));
  }

  yapilacakSatirlari.replaceChildren(...yapilacak);
  yapilanSatirlari.replaceChildren(...yapilan);
  yapilacakBos.hidden = yapilacak.length > 0;
  yapilanBos.hidden = yapilan.length > 0;
}

function taslakDisleriniGoster(disler) {
  const { disHucresi } = islemTaslagi;
  disHucresi.textContent = disYazisi(disler) || DIS_IPUCU;
  disHucresi.classList.toggle("ipucu", disler.length === 0);
}

// Diş panelinde seçim değişince çağrılır
function taslakDisleriniGuncelle(disler) {
  if (!islemTaslagi) return;
  taslakDisleriniGoster(disler);
  islemTaslakDegisti = true;
}

function taslakAc(id) {
  islemTaslagi = { id };
  islemTaslakDegisti = false;
  if (id !== null) {
    disPaneli.ayarla(acikHastaIslemleri().find((i) => i.id === id).disler);
  }
  islemleriCiz();
  islemTaslagi.alanlar.tedavi.focus();
}

function taslagiKapat() {
  islemTaslagi = null;
  islemTaslakDegisti = false;
  disPaneli.ayarla([]);
  islemleriCiz();
}

// Kayıt başarısızsa satır açık kalır, kullanıcının yazdığı kaybolmaz
async function taslagiKaydet() {
  if (islemKaydediliyor) return false;
  const { id, alanlar } = islemTaslagi;
  if (!alanlar.tedavi.reportValidity() || !alanlar.doktor.reportValidity()) return false;
  const veri = {
    tedavi: alanlar.tedavi.value.trim(),
    disler: disPaneli.secim(),
    acil: alanlar.acil.checked,
    doktor: alanlar.doktor.value.trim(),
    not: alanlar.not.value.trim(),
  };
  const yeniId = yeniKimlik();
  islemKaydediliyor = true;
  const kayit = await islemleriDegistir((liste) => {
    if (id === null) return [...liste, { id: yeniId, ...veri, yapildi: false, yapilmaTarihi: null }];
    islemVarMi(liste, id);
    return liste.map((i) => (i.id === id ? { ...i, ...veri } : i));
  });
  islemKaydediliyor = false;
  if (!kayit) return false;
  taslagiKapat();
  return true;
}

// + düğmesi: açık satır varsa önce onu kaydeder, sonra yeni satır açar
async function yeniIslemEkle() {
  if (islemTaslagi && !(await taslagiKaydet())) return;
  taslakAc(null);
}

async function islemDurumunuDegistir(id, yapildi) {
  const yapilmaTarihi = yapildi ? bugununTarihi() : null;
  await islemleriDegistir((liste) => {
    islemVarMi(liste, id);
    return liste.map((i) => (i.id === id ? { ...i, yapildi, yapilmaTarihi } : i));
  });
  islemleriCiz();
}

async function islemSil(id, sira) {
  if (!confirm(`${sira} numaralı işlem silinsin mi?`)) return;
  await islemleriDegistir((liste) => liste.filter((i) => i.id !== id));
  islemleriCiz();
}

// Hasta ekranı her açıldığında çağrılır
function islemleriSifirla() {
  taslagiKapat();
}

document.getElementById("islem-ekle").addEventListener("click", yeniIslemEkle);
