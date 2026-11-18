"use strict";

/*
 * Dişe sağ tıklayınca açılan menü ve dişin kendi kayıtları.
 * hasta.eksikDisler: [16, 26]
 * hasta.disKayitlari: [{ id, dis, tur: "islem" | "hastalik", ad }]
 * Öneriler ayrıca saklanmaz, tüm hastaların kayıtlarından üretilir.
 */

const KAYIT_TURLERI = {
  islem: { tekil: "İşlem", cogul: "İşlemler" },
  hastalik: { tekil: "Hastalık", cogul: "Hastalıklar" },
};
const EN_FAZLA_ONERI = 8;

const disPanelKabi = document.getElementById("dis-paneli");
const disMenusu = document.getElementById("dis-menusu");
const disIpucu = document.getElementById("dis-ipucu");
const disKayitPenceresi = document.getElementById("dis-kayit-penceresi");
const disKayitFormu = document.getElementById("dis-kayit-formu");
const disKayitBaslik = document.getElementById("dis-kayit-baslik");
const disKayitEtiket = document.getElementById("dis-kayit-etiket");
const disKayitAdi = document.getElementById("dis-kayit-adi");
const disKayitOnerileri = document.getElementById("dis-kayit-onerileri");

let kayitHedefi = null; // { dis, tur }
let seciliOneri = -1;
let menuDisOgesi = null;

const eksikDisler = () => acikHasta().eksikDisler || [];
const disKayitlari = () => acikHasta().disKayitlari || [];
const birDisinKayitlari = (no) => disKayitlari().filter((k) => k.dis === no);

// "IMPLANT" gibi noktasız I ile yazılan adlar da eşleşsin
const adEslesir = (ad, kelime) => kucult(ad).replace(/ı/g, "i").includes(kelime);
const adiGecenDisler = (kelime) => [...new Set(
  disKayitlari().filter((k) => k.tur === "islem" && adEslesir(k.ad, kelime)).map((k) => k.dis),
)];
const kanalliDisler = () => adiGecenDisler("kanal");
const implantliDisler = () => adiGecenDisler("implant");
// İmplant, çekilmiş dişin yerine konduğu için eksik sayılmaz
const disYokMu = (no) => eksikDisler().includes(no) && !implantliDisler().includes(no);

function disKayitlariniGoster() {
  const implantli = implantliDisler();
  disPaneli.durumAyarla(
    eksikDisler().filter((no) => !implantli.includes(no)),
    disKayitlari(),
    { kanalli: kanalliDisler(), implantli },
  );
}

// Değişiklikler güncel hasta kaydı üzerinde hesaplanır; sunucuda çakışma olursa yeniden uygulanır
const eksikleriDegistir = (degistir) => acikHastayiGuncelle((h) => ({ eksikDisler: degistir(h.eksikDisler || []) }));
const disKayitlariniDegistir = (degistir) => acikHastayiGuncelle((h) => ({ disKayitlari: degistir(h.disKayitlari || []) }));

async function disiSil(no) {
  if (!(await eksikleriDegistir((liste) => [...new Set([...liste, no])]))) return;
  const secim = disPaneli.secim();
  if (secim.includes(no)) {
    const yeniSecim = secim.filter((n) => n !== no);
    disPaneli.ayarla(yeniSecim);
    taslakDisleriniGuncelle(yeniSecim);
  }
}

function disiGeriGetir(no) {
  eksikleriDegistir((liste) => liste.filter((n) => n !== no));
}

function hazirIslemEkle(dis, ad) {
  const kayit = { id: yeniKimlik(), dis, tur: "islem", ad };
  disKayitlariniDegistir((liste) => [...liste, kayit]);
}

function kaydiSil(kayit) {
  if (!confirm(`"${kayit.ad}" kaydı silinsin mi?`)) return;
  disKayitlariniDegistir((liste) => liste.filter((k) => k.id !== kayit.id));
}

/* Sağ tık menüsü */

function menuDugmesi(yazi, eylem) {
  const dugme = document.createElement("button");
  dugme.type = "button";
  dugme.className = "menu-oge";
  dugme.textContent = yazi;
  dugme.addEventListener("click", () => {
    menuyuKapat();
    eylem();
  });
  return dugme;
}

function menuKayitSatiri(kayit) {
  const satir = document.createElement("div");
  satir.className = "menu-kayit";
  const yazi = document.createElement("span");
  yazi.textContent = `${KAYIT_TURLERI[kayit.tur].tekil}: ${kayit.ad}`;
  const sil = ikonDugmesi(IKON_IPTAL, `${kayit.ad} kaydını sil`, () => {
    menuyuKapat();
    kaydiSil(kayit);
  });
  satir.append(yazi, sil);
  return satir;
}

function menuyuAc(disOgesi, x, y) {
  const no = Number(disOgesi.dataset.no);
  const baslik = document.createElement("div");
  baslik.className = "menu-baslik";
  baslik.textContent = `Diş ${no}`;

  const implantVar = implantliDisler().includes(no);
  const kanalVar = kanalliDisler().includes(no);
  const implantOgesi = menuDugmesi("İmplant", () => hazirIslemEkle(no, "İmplant"));
  const ogeler = disYokMu(no)
    ? [menuDugmesi("Dişi Geri Getir", () => disiGeriGetir(no)), implantOgesi]
    : [
      ...(implantVar ? [] : [menuDugmesi("Dişi Sil", () => disiSil(no))]),
      menuDugmesi("İşlem Ekle", () => kayitPenceresiniAc(no, "islem")),
      menuDugmesi("Hastalık Ekle", () => kayitPenceresiniAc(no, "hastalik")),
      ...(kanalVar || implantVar ? [] : [menuDugmesi("Kanal Tedavisi", () => hazirIslemEkle(no, "Kanal Tedavisi"))]),
      ...(implantVar ? [] : [implantOgesi]),
    ];

  disMenusu.replaceChildren(baslik, ...ogeler, ...birDisinKayitlari(no).map(menuKayitSatiri));
  disMenusu.setAttribute("aria-label", `Diş ${no} menüsü`);
  disMenusu.hidden = false;
  disIpucu.hidden = true;
  menuDisOgesi = disOgesi;
  ekrandaKonumla(disMenusu, x, y);
  disMenusu.querySelector("button").focus({ preventScroll: true });
}

function menuyuKapat() {
  disMenusu.hidden = true;
  menuDisOgesi = null;
}

function ekrandaKonumla(oge, x, y) {
  const bosluk = 8;
  oge.style.left = `${Math.max(bosluk, Math.min(x, innerWidth - oge.offsetWidth - bosluk))}px`;
  oge.style.top = `${Math.max(bosluk, Math.min(y, innerHeight - oge.offsetHeight - bosluk))}px`;
}

/* Dişin üstüne gelince görünen kayıtlar */

function ipucunuDoldur(kayitlar) {
  const gruplar = Object.keys(KAYIT_TURLERI).flatMap((tur) => {
    const adlar = kayitlar.filter((k) => k.tur === tur).map((k) => k.ad);
    if (!adlar.length) return [];
    const baslik = document.createElement("strong");
    baslik.textContent = KAYIT_TURLERI[tur].cogul;
    const liste = document.createElement("ul");
    liste.append(...adlar.map((ad) => {
      const oge = document.createElement("li");
      oge.textContent = ad;
      return oge;
    }));
    return [baslik, liste];
  });
  disIpucu.replaceChildren(...gruplar);
}

function ipucunuGuncelle(olay) {
  const disOgesi = olay.target.closest(".dis");
  const no = disOgesi ? Number(disOgesi.dataset.no) : null;
  const kayitlar = no === null || disYokMu(no) ? [] : birDisinKayitlari(no);
  if (!kayitlar.length || !disMenusu.hidden) {
    disIpucu.hidden = true;
    return;
  }
  ipucunuDoldur(kayitlar);
  disIpucu.hidden = false;
  ekrandaKonumla(disIpucu, olay.clientX + 14, olay.clientY + 14);
}

/* İşlem / hastalık ekleme penceresi ve yazdıkça gelen öneriler */

function kayitliAdlar(tur) {
  const adlar = new Map();
  hastalar.forEach((hasta) => (hasta.disKayitlari || []).forEach((k) => {
    if (k.tur === tur) adlar.set(kucult(k.ad), k.ad);
  }));
  return [...adlar.values()];
}

function onerileriGuncelle() {
  const aranan = kucult(disKayitAdi.value.trim());
  const basliyorMu = (ad) => kucult(ad).startsWith(aranan);
  const adlar = !aranan ? [] : kayitliAdlar(kayitHedefi.tur)
    .filter((ad) => kucult(ad).includes(aranan) && kucult(ad) !== aranan)
    .sort((a, b) => basliyorMu(b) - basliyorMu(a) || a.localeCompare(b, "tr"))
    .slice(0, EN_FAZLA_ONERI);

  disKayitOnerileri.replaceChildren(...adlar.map((ad, i) => {
    const oge = document.createElement("li");
    oge.id = `dis-oneri-${i}`;
    oge.role = "option";
    oge.textContent = ad;
    oge.addEventListener("mousedown", (olay) => olay.preventDefault());
    oge.addEventListener("click", () => oneriyiSec(ad));
    return oge;
  }));
  seciliOneri = -1;
  disKayitOnerileri.hidden = adlar.length === 0;
  disKayitAdi.setAttribute("aria-expanded", String(adlar.length > 0));
  disKayitAdi.removeAttribute("aria-activedescendant");
}

function oneriyiSec(ad) {
  disKayitAdi.value = ad;
  disKayitAdi.setCustomValidity("");
  onerileriGuncelle();
}

function oneriyiIsaretle(yeniSira) {
  const ogeler = [...disKayitOnerileri.children];
  seciliOneri = (yeniSira + ogeler.length) % ogeler.length;
  ogeler.forEach((oge, i) => oge.setAttribute("aria-selected", String(i === seciliOneri)));
  ogeler[seciliOneri].scrollIntoView({ block: "nearest" });
  disKayitAdi.setAttribute("aria-activedescendant", ogeler[seciliOneri].id);
}

function kayitPenceresiniAc(dis, tur) {
  kayitHedefi = { dis, tur };
  const { tekil } = KAYIT_TURLERI[tur];
  disKayitBaslik.textContent = `Diş ${dis} - ${tekil} Ekle`;
  disKayitEtiket.textContent = `${tekil} adı`;
  disKayitAdi.value = "";
  disKayitAdi.setCustomValidity("");
  onerileriGuncelle();
  disKayitPenceresi.showModal();
}

disPanelKabi.addEventListener("contextmenu", (olay) => {
  const disOgesi = olay.target.closest(".dis");
  if (!disOgesi) return;
  olay.preventDefault();
  menuyuAc(disOgesi, olay.clientX, olay.clientY);
});

disPanelKabi.addEventListener("mousemove", ipucunuGuncelle);
disPanelKabi.addEventListener("mouseleave", () => {
  disIpucu.hidden = true;
});

document.addEventListener("pointerdown", (olay) => {
  if (!disMenusu.hidden && !disMenusu.contains(olay.target)) menuyuKapat();
});
document.addEventListener("keydown", (olay) => {
  if (olay.key === "Escape" && !disMenusu.hidden) {
    const odak = menuDisOgesi;
    menuyuKapat();
    odak.focus();
  }
});
window.addEventListener("scroll", menuyuKapat, true);
window.addEventListener("resize", menuyuKapat);

disKayitAdi.addEventListener("input", () => {
  disKayitAdi.setCustomValidity("");
  onerileriGuncelle();
});

disKayitAdi.addEventListener("keydown", (olay) => {
  if (disKayitOnerileri.hidden) return;
  if (olay.key === "ArrowDown") {
    olay.preventDefault();
    oneriyiIsaretle(seciliOneri + 1);
  } else if (olay.key === "ArrowUp") {
    olay.preventDefault();
    oneriyiIsaretle(seciliOneri < 0 ? -1 : seciliOneri - 1);
  } else if (olay.key === "Enter" && seciliOneri >= 0) {
    olay.preventDefault();
    oneriyiSec(disKayitOnerileri.children[seciliOneri].textContent);
  }
});

document.getElementById("dis-kayit-iptal").addEventListener("click", () => {
  disKayitPenceresi.close();
});

disKayitFormu.addEventListener("submit", async (olay) => {
  olay.preventDefault();
  const { dis, tur } = kayitHedefi;
  const ad = disKayitAdi.value.trim();
  const ayniKayitMi = (k) => k.dis === dis && k.tur === tur && kucult(k.ad) === kucult(ad);
  disKayitAdi.setCustomValidity(birDisinKayitlari(dis).some(ayniKayitMi) ? "Bu kayıt bu dişte zaten var." : "");
  if (!disKayitAdi.reportValidity()) return;
  const dugme = disKayitFormu.querySelector('button[type="submit"]');
  dugme.disabled = true;
  const yeni = { id: yeniKimlik(), dis, tur, ad };
  // Başka bilgisayar aynı kaydı az önce eklediyse ikinci kez eklenmez
  const kaydedildi = await disKayitlariniDegistir((liste) => (liste.some(ayniKayitMi) ? liste : [...liste, yeni]));
  dugme.disabled = false;
  if (kaydedildi) disKayitPenceresi.close();
});
