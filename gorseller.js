"use strict";

/*
 * Hasta sekmeleri ve röntgen / görsel galerileri.
 * Dosyalar localStorage'a sığmayacağı için IndexedDB'de tutulur:
 * { id, hastaId, tur: "rontgen" | "gorsel", ad, tarih, eklenme, dosya }
 */

const DOSYA_DB_ADI = "klinik_dosyalar";
const DOSYA_DEPOSU = "gorseller";

const sekmeDugmeleri = [...document.querySelectorAll(".sekme")];
const sekmeIcerikleri = [...document.querySelectorAll(".sekme-icerik")];
const galeriler = [...document.querySelectorAll(".galeri")];
const goruntuleyici = document.getElementById("gorsel-goruntuleyici");
const goruntuAlani = document.getElementById("goruntu-alani");
const goruntuResmi = document.getElementById("goruntu-resmi");
const goruntuBasligi = document.getElementById("goruntu-basligi");
const goruntuOnceki = document.getElementById("goruntu-onceki");
const goruntuSonraki = document.getElementById("goruntu-sonraki");

let dosyaDbSozu = null;
const galeriUrlleri = new Map(); // galeri öğesi -> o an gösterilen resim adresleri
let gosterilenler = [];
let gosterilenSira = 0;

function dosyaDbAc() {
  if (!dosyaDbSozu) {
    dosyaDbSozu = new Promise((tamam, hata) => {
      const istek = indexedDB.open(DOSYA_DB_ADI, 1);
      istek.onupgradeneeded = () => {
        istek.result.createObjectStore(DOSYA_DEPOSU, { keyPath: "id" }).createIndex("hastaId", "hastaId");
      };
      istek.onsuccess = () => tamam(istek.result);
      istek.onerror = () => hata(istek.error);
    });
  }
  return dosyaDbSozu;
}

async function dosyaDeposu(mod, islem) {
  const db = await dosyaDbAc();
  return new Promise((tamam, hata) => {
    const islemKaydi = db.transaction(DOSYA_DEPOSU, mod);
    const istek = islem(islemKaydi.objectStore(DOSYA_DEPOSU));
    islemKaydi.oncomplete = () => tamam(istek.result);
    islemKaydi.onerror = () => hata(islemKaydi.error);
    islemKaydi.onabort = () => hata(islemKaydi.error);
  });
}

function sekmeGoster(ad) {
  sekmeDugmeleri.forEach((d) => d.setAttribute("aria-pressed", String(d.dataset.sekme === ad)));
  sekmeIcerikleri.forEach((icerik) => {
    icerik.hidden = icerik.id !== `sekme-${ad}`;
  });
  const galeri = galeriler.find((g) => g.id === `sekme-${ad}`);
  if (galeri) galeriyiCiz(galeri);
}

const galeriDurumu = (galeri, metin) => {
  galeri.querySelector(".galeri-durum").textContent = metin;
};

function galeriKutucugu(kayit, url, sira, galeri, liste) {
  const kutu = document.createElement("figure");
  kutu.className = "galeri-oge";

  const ac = document.createElement("button");
  ac.type = "button";
  ac.className = "galeri-kucuk";
  ac.setAttribute("aria-label", `${kayit.ad} büyüt`);
  const resim = document.createElement("img");
  resim.src = url;
  resim.alt = kayit.ad;
  ac.append(resim);
  ac.addEventListener("click", () => goruntuleyiciyiAc(liste, sira));

  const yazi = document.createElement("figcaption");
  const ad = document.createElement("span");
  ad.className = "galeri-ad";
  ad.textContent = kayit.ad;
  ad.title = kayit.ad;
  const tarih = document.createElement("span");
  tarih.className = "galeri-tarih";
  tarih.textContent = tarihGoster(kayit.tarih);
  yazi.append(ad, tarih, ikonDugmesi(IKON_COP, `${kayit.ad} sil`, () => dosyayiSil(galeri, kayit)));

  kutu.append(ac, yazi);
  return kutu;
}

async function galeriyiCiz(galeri) {
  const hastaId = acikHastaId;
  let kayitlar;
  try {
    kayitlar = await dosyaDeposu("readonly", (depo) => depo.index("hastaId").getAll(hastaId));
  } catch {
    galeriDurumu(galeri, "Dosyalar okunamadı: tarayıcı deposuna erişilemiyor.");
    return;
  }
  if (hastaId !== acikHastaId) return;

  const gorunen = kayitlar.filter((k) => k.tur === galeri.dataset.tur).sort((a, b) => b.eklenme - a.eklenme);
  (galeriUrlleri.get(galeri) || []).forEach((url) => URL.revokeObjectURL(url));
  const liste = gorunen.map((kayit) => ({ kayit, url: URL.createObjectURL(kayit.dosya) }));
  galeriUrlleri.set(galeri, liste.map((o) => o.url));

  galeri.querySelector(".galeri-izgara").replaceChildren(
    ...liste.map(({ kayit, url }, i) => galeriKutucugu(kayit, url, i, galeri, liste)),
  );
  galeri.querySelector(".liste-bos").hidden = liste.length > 0;
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

async function dosyalariEkle(galeri, dosyalar) {
  const hastaId = acikHastaId;
  const reddedilen = [];
  galeriDurumu(galeri, "Yükleniyor...");
  try {
    for (const dosya of dosyalar) {
      if (await gosterilebilirMi(dosya)) {
        const kayit = {
          id: yeniKimlik(),
          hastaId,
          tur: galeri.dataset.tur,
          ad: dosya.name,
          tarih: bugununTarihi(),
          eklenme: Date.now(),
          dosya,
        };
        await dosyaDeposu("readwrite", (depo) => depo.put(kayit));
      } else {
        reddedilen.push(dosya.name);
      }
    }
  } catch {
    galeriDurumu(galeri, "Dosya kaydedilemedi: tarayıcı deposu dolu veya kullanılamıyor.");
    galeriyiCiz(galeri);
    return;
  }
  galeriDurumu(galeri, reddedilen.length
    ? `Bu dosyalar eklenemedi (JPG, PNG gibi bir resim olmalı): ${reddedilen.join(", ")}`
    : "");
  galeriyiCiz(galeri);
}

async function dosyayiSil(galeri, kayit) {
  if (!confirm(`"${kayit.ad}" silinsin mi?`)) return;
  try {
    await dosyaDeposu("readwrite", (depo) => depo.delete(kayit.id));
  } catch {
    galeriDurumu(galeri, "Dosya silinemedi.");
    return;
  }
  galeriyiCiz(galeri);
}

function goruntuyuGoster() {
  const { kayit, url } = gosterilenler[gosterilenSira];
  goruntuResmi.src = url;
  goruntuResmi.alt = kayit.ad;
  goruntuBasligi.textContent = `${kayit.ad} - ${tarihGoster(kayit.tarih)} (${gosterilenSira + 1}/${gosterilenler.length})`;
  goruntuAlani.classList.remove("buyuk");
}

function goruntuleyiciyiAc(liste, sira) {
  gosterilenler = liste;
  gosterilenSira = sira;
  goruntuOnceki.hidden = liste.length < 2;
  goruntuSonraki.hidden = liste.length < 2;
  goruntuyuGoster();
  goruntuleyici.showModal();
}

function goruntuyuKaydir(yon) {
  if (gosterilenler.length < 2) return;
  gosterilenSira = (gosterilenSira + yon + gosterilenler.length) % gosterilenler.length;
  goruntuyuGoster();
}

sekmeDugmeleri.forEach((d) => d.addEventListener("click", () => sekmeGoster(d.dataset.sekme)));

galeriler.forEach((galeri) => {
  const secici = galeri.querySelector('input[type="file"]');
  galeri.querySelector(".galeri-ekle").addEventListener("click", () => secici.click());
  secici.addEventListener("change", () => {
    const dosyalar = [...secici.files];
    secici.value = "";
    if (dosyalar.length) dosyalariEkle(galeri, dosyalar);
  });
});

goruntuOnceki.addEventListener("click", () => goruntuyuKaydir(-1));
goruntuSonraki.addEventListener("click", () => goruntuyuKaydir(1));
document.getElementById("goruntu-kapat").addEventListener("click", () => goruntuleyici.close());
goruntuResmi.addEventListener("click", () => goruntuAlani.classList.toggle("buyuk"));
goruntuleyici.addEventListener("keydown", (olay) => {
  if (olay.key === "ArrowLeft") goruntuyuKaydir(-1);
  else if (olay.key === "ArrowRight") goruntuyuKaydir(1);
});
