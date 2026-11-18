"use strict";

/*
 * Hastalar sunucudaki "hastalar" koleksiyonunda (SUNUCU-BAGLANTISI.md §3, §3b).
 * - Hasta No'yu sunucu verir; panel numara üretmez.
 * - Her güncellemede beklenenGuncelleme gönderilir. 409 gelirse kayıt yeniden çekilir ve
 *   değişiklik güncel kaydın üzerine yeniden uygulanır (hastayiSunucudaGuncelle).
 * - Başka bilgisayardaki değişiklikler anlık abonelikle ekrana yansır.
 */

const FORM_ALANLARI = ["ad", "soyad", "tc", "dogumTarihi", "ozelBilgi"];
const ALAN_ADLARI = { ad: "Ad", soyad: "Soyad", tc: "TC Kimlik No", dogumTarihi: "Doğum Tarihi", ozelBilgi: "Özel Bilgi" };
const EN_FAZLA_DENEME = 5;

let hastalar = [];
let acikHastaId = null;
let formDegisti = false;
let formTabani = null; // formun en son sunucudan doldurulduğu andaki değerler

const tumSayfalar = [...document.querySelectorAll(".sayfa")];
const girisSayfasi = document.getElementById("giris-sayfasi");
const listeSayfasi = document.getElementById("liste-sayfasi");
const hastaSayfasi = document.getElementById("hasta-sayfasi");
const eslesmeyenSayfasi = document.getElementById("eslesmeyen-sayfasi");
const aramaKutusu = document.getElementById("hasta-arama");
const satirlar = document.getElementById("hasta-satirlari");
const listeBos = document.getElementById("liste-bos");
const hastaBasligi = document.getElementById("hasta-basligi");
const hastaNoEtiketi = document.getElementById("hasta-no-etiketi");
const hastaFormu = document.getElementById("hasta-formu");
const kayitDurumu = document.getElementById("kayit-durumu");
const formCakismasi = document.getElementById("form-cakisma");
const formCakismaMetni = document.getElementById("form-cakisma-metni");
const yeniHastaPenceresi = document.getElementById("yeni-hasta-penceresi");
const yeniHastaFormu = document.getElementById("yeni-hasta-formu");
const girisFormu = document.getElementById("giris-formu");
const girisMesaji = document.getElementById("giris-mesaji");
const kullaniciCubugu = document.getElementById("kullanici-cubugu");

/* Önbellek */

const hastaBul = (id) => hastalar.find((h) => h.id === id);
const acikHasta = () => hastaBul(acikHastaId);

// Daha eski bir sürüm (geç gelen anlık olay) yenisinin üstüne yazılmaz
function hastayiOnbellegeKoy(kayit) {
  const sira = hastalar.findIndex((h) => h.id === kayit.id);
  if (sira < 0) hastalar.push(kayit);
  else if (hastalar[sira].updated <= kayit.updated) hastalar[sira] = kayit;
  else return false;
  return true;
}

async function hastalariYukle() {
  hastalar = await istek(() => pb.collection("hastalar").getFullList({ sort: "hastaNo" }));
}

/*
 * degistir(guncelHasta) gönderilecek alanları döndürür; değişiklik güncel kayda
 * uygulanamıyorsa CakismaHatasi atar. 409'da kayıt yeniden çekilip degistir tekrar çağrılır.
 */
async function hastayiSunucudaGuncelle(id, degistir) {
  for (let deneme = 0; deneme < EN_FAZLA_DENEME; deneme++) {
    const guncel = hastaBul(id);
    const alanlar = degistir(guncel);
    try {
      const kayit = await istek(() => pb.collection("hastalar").update(id, {
        ...alanlar,
        beklenenGuncelleme: guncel.updated,
      }));
      hastayiOnbellegeKoy(kayit);
      return kayit;
    } catch (hata) {
      if (hata.status !== 409) throw hata;
      hastayiOnbellegeKoy(await istek(() => pb.collection("hastalar").getOne(id)));
    }
  }
  throw new CakismaHatasi("Bu hasta aynı anda başka bilgisayarlarda değiştiriliyor. Lütfen tekrar deneyin.");
}

// islemler.js ve dis_kayitlari.js buradan kaydeder; başarısızsa null döner
async function acikHastayiGuncelle(degistir) {
  const id = acikHastaId;
  try {
    const kayit = await hastayiSunucudaGuncelle(id, degistir);
    hastaDegisti(kayit);
    return kayit;
  } catch (hata) {
    kayitHatasiniGoster(hata);
    if (id === acikHastaId) hastaDegisti(acikHasta());
    return null;
  }
}

/* Yardımcılar */

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
const alanDegeri = (hasta, alan) => hasta[alan] || "";

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
  FORM_ALANLARI.forEach((alan) => {
    e[alan].value = alanDegeri(hasta, alan);
  });
  e.tc.setCustomValidity("");
  e.yas.value = yasHesapla(hasta.dogumTarihi);
}

function hastaFormunuSunucudanDoldur(hasta) {
  formuDoldur(hastaFormu, hasta);
  formTabani = Object.fromEntries(FORM_ALANLARI.map((a) => [a, alanDegeri(hasta, a)]));
  formDegisti = false;
  formCakismasi.hidden = true;
}

function tcKullanimdaMi(form, haricId) {
  const { tc } = form.elements;
  const kullanimda = hastalar.some((h) => tc.value && h.tc === tc.value && h.id !== haricId);
  tc.setCustomValidity(kullanimda ? "Bu TC kimlik numarası başka bir hastada kayıtlı." : "");
  return !tc.reportValidity();
}

// Sunucu TC çakışmasını 400 ile bildirir
function tcHatasiysaGoster(form, hata) {
  if (hata.status !== 400 || !hata.response?.data?.tc) return false;
  form.elements.tc.setCustomValidity("Bu TC kimlik numarası başka bir hastada kayıtlı.");
  form.elements.tc.reportValidity();
  return true;
}

/* Ekranlar */

function sayfaGoster(sayfa) {
  tumSayfalar.forEach((s) => {
    s.hidden = s !== sayfa;
  });
  window.scrollTo(0, 0);
}

function listeyiCiz() {
  const aranan = kucult(aramaKutusu.value.trim().replace(/\s+/g, " "));
  const gorunen = hastalar
    .filter((h) => kucult(`${h.hastaNo} ${tamAd(h)} ${h.tc || ""}`).includes(aranan))
    .sort((a, b) => tamAd(a).localeCompare(tamAd(b), "tr"));

  satirlar.replaceChildren(...gorunen.map((hasta) => {
    const satir = document.createElement("tr");
    const baglanti = document.createElement("a");
    baglanti.href = `#hasta/${hasta.id}`;
    baglanti.textContent = hasta.ad;
    const hucreler = [String(hasta.hastaNo), baglanti, hasta.soyad, hasta.tc || "-", yasHesapla(hasta.dogumTarihi)]
      .map((icerik) => {
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

function listeyiGoster() {
  acikHastaId = null;
  listeyiCiz();
  eslesmeyenSayisiniGuncelle();
  sayfaGoster(listeSayfasi);
}

function baslikGoster(hasta) {
  hastaBasligi.textContent = tamAd(hasta);
  hastaNoEtiketi.textContent = `Hasta No: ${hasta.hastaNo}`;
}

function hastayiAc(id) {
  const hasta = hastaBul(id);
  if (!hasta) {
    location.hash = "";
    return;
  }
  acikHastaId = id;
  baslikGoster(hasta);
  hastaFormunuSunucudanDoldur(hasta);
  kayitDurumu.textContent = "";
  islemleriSifirla();
  disKayitlariniGoster();
  sekmeGoster("dis");
  sayfaGoster(hastaSayfasi);
}

const degisenFormAlanlari = (hasta) => FORM_ALANLARI.filter((a) => alanDegeri(hasta, a) !== formTabani[a]);

// Önbellekteki bir hasta değişince (kendi kaydımız ya da başka bilgisayar) ekranları tazeler
function hastaDegisti(hasta) {
  if (!listeSayfasi.hidden) listeyiCiz();
  if (!hasta || hasta.id !== acikHastaId) return;
  baslikGoster(hasta);
  if (!islemTaslagi) islemleriCiz();
  disKayitlariniGoster();
  if (!degisenFormAlanlari(hasta).length) return;
  if (!formDegisti) hastaFormunuSunucudanDoldur(hasta);
  else formCakismasiniGoster(hasta, degisenFormAlanlari(hasta));
}

function formCakismasiniGoster(hasta, alanlar) {
  const ayrinti = alanlar.map((a) => `${ALAN_ADLARI[a]}: "${alanDegeri(hasta, a) || "-"}"`).join(", ");
  formCakismaMetni.textContent = `Bu hasta başka bir bilgisayarda değiştirildi. Sunucudaki hali: ${ayrinti}`;
  formCakismasi.hidden = false;
}

const kaydedilmemisVar = () => formDegisti || islemTaslakDegisti;

function yonlendir() {
  if (!pb || !pb.authStore.isValid) return;
  const eslesme = location.hash.match(/^#hasta\/([a-z0-9]+)$/);
  const id = eslesme ? eslesme[1] : null;
  const eslesmeyenler = location.hash === "#eslesmeyenler";
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
  else if (eslesmeyenler) eslesmeyenleriGoster();
  else listeyiGoster();
}

/* Oturum */

function kullaniciCubugunuGoster() {
  const k = kullanici();
  document.getElementById("kullanici-adi").textContent = `${k.name || k.email}${k.rol ? ` (${k.rol})` : ""}`;
  kullaniciCubugu.hidden = false;
}

function girisEkraniniGoster(mesaj = "") {
  kullaniciCubugu.hidden = true;
  girisMesaji.textContent = mesaj;
  sayfaGoster(girisSayfasi);
  girisFormu.elements.eposta.focus();
}

function oturumuBitir(mesaj) {
  oturumuKapat();
  hastalar = [];
  acikHastaId = null;
  formDegisti = false;
  islemTaslakDegisti = false;
  [yeniHastaPenceresi, disKayitPenceresi, goruntuleyici].forEach((p) => p.open && p.close());
  girisEkraniniGoster(mesaj);
}

async function oturumuAc() {
  kullaniciCubugunuGoster();
  try {
    await hastalariYukle();
    await anlikGuncellemeleriBaslat({
      hastalar: hastaOlayi,
      rontgenler: rontgenOlayi,
      gorseller: gorselOlayi,
      yenidenBaglandi,
    });
  } catch (hata) {
    if (!genelHatayiIsle(hata)) bildir(`Sunucudan veri alınamadı: ${hata.message}`);
    return;
  }
  acikHastaId = null;
  yonlendir();
}

async function uygulamayiBaslat() {
  if (!pb) {
    tasimaEkraniniGoster();
    return;
  }
  if (!pb.authStore.isValid) {
    girisEkraniniGoster();
    return;
  }
  try {
    await pb.collection("users").authRefresh();
  } catch (hata) {
    if (agHatasiMi(hata)) baglantiSorunu(true);
    else girisEkraniniGoster("Oturumun süresi doldu. Lütfen yeniden giriş yapın.");
    return;
  }
  await oturumuAc();
}

/* Anlık olaylar */

function hastaOlayi({ action, record }) {
  if (action === "delete") {
    hastalar = hastalar.filter((h) => h.id !== record.id);
    if (record.id === acikHastaId) {
      bildir("Açık olan hasta kaydı sunucudan silindi.");
      formDegisti = false;
      islemTaslakDegisti = false;
      location.hash = "";
    } else if (!listeSayfasi.hidden) listeyiCiz();
    return;
  }
  if (hastayiOnbellegeKoy(record)) hastaDegisti(record);
}

// Bağlantı koptuğunda kaçan olaylar için açık ekran yeniden çekilir
async function yenidenBaglandi() {
  try {
    await hastalariYukle();
  } catch {
    return;
  }
  if (!listeSayfasi.hidden) listeyiCiz();
  if (acikHastaId) {
    if (acikHasta()) hastaDegisti(acikHasta());
    acikGaleriyiTazele();
  }
  eslesmeyenSayisiniGuncelle();
  if (!eslesmeyenSayfasi.hidden) eslesmeyenleriCiz();
}

/* Olaylar */

oturumBittiIsleyicisi = oturumuBitir;
yenidenDeneIsleyicisi = () => (pb.authStore.isValid && !hastalar.length ? uygulamayiBaslat() : yenidenBaglandi());

alanlariKur(hastaFormu);
alanlariKur(yeniHastaFormu);
const disPaneli = paneliBaslat(taslakDisleriniGuncelle, disiGeriGetir);

aramaKutusu.addEventListener("input", listeyiCiz);

girisFormu.addEventListener("submit", async (olay) => {
  olay.preventDefault();
  const dugme = girisFormu.querySelector('button[type="submit"]');
  dugme.disabled = true;
  girisMesaji.textContent = "Giriş yapılıyor...";
  try {
    await girisYap(girisFormu.elements.eposta.value.trim(), girisFormu.elements.sifre.value);
    girisFormu.reset();
    girisMesaji.textContent = "";
    await oturumuAc();
  } catch (hata) {
    girisMesaji.textContent = agHatasiMi(hata) ? "Sunucuya bağlanılamıyor." : "E-posta veya şifre hatalı.";
  } finally {
    dugme.disabled = false;
  }
});

document.getElementById("cikis-dugmesi").addEventListener("click", () => {
  if (kaydedilmemisVar() && !confirm("Kaydedilmemiş değişiklikler silinecek. Çıkış yapılsın mı?")) return;
  oturumuBitir("");
});

document.getElementById("yeni-hasta-dugmesi").addEventListener("click", () => {
  yeniHastaFormu.reset();
  yeniHastaFormu.elements.tc.setCustomValidity("");
  yeniHastaFormu.elements.yas.value = "-";
  yeniHastaPenceresi.showModal();
});

document.getElementById("yeni-hasta-iptal").addEventListener("click", () => {
  yeniHastaPenceresi.close();
});

yeniHastaFormu.addEventListener("submit", async (olay) => {
  olay.preventDefault();
  if (tcKullanimdaMi(yeniHastaFormu, null)) return;
  const dugme = yeniHastaFormu.querySelector('button[type="submit"]');
  dugme.disabled = true;
  try {
    const kayit = await istek(() => pb.collection("hastalar").create({
      ...formuOku(yeniHastaFormu),
      islemler: [],
      eksikDisler: [],
      disKayitlari: [],
    }));
    hastayiOnbellegeKoy(kayit);
    yeniHastaPenceresi.close();
    location.hash = `hasta/${kayit.id}`;
  } catch (hata) {
    if (!tcHatasiysaGoster(yeniHastaFormu, hata)) kayitHatasiniGoster(hata);
  } finally {
    dugme.disabled = false;
  }
});

hastaFormu.addEventListener("input", () => {
  formDegisti = true;
  kayitDurumu.textContent = "";
});

// Yalnızca kullanıcının değiştirdiği alanlar gönderilir. Aynı alanı başka bilgisayar da
// değiştirdiyse kayıt yapılmaz, kullanıcının yazdığı formda kalır ve uyarı çıkar.
async function hastaFormunuKaydet() {
  if (tcKullanimdaMi(hastaFormu, acikHastaId)) return;
  const veri = formuOku(hastaFormu);
  const taban = formTabani;
  const kayitDugmesi = hastaFormu.querySelector('button[type="submit"]');
  kayitDugmesi.disabled = true;
  kayitDurumu.textContent = "Kaydediliyor...";
  try {
    const kayit = await hastayiSunucudaGuncelle(acikHastaId, (guncel) => {
      const cakisan = FORM_ALANLARI.filter((a) => (
        alanDegeri(guncel, a) !== taban[a] && alanDegeri(guncel, a) !== veri[a] && veri[a] !== taban[a]
      ));
      if (cakisan.length) {
        formCakismasiniGoster(guncel, cakisan);
        throw new CakismaHatasi("Bu hasta başka bir bilgisayarda değiştirildi. Formdaki uyarıya bakın.");
      }
      return Object.fromEntries(FORM_ALANLARI.filter((a) => veri[a] !== taban[a]).map((a) => [a, veri[a]]));
    });
    hastaFormunuSunucudanDoldur(kayit);
    hastaDegisti(kayit);
    kayitDurumu.textContent = "Kaydedildi";
  } catch (hata) {
    kayitDurumu.textContent = "";
    if (!tcHatasiysaGoster(hastaFormu, hata)) kayitHatasiniGoster(hata);
  } finally {
    kayitDugmesi.disabled = false;
  }
}

hastaFormu.addEventListener("submit", (olay) => {
  olay.preventDefault();
  hastaFormunuKaydet();
});

// "Benimkini kaydet": sunucudaki hali taban kabul edip kullanıcının yazdığıyla üzerine yazar
document.getElementById("form-cakisma-benimki").addEventListener("click", () => {
  const guncel = acikHasta();
  formTabani = Object.fromEntries(FORM_ALANLARI.map((a) => [a, alanDegeri(guncel, a)]));
  formCakismasi.hidden = true;
  hastaFormunuKaydet();
});

document.getElementById("form-cakisma-sunucu").addEventListener("click", () => {
  hastaFormunuSunucudanDoldur(acikHasta());
});

window.addEventListener("hashchange", yonlendir);
window.addEventListener("beforeunload", (olay) => {
  if (kaydedilmemisVar()) olay.preventDefault();
});

uygulamayiBaslat();
