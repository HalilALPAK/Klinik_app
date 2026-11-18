"use strict";

/*
 * Bir kerelik taşıma (SUNUCU-BAGLANTISI.md §6). Eski panel veriyi tarayıcının file://
 * deposunda tuttuğu için bu araçlar yalnızca panel index.html dosyasından açılınca görünür;
 * sunucu adresindeki panel o depoyu okuyamaz.
 *  1. Hastaları dışa aktar: { surum, sonHastaNo, hastalar } JSON dosyası. USB ile sunucuya taşınır.
 *  2. Görselleri sunucuya yükle: IndexedDB'deki eski görsel ve röntgen resimleri "gorseller"
 *     tablosuna, sunucuya aktarılmış hastanın eskiId alanıyla eşleştirilerek yüklenir.
 */

const ESKI_HASTALAR = "klinik.hastalar";
const ESKI_SON_HASTA_NO = "klinik.sonHastaNo";
const YUKLENEN_GORSELLER = "klinik.sunucuyaYuklenenGorseller";
const SUNUCU_ADRESI = "klinik.tasimaSunucuAdresi";

const tasimaSayfasi = document.getElementById("tasima-sayfasi");
const tasimaOzeti = document.getElementById("tasima-ozeti");
const tasimaYuklemeFormu = document.getElementById("tasima-yukleme-formu");
const tasimaDurumu = document.getElementById("tasima-durumu");

function eskiJson(anahtar, bos) {
  try {
    return JSON.parse(localStorage.getItem(anahtar)) || bos;
  } catch {
    return bos;
  }
}

// Numara özelliğinden önce eklenmiş hastalara, eklenme sırasıyla Hasta No verir ve saklar
function numaraliEskiHastalar() {
  const liste = eskiJson(ESKI_HASTALAR, []);
  let son = Math.max(Number(localStorage.getItem(ESKI_SON_HASTA_NO)) || 0, ...liste.map((h) => h.hastaNo || 0));
  if (liste.some((h) => !Number.isInteger(h.hastaNo))) {
    const numarali = liste.map((h) => (Number.isInteger(h.hastaNo) ? h : { ...h, hastaNo: ++son }));
    localStorage.setItem(ESKI_HASTALAR, JSON.stringify(numarali));
    localStorage.setItem(ESKI_SON_HASTA_NO, String(son));
    return { liste: numarali, son };
  }
  return { liste, son };
}

// Eski IndexedDB'yi okur; hiç oluşturulmamışsa boş liste döner (yeni depo açmaz)
function eskiDosyalar() {
  return new Promise((tamam) => {
    const istek = indexedDB.open("klinik_dosyalar");
    istek.onupgradeneeded = () => istek.transaction.abort();
    istek.onerror = () => tamam([]);
    istek.onsuccess = () => {
      const db = istek.result;
      if (!db.objectStoreNames.contains("gorseller")) {
        db.close();
        tamam([]);
        return;
      }
      const hepsi = db.transaction("gorseller").objectStore("gorseller").getAll();
      hepsi.onsuccess = () => {
        db.close();
        tamam(hepsi.result);
      };
      hepsi.onerror = () => tamam([]);
    };
  });
}

function hastalariDisaAktar() {
  const { liste, son } = numaraliEskiHastalar();
  const icerik = JSON.stringify({ surum: 1, sonHastaNo: son, hastalar: liste }, null, 2);
  const baglanti = document.createElement("a");
  baglanti.href = URL.createObjectURL(new Blob([icerik], { type: "application/json" }));
  baglanti.download = `klinik_hastalar_${bugununTarihi()}.json`;
  baglanti.click();
  setTimeout(() => URL.revokeObjectURL(baglanti.href), 1000);
}

async function gorselleriSunucuyaYukle(adres, eposta, sifre) {
  const sunucu = new PocketBase(adres.replace(/\/+$/, ""));
  sunucu.autoCancellation(false);
  tasimaDurumu.textContent = "Sunucuya giriş yapılıyor...";
  try {
    await sunucu.collection("users").authWithPassword(eposta, sifre);
  } catch (hata) {
    if (agHatasiMi(hata)) throw hata;
    throw new Error("E-posta veya şifre hatalı.");
  }

  const sunucuHastalari = await sunucu.collection("hastalar").getFullList({ fields: "id,eskiId" });
  const eskidenYeniye = new Map(sunucuHastalari.filter((h) => h.eskiId).map((h) => [h.eskiId, h.id]));
  const yuklenenler = new Set(eskiJson(YUKLENEN_GORSELLER, []));
  const dosyalar = await eskiDosyalar();
  let yuklenen = 0;
  let eslesmeyen = 0;

  for (const [i, kayit] of dosyalar.entries()) {
    tasimaDurumu.textContent = `Yükleniyor: ${i + 1} / ${dosyalar.length}`;
    if (yuklenenler.has(kayit.id)) continue;
    const hastaId = eskidenYeniye.get(kayit.hastaId);
    if (!hastaId) {
      eslesmeyen += 1;
      continue;
    }
    const veri = new FormData();
    veri.append("hasta", hastaId);
    veri.append("dosya", new File([kayit.dosya], kayit.ad, { type: kayit.dosya.type }));
    veri.append("tur", "orijinal");
    veri.append("kaynak", "panel");
    veri.append("ad", kayit.ad);
    veri.append("aciklama", kayit.tur === "rontgen" ? "Eski panelden aktarılan röntgen resmi" : "");
    await sunucu.collection("gorseller").create(veri);
    yuklenenler.add(kayit.id);
    localStorage.setItem(YUKLENEN_GORSELLER, JSON.stringify([...yuklenenler]));
    yuklenen += 1;
  }
  sunucu.authStore.clear();
  const ekBilgi = eslesmeyen
    ? ` ${eslesmeyen} dosyanın hastası sunucuda bulunamadı; önce hastaların sunucuya aktarılması gerekiyor.`
    : "";
  tasimaDurumu.textContent = `Bitti: ${yuklenen} dosya yüklendi.${ekBilgi}`;
}

async function tasimaEkraniniGoster() {
  const { liste } = numaraliEskiHastalar();
  const dosyalar = await eskiDosyalar();
  tasimaOzeti.textContent = `Bu tarayıcıda ${liste.length} hasta ve ${dosyalar.length} görsel/röntgen dosyası var.`;
  tasimaYuklemeFormu.elements.adres.value = localStorage.getItem(SUNUCU_ADRESI) || "";
  sayfaGoster(tasimaSayfasi);
}

document.getElementById("tasima-disa-aktar").addEventListener("click", hastalariDisaAktar);

tasimaYuklemeFormu.addEventListener("submit", async (olay) => {
  olay.preventDefault();
  const e = tasimaYuklemeFormu.elements;
  const dugme = tasimaYuklemeFormu.querySelector('button[type="submit"]');
  localStorage.setItem(SUNUCU_ADRESI, e.adres.value.trim());
  dugme.disabled = true;
  try {
    await gorselleriSunucuyaYukle(e.adres.value.trim(), e.eposta.value.trim(), e.sifre.value);
  } catch (hata) {
    let neden = hata.message;
    if (agHatasiMi(hata)) neden = "Sunucuya bağlanılamıyor. Adresi ve ağ bağlantısını kontrol edin.";
    tasimaDurumu.textContent = `Yükleme durdu: ${neden} Tekrar denenebilir; yüklenenler yeniden yüklenmez.`;
  } finally {
    e.sifre.value = "";
    dugme.disabled = false;
  }
});
