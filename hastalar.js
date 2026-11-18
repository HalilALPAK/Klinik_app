"use strict";

const DEPO_ANAHTARI = "klinik.hastalar";

let hastalar = depodanOku();
let acikHastaId = null;
let formDegisti = false;

const listeSayfasi = document.getElementById("liste-sayfasi");
const hastaSayfasi = document.getElementById("hasta-sayfasi");
const aramaKutusu = document.getElementById("hasta-arama");
const satirlar = document.getElementById("hasta-satirlari");
const listeBos = document.getElementById("liste-bos");
const hastaBasligi = document.getElementById("hasta-basligi");
const hastaFormu = document.getElementById("hasta-formu");
const kayitDurumu = document.getElementById("kayit-durumu");
const yeniHastaPenceresi = document.getElementById("yeni-hasta-penceresi");
const yeniHastaFormu = document.getElementById("yeni-hasta-formu");

function depodanOku() {
  try {
    return JSON.parse(localStorage.getItem(DEPO_ANAHTARI)) || [];
  } catch {
    return [];
  }
}

function depoyaYaz(yeniListe) {
  try {
    localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(yeniListe));
  } catch {
    alert("Hasta bilgileri kaydedilemedi: tarayıcı deposuna yazılamıyor.");
    return false;
  }
  hastalar = yeniListe;
  return true;
}

/*
 * Hasta No: 1'den başlayıp artan, değişmeyen ve asla yeniden kullanılmayan numara.
 * Sunucudaki röntgen ve görseller hastaya bu numarayla bağlanır (README).
 * Son verilen numara ayrıca saklanır; böylece bir kayıt silinse de numarası başkasına verilmez.
 */
const SON_HASTA_NO_ANAHTARI = "klinik.sonHastaNo";

function sonHastaNo() {
  const sakli = Number(localStorage.getItem(SON_HASTA_NO_ANAHTARI)) || 0;
  return Math.max(sakli, ...hastalar.map((h) => h.hastaNo || 0));
}

function sonHastaNoyuSakla(no) {
  try {
    localStorage.setItem(SON_HASTA_NO_ANAHTARI, String(no));
  } catch {
    // Hasta kaydı da yazılamayacağı için hata orada gösterilir
  }
}

function yeniHastaNo() {
  const no = sonHastaNo() + 1;
  sonHastaNoyuSakla(no);
  return no;
}

// Numara özelliğinden önce eklenmiş hastalara, eklenme sırasıyla numara verir
function eskiHastalaraNumaraVer() {
  if (hastalar.every((h) => Number.isInteger(h.hastaNo))) return;
  let no = sonHastaNo();
  const numarali = hastalar.map((h) => (Number.isInteger(h.hastaNo) ? h : { ...h, hastaNo: ++no }));
  sonHastaNoyuSakla(no);
  depoyaYaz(numarali);
}

const acikHasta = () => hastalar.find((h) => h.id === acikHastaId);

function acikHastayiGuncelle(alanlar) {
  return depoyaYaz(hastalar.map((h) => (h.id === acikHastaId ? { ...h, ...alanlar } : h)));
}

function yasHesapla(tarih) {
  if (!tarih) return "-";
  const [yil, ay, gun] = tarih.split("-").map(Number);
  const bugun = new Date();
  const buAy = bugun.getMonth() + 1;
  const dogumGunuGelmedi = buAy < ay || (buAy === ay && bugun.getDate() < gun);
  return bugun.getFullYear() - yil - (dogumGunuGelmedi ? 1 : 0);
}

function bugununTarihi() {
  const d = new Date();
  const iki = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
}

const yeniKimlik = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const kucult = (metin) => metin.toLocaleLowerCase("tr");
const tamAd = (hasta) => `${hasta.ad} ${hasta.soyad}`;

function alanlariKur(form) {
  const sablon = document.getElementById("hasta-alanlari");
  form.querySelector(".alanlar").append(sablon.content.cloneNode(true));
  const { tc, dogumTarihi, yas } = form.elements;
  dogumTarihi.max = bugununTarihi();
  dogumTarihi.addEventListener("input", () => {
    yas.value = yasHesapla(dogumTarihi.value);
  });
  tc.addEventListener("input", () => {
    tc.value = tc.value.replace(/\D/g, "");
    tc.setCustomValidity("");
  });
}

function formuOku(form) {
  const e = form.elements;
  return {
    ad: e.ad.value.trim(),
    soyad: e.soyad.value.trim(),
    tc: e.tc.value,
    dogumTarihi: e.dogumTarihi.value,
    ozelBilgi: e.ozelBilgi.value.trim(),
  };
}

function formuDoldur(form, hasta) {
  const e = form.elements;
  e.ad.value = hasta.ad;
  e.soyad.value = hasta.soyad;
  e.tc.value = hasta.tc;
  e.tc.setCustomValidity("");
  e.dogumTarihi.value = hasta.dogumTarihi;
  e.yas.value = yasHesapla(hasta.dogumTarihi);
  e.ozelBilgi.value = hasta.ozelBilgi;
}

function tcBenzersizMi(form, haricId) {
  const { tc } = form.elements;
  const kullanimda = hastalar.some((h) => h.tc === tc.value && h.id !== haricId);
  tc.setCustomValidity(kullanimda ? "Bu TC kimlik numarası başka bir hastada kayıtlı." : "");
  return tc.reportValidity();
}

function listeyiCiz() {
  const aranan = kucult(aramaKutusu.value.trim().replace(/\s+/g, " "));
  const gorunen = hastalar
    .filter((h) => kucult(`${h.hastaNo} ${tamAd(h)} ${h.tc}`).includes(aranan))
    .sort((a, b) => tamAd(a).localeCompare(tamAd(b), "tr"));

  satirlar.replaceChildren(...gorunen.map((hasta) => {
    const satir = document.createElement("tr");
    const baglanti = document.createElement("a");
    baglanti.href = `#hasta/${hasta.id}`;
    baglanti.textContent = hasta.ad;
    const hucreler = [String(hasta.hastaNo), baglanti, hasta.soyad, hasta.tc, yasHesapla(hasta.dogumTarihi)].map((icerik) => {
      const hucre = document.createElement("td");
      hucre.append(icerik);
      return hucre;
    });
    satir.append(...hucreler);
    satir.addEventListener("click", () => {
      location.hash = `hasta/${hasta.id}`;
    });
    return satir;
  }));

  listeBos.hidden = gorunen.length > 0;
  listeBos.textContent = hastalar.length
    ? "Aramayla eşleşen hasta yok."
    : "Henüz hasta yok. İlk hastayı \"Yeni Hasta\" düğmesiyle ekleyin.";
}

function sayfaGoster(sayfa) {
  listeSayfasi.hidden = sayfa !== listeSayfasi;
  hastaSayfasi.hidden = sayfa !== hastaSayfasi;
  window.scrollTo(0, 0);
}

function listeyiGoster() {
  acikHastaId = null;
  listeyiCiz();
  sayfaGoster(listeSayfasi);
}

function hastayiAc(id) {
  const hasta = hastalar.find((h) => h.id === id);
  if (!hasta) {
    location.hash = "";
    return;
  }
  acikHastaId = id;
  hastaBasligi.textContent = tamAd(hasta);
  document.getElementById("hasta-no-etiketi").textContent = `Hasta No: ${hasta.hastaNo}`;
  formuDoldur(hastaFormu, hasta);
  kayitDurumu.textContent = "";
  islemleriSifirla();
  disKayitlariniGoster();
  sekmeGoster("dis");
  sayfaGoster(hastaSayfasi);
}

const kaydedilmemisVar = () => formDegisti || islemTaslakDegisti;

function yonlendir() {
  const eslesme = location.hash.match(/^#hasta\/([a-z0-9]+)$/);
  const id = eslesme ? eslesme[1] : null;
  if (id !== null && id === acikHastaId) return;
  if (kaydedilmemisVar()) {
    if (!confirm("Kaydedilmemiş değişiklikler silinecek. Çıkılsın mı?")) {
      location.hash = `hasta/${acikHastaId}`;
      return;
    }
    formDegisti = false;
    islemTaslakDegisti = false;
  }
  if (id) hastayiAc(id);
  else listeyiGoster();
}

eskiHastalaraNumaraVer();
alanlariKur(hastaFormu);
alanlariKur(yeniHastaFormu);
const disPaneli = paneliBaslat(taslakDisleriniGuncelle, disiGeriGetir);

aramaKutusu.addEventListener("input", listeyiCiz);

document.getElementById("yeni-hasta-dugmesi").addEventListener("click", () => {
  yeniHastaFormu.reset();
  yeniHastaFormu.elements.tc.setCustomValidity("");
  yeniHastaFormu.elements.yas.value = "-";
  yeniHastaPenceresi.showModal();
});

document.getElementById("yeni-hasta-iptal").addEventListener("click", () => {
  yeniHastaPenceresi.close();
});

yeniHastaFormu.addEventListener("submit", (olay) => {
  olay.preventDefault();
  if (!tcBenzersizMi(yeniHastaFormu, null)) return;
  const id = yeniKimlik();
  if (!depoyaYaz([...hastalar, { id, hastaNo: yeniHastaNo(), ...formuOku(yeniHastaFormu) }])) return;
  yeniHastaPenceresi.close();
  location.hash = `hasta/${id}`;
});

hastaFormu.addEventListener("input", () => {
  formDegisti = true;
  kayitDurumu.textContent = "";
});

hastaFormu.addEventListener("submit", (olay) => {
  olay.preventDefault();
  if (!tcBenzersizMi(hastaFormu, acikHastaId)) return;
  const veri = formuOku(hastaFormu);
  if (!depoyaYaz(hastalar.map((h) => (h.id === acikHastaId ? { ...h, ...veri } : h)))) return;
  formDegisti = false;
  hastaBasligi.textContent = tamAd(veri);
  kayitDurumu.textContent = "Kaydedildi";
});

window.addEventListener("hashchange", yonlendir);
window.addEventListener("beforeunload", (olay) => {
  if (kaydedilmemisVar()) olay.preventDefault();
});

yonlendir();
