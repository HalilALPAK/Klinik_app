"use strict";

/*
 * Klinik sunucusuyla (PocketBase) konuşan katman. Sözleşme: SUNUCU-BAGLANTISI.md
 * Panel sunucunun kendisinden yayınlandığı için adres göreli: location.origin.
 * Panel file:// ile açılırsa sunucu yoktur; o zaman yalnızca taşıma ekranı çalışır (tasima.js).
 */

const SUNUCUDAN_ACILDI = location.protocol === "http:" || location.protocol === "https:";
const pb = SUNUCUDAN_ACILDI ? new PocketBase(location.origin) : null;
if (pb) pb.autoCancellation(false);

const OTURUM_TAZELEME_ARALIGI = 30 * 60 * 1000;

const baglantiBandi = document.getElementById("baglanti-bandi");
const baglantiMesaji = document.getElementById("baglanti-mesaji");
const bildirimKutusu = document.getElementById("bildirim");

// Kullanıcının değişikliği güncel kayda otomatik uygulanamadığında atılır
class CakismaHatasi extends Error {}

let oturumBittiIsleyicisi = () => {};
let yenidenDeneIsleyicisi = () => {};
let bildirimZamanlayici = null;

const kullanici = () => pb.authStore.record;
const doktorMu = () => kullanici()?.rol === "doktor";
const agHatasiMi = (hata) => hata && hata.status === 0 && !hata.isAbort;

function baglantiSorunu(varMi) {
  baglantiBandi.hidden = !varMi;
}

function bildir(mesaj) {
  bildirimKutusu.textContent = mesaj;
  bildirimKutusu.hidden = false;
  clearTimeout(bildirimZamanlayici);
  bildirimZamanlayici = setTimeout(() => {
    bildirimKutusu.hidden = true;
  }, 6000);
}

// Ağ ve oturum hatalarını ortak yerde ele alır; ele aldıysa true döner
function genelHatayiIsle(hata) {
  if (agHatasiMi(hata)) {
    baglantiSorunu(true);
    return true;
  }
  if (hata && hata.status === 401) {
    oturumBittiIsleyicisi("Oturumun süresi doldu. Lütfen yeniden giriş yapın.");
    return true;
  }
  return false;
}

// Sunucuya giden her istek bundan geçer
async function istek(islem) {
  if (!pb.authStore.isValid) {
    oturumBittiIsleyicisi("Oturumun süresi doldu. Lütfen yeniden giriş yapın.");
    throw new Error("oturum yok");
  }
  try {
    const sonuc = await islem();
    baglantiSorunu(false);
    return sonuc;
  } catch (hata) {
    genelHatayiIsle(hata);
    throw hata;
  }
}

// Kaydetme hatasını kullanıcıya anlatır (ağ ve oturum hataları zaten bantla gösterilir)
function kayitHatasiniGoster(hata) {
  if (hata instanceof CakismaHatasi) bildir(hata.message);
  else if (!genelHatayiIsle(hata) && hata.message !== "oturum yok") bildir(`Kaydedilemedi: ${hata.message}`);
}

// Authorization başlığı isteyen resimleri (röntgen önizlemesi) blob adresine çevirir
async function yetkiliResimAdresi(yol) {
  let cevap;
  try {
    cevap = await fetch(yol, { headers: { Authorization: pb.authStore.token } });
  } catch {
    baglantiSorunu(true);
    throw Object.assign(new Error("Sunucuya bağlanılamıyor"), { status: 0 });
  }
  if (!cevap.ok) {
    const hata = Object.assign(new Error(`Resim alınamadı (${cevap.status})`), { status: cevap.status });
    genelHatayiIsle(hata);
    throw hata;
  }
  baglantiSorunu(false);
  return URL.createObjectURL(await cevap.blob());
}

async function girisYap(eposta, sifre) {
  await pb.collection("users").authWithPassword(eposta, sifre);
}

function oturumuKapat() {
  pb.realtime.unsubscribe().catch(() => {});
  pb.authStore.clear();
}

// Açık kalan panelde token'ın süresi dolmasın diye düzenli tazelenir
setInterval(() => {
  if (pb && pb.authStore.isValid) pb.collection("users").authRefresh().catch(genelHatayiIsle);
}, OTURUM_TAZELEME_ARALIGI);

/*
 * Anlık güncelleme: isleyiciler = { hastalar, rontgenler, gorseller, yenidenBaglandi }.
 * Bağlantı koparsa SDK yeniden bağlanır; arada kaçan olaylar için yenidenBaglandi çağrılır.
 */
async function anlikGuncellemeleriBaslat(isleyiciler) {
  let ilkBaglanti = true;
  pb.realtime.onDisconnect = (abonelikler) => {
    if (abonelikler.length) baglantiSorunu(true);
  };
  await pb.realtime.subscribe("PB_CONNECT", () => {
    baglantiSorunu(false);
    if (!ilkBaglanti) isleyiciler.yenidenBaglandi();
    ilkBaglanti = false;
  });
  for (const koleksiyon of ["hastalar", "rontgenler", "gorseller"]) {
    await pb.collection(koleksiyon).subscribe("*", isleyiciler[koleksiyon]);
  }
}

document.getElementById("baglanti-tekrar").addEventListener("click", () => yenidenDeneIsleyicisi());
