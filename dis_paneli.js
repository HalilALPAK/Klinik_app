"use strict";

/*
 * Diş şekilleri yerel koordinatta tanımlıdır:
 *   y = 0 diş boynu, y < 0 kök tarafı, y > 0 kron tarafı;
 *   x < 0 distal (arkaya bakan), x > 0 mesial (orta hatta bakan) taraf.
 * Alt çene dikey, panelin sağ yarısı yatay olarak aynalanır.
 * Kökler [x, y, yarıGenişlik] noktalarından oluşan orta hatlardır;
 * kanallar aynı orta hattan otomatik üretilir.
 */

const olcekle = (noktalar, sx, sy) => noktalar.map(([x, y]) => [x * sx, y * sy]);

const AZI_KRON = [[-39, -6], [-48, 30], [-50, 72], [-45, 104], [-31, 116], [-16, 102], [0, 110], [16, 102],
  [31, 116], [45, 104], [50, 72], [48, 30], [39, -6], [0, -12]];
const KUCUK_AZI_KRON = [[-27, -6], [-35, 30], [-38, 70], [-32, 106], [-19, 120], [-5, 104], [5, 104], [19, 120],
  [32, 106], [38, 70], [35, 30], [27, -6], [0, -12]];
const ALT_KUCUK_AZI_KRON = [[-25, -6], [-33, 30], [-36, 68], [-30, 100], [-17, 114], [-4, 100], [6, 106], [18, 118],
  [31, 104], [36, 68], [33, 30], [25, -6], [0, -12]];

// Anahtar: FDI numarasının ikinci hanesi (1 = santral ... 8 = 20 yaş dişi)
const UST_DISLER = {
  1: { genislik: 96,
    kron: [[-31, -8], [-40, 30], [-44, 80], [-40, 118], [-16, 128], [16, 128], [40, 118], [44, 80], [40, 30], [31, -8], [0, -16]],
    kokler: [[[0, 12, 31], [-2, -70, 25], [-5, -135, 13], [-9, -180, 3.5]]] },
  2: { genislik: 82,
    kron: [[-26, -6], [-33, 28], [-36, 72], [-32, 106], [-14, 116], [14, 116], [30, 108], [36, 72], [33, 28], [26, -6], [0, -13]],
    kokler: [[[0, 12, 26], [-3, -65, 21], [-9, -125, 11], [-15, -170, 3]]] },
  3: { genislik: 84,
    kron: [[-29, -6], [-37, 30], [-39, 68], [-24, 102], [0, 132], [24, 102], [39, 68], [37, 30], [29, -6], [0, -13]],
    kokler: [[[0, 12, 29], [-2, -80, 25], [-6, -160, 13], [-12, -220, 3.5]]] },
  4: { genislik: 82, kron: KUCUK_AZI_KRON,
    kokler: [
      [[-13, 12, 15], [-17, -55, 13], [-23, -115, 7], [-27, -155, 2.5]],
      [[13, 12, 15], [14, -55, 13], [12, -115, 7], [8, -160, 2.5]],
    ] },
  5: { genislik: 82, kron: olcekle(KUCUK_AZI_KRON, 1, 0.96),
    kokler: [[[0, 12, 27], [-3, -70, 22], [-9, -130, 11], [-15, -172, 3]]] },
  6: { genislik: 104, kron: AZI_KRON,
    kokler: [
      [[-24, 12, 17], [-33, -45, 15], [-42, -95, 9], [-46, -140, 3]],
      [[3, 12, 18], [3, -70, 15], [0, -135, 8], [-3, -180, 3]],
      [[27, 12, 17], [33, -45, 15], [33, -100, 9], [26, -148, 3]],
    ] },
  7: { genislik: 100, kron: olcekle(AZI_KRON, 0.95, 0.97),
    kokler: [
      [[-22, 12, 16], [-28, -45, 14], [-36, -90, 8], [-42, -130, 3]],
      [[1, 12, 17], [0, -65, 14], [-4, -125, 8], [-9, -165, 3]],
      [[24, 12, 16], [28, -45, 14], [25, -95, 8], [17, -138, 3]],
    ] },
  8: { genislik: 92, kron: olcekle(AZI_KRON, 0.86, 0.92),
    kokler: [
      [[-18, 12, 15], [-23, -35, 13], [-31, -75, 8], [-38, -110, 3]],
      [[2, 12, 15], [0, -50, 12], [-6, -100, 7], [-13, -135, 3]],
      [[21, 12, 15], [22, -40, 12], [15, -85, 7], [6, -118, 3]],
    ] },
};

const ALT_DISLER = {
  1: { genislik: 56,
    kron: [[-17, -6], [-22, 30], [-25, 75], [-24, 104], [-10, 110], [10, 110], [24, 104], [25, 75], [22, 30], [17, -6], [0, -12]],
    kokler: [[[0, 12, 17], [-1, -65, 14], [-4, -125, 7], [-7, -168, 2.5]]] },
  2: { genislik: 60,
    kron: [[-19, -6], [-24, 30], [-27, 75], [-26, 106], [-11, 112], [11, 112], [26, 104], [27, 75], [24, 30], [19, -6], [0, -12]],
    kokler: [[[0, 12, 19], [-2, -70, 15], [-6, -130, 8], [-10, -175, 2.5]]] },
  3: { genislik: 72,
    kron: [[-25, -6], [-32, 30], [-34, 68], [-21, 98], [0, 124], [21, 98], [34, 68], [32, 30], [25, -6], [0, -13]],
    kokler: [[[0, 12, 25], [-2, -75, 21], [-7, -150, 11], [-13, -205, 3]]] },
  4: { genislik: 76, kron: ALT_KUCUK_AZI_KRON,
    kokler: [[[0, 12, 25], [-2, -65, 20], [-7, -125, 10], [-12, -172, 3]]] },
  5: { genislik: 76, kron: olcekle(ALT_KUCUK_AZI_KRON, 1, 0.97),
    kokler: [[[0, 12, 25], [-3, -70, 21], [-9, -130, 10], [-15, -178, 3]]] },
  6: { genislik: 104, kron: olcekle(AZI_KRON, 1, 0.98),
    kokler: [
      [[-24, 12, 19], [-30, -50, 16], [-38, -105, 9], [-44, -150, 3]],
      [[24, 12, 21], [22, -55, 18], [14, -115, 10], [6, -162, 3]],
    ] },
  7: { genislik: 100, kron: olcekle(AZI_KRON, 0.96, 0.96),
    kokler: [
      [[-20, 12, 18], [-24, -50, 15], [-30, -100, 8], [-36, -140, 3]],
      [[21, 12, 19], [18, -55, 16], [10, -110, 9], [2, -150, 3]],
    ] },
  8: { genislik: 96, kron: olcekle(AZI_KRON, 0.92, 0.92),
    kokler: [
      [[-18, 12, 17], [-22, -40, 14], [-30, -80, 8], [-38, -115, 3]],
      [[19, 12, 18], [14, -45, 14], [4, -90, 8], [-6, -125, 3]],
    ] },
};

// Panel ölçüleri (SVG birimi)
const GENISLIK = 1500;
const YUKSEKLIK = 870;
const ORTA_X = GENISLIK / 2;
const SERIT_Y = 44;
const ALT_SERIT_UST = YUKSEKLIK - SERIT_Y;
const UST_BOYUN_Y = 300;
const ALT_BOYUN_Y = 595;
const CENE_SINIRI_Y = 456;
const PAPIL_DERINLIK = 34;

const SIRA_ARKADAN_ONE = [8, 7, 6, 5, 4, 3, 2, 1];
const SIRA_ONDEN_ARKAYA = [1, 2, 3, 4, 5, 6, 7, 8];

const fdiListesi = (kadran, sira) => sira.map((n) => kadran * 10 + n);
const SAG_UST = fdiListesi(1, SIRA_ARKADAN_ONE);
const SOL_UST = fdiListesi(2, SIRA_ONDEN_ARKAYA);
const SAG_ALT = fdiListesi(4, SIRA_ARKADAN_ONE);
const SOL_ALT = fdiListesi(3, SIRA_ONDEN_ARKAYA);

const CENE_DUGMELERI = [
  { ad: "Sağ Üst Çene", x: 28, y: 56, g: 210, disler: SAG_UST },
  { ad: "Üst Çene", x: 650, y: 56, g: 200, disler: [...SAG_UST, ...SOL_UST] },
  { ad: "Sol Üst Çene", x: 1262, y: 56, g: 210, disler: SOL_UST },
  { ad: "Tüm Çene", x: 650, y: 434, g: 200, disler: [...SAG_UST, ...SOL_UST, ...SAG_ALT, ...SOL_ALT] },
  { ad: "Sağ Alt Çene", x: 28, y: 772, g: 210, disler: SAG_ALT },
  { ad: "Alt Çene", x: 650, y: 772, g: 200, disler: [...SAG_ALT, ...SOL_ALT] },
  { ad: "Sol Alt Çene", x: 1262, y: 772, g: 210, disler: SOL_ALT },
];

const yuvarla = (n) => Math.round(n * 10) / 10;

// Noktalardan geçen kapalı yumuşak eğri (Catmull-Rom -> Bezier)
function kapaliEgri(p) {
  const n = p.length;
  let yol = `M${yuvarla(p[0][0])} ${yuvarla(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n];
    const b = p[i];
    const c = p[(i + 1) % n];
    const d = p[(i + 2) % n];
    const k1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const k2 = [c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6];
    yol += `C${yuvarla(k1[0])} ${yuvarla(k1[1])} ${yuvarla(k2[0])} ${yuvarla(k2[1])} ${yuvarla(c[0])} ${yuvarla(c[1])}`;
  }
  return `${yol}Z`;
}

// Orta hat + yarı genişliklerden sivrilen şerit (kök ve kanal için)
function seritYolu(merkez) {
  const sol = [];
  const sag = [];
  merkez.forEach(([x, y, r], i) => {
    const a = merkez[Math.max(i - 1, 0)];
    const b = merkez[Math.min(i + 1, merkez.length - 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const u = Math.hypot(dx, dy) || 1;
    sol.push([x - (dy / u) * r, y + (dx / u) * r]);
    sag.push([x + (dy / u) * r, y - (dx / u) * r]);
  });
  const son = merkez[merkez.length - 1];
  const onceki = merkez[merkez.length - 2];
  const u = Math.hypot(son[0] - onceki[0], son[1] - onceki[1]) || 1;
  const uc = [son[0] + ((son[0] - onceki[0]) / u) * son[2], son[1] + ((son[1] - onceki[1]) / u) * son[2]];
  return kapaliEgri([...sol, uc, ...sag.reverse()]);
}

// Referanstaki gibi daha kısa ve küt kökler
const KOK_BOY_ORANI = 0.86;
const KOK_UC_YARICAP = 6;
const kokBicimle = (kok) => kok.map(([x, y, r]) => [x, y < 0 ? y * KOK_BOY_ORANI : y, Math.max(r, KOK_UC_YARICAP)]);

function kanalYolu(kok) {
  const orta = kok.map(([x, y, r]) => [x, y, Math.max(2, r * 0.28)]);
  const son = orta[orta.length - 1];
  const onceki = orta[orta.length - 2];
  // Kanal, kök ucuna varmadan biter
  orta[orta.length - 1] = [
    onceki[0] + (son[0] - onceki[0]) * 0.86,
    onceki[1] + (son[1] - onceki[1]) * 0.86,
    1.5,
  ];
  return seritYolu(orta);
}

function pulpaOdasiYolu(kokler) {
  const tabanlar = kokler.map((k) => k[0][0]);
  const pay = kokler.length > 1 ? 3 : 9;
  const sol = Math.min(...tabanlar) - pay;
  const sag = Math.max(...tabanlar) + pay;
  const orta = (sol + sag) / 2;
  return kapaliEgri([[sol, -4], [sol - 1, 20], [sol + 3, 36], [orta, 30], [sag - 3, 36], [sag + 1, 20], [sag, -4], [orta, -10]]);
}

// Dişin yerine çizilen implant: dişli vida gövdesi ve üstünde abutment.
// Yerel koordinat: y < 0 kök tarafı.
function implantSvg(genislik, derinlik) {
  const r = Math.max(13, Math.min(20, genislik * 0.2));
  const boy = derinlik * 0.82;
  const disSayisi = Math.round(boy / 15);
  const adim = boy / disSayisi;
  const yaricap = (y) => r * (1 - 0.42 * (y / boy));

  const sag = [];
  const hatlar = [];
  for (let i = 0; i < disSayisi; i++) {
    const tepe = (i + 0.35) * adim;
    const dip = (i + 1) * adim;
    sag.push([yaricap(tepe) + 5, -tepe], [yaricap(dip), -dip]);
    hatlar.push(`M${-yaricap(dip)} ${-dip + 3}L${yaricap(dip)} ${-dip - 3}`);
  }
  const nokta = ([x, y]) => `${yuvarla(x)} ${yuvarla(y)}`;
  const solTaraf = [...sag].reverse().map(([x, y]) => [-x, y]);
  const vida = [[r, -2], ...sag, [0, -boy - 7], ...solTaraf, [-r, -2]].map(nokta).join("L");
  const a = r * 0.72;

  return `
    <path class="implant-metal" d="M${yuvarla(-a)} 0L${yuvarla(-a * 0.72)} 34H${yuvarla(a * 0.72)}L${yuvarla(a)} 0Z"/>
    <path class="implant-metal" d="M${vida}Z"/>
    <path class="implant-hat" d="${hatlar.join("")}"/>`;
}

function disSvg(no, x, tip, ustCene) {
  const kadran = Math.floor(no / 10);
  const yatay = kadran === 1 || kadran === 4 ? 1 : -1;
  const dikey = ustCene ? 1 : -1;
  const boyun = ustCene ? UST_BOYUN_Y : ALT_BOYUN_Y;
  const merkezX = x + tip.genislik / 2;

  const kokler = tip.kokler.map(kokBicimle);
  const kokYollari = kokler.map(seritYolu);
  const kronYolu = kapaliEgri(tip.kron);
  const tumYollar = [...kokYollari, kronYolu];
  const yollar = (liste) => liste.map((d) => `<path d="${d}"/>`).join("");
  // Kron kökün üstüne binsin diye sırayla gövde + gölge çizilir
  const govde = tumYollar
    .map((d) => `<path class="dis-govde" d="${d}"/><path class="dis-golge" d="${d}"/>`)
    .join("");

  const sutunY = ustCene ? SERIT_Y : CENE_SINIRI_Y;
  const sutunH = ustCene ? CENE_SINIRI_Y - SERIT_Y : ALT_SERIT_UST - CENE_SINIRI_Y;
  const noY = ustCene ? 0 : ALT_SERIT_UST;

  return `
    <g class="dis" data-no="${no}" role="checkbox" tabindex="0" aria-checked="false" aria-label="${no} numaralı diş">
      <rect class="dis-sutun" x="${x}" y="${sutunY}" width="${tip.genislik}" height="${sutunH}"/>
      <g class="dis-sekil" transform="translate(${merkezX} ${boyun}) scale(${yatay} ${dikey})">
        <g class="dis-hat">${yollar(tumYollar)}</g>
        ${govde}
        <g class="dis-kanal" filter="url(#kanalYumusat)">
          ${yollar(kokler.map(kanalYolu))}
          <path d="${pulpaOdasiYolu(kokler)}"/>
        </g>
        <g class="dis-vurgu">${yollar(tumYollar)}</g>
      </g>
      <g class="dis-implant" transform="translate(${merkezX} ${boyun}) scale(1 ${dikey})">
        ${implantSvg(tip.genislik, -Math.min(...kokler.flat().map((n) => n[1])))}
      </g>
      <g class="isaret isaret-islem" data-sayi="0" transform="translate(${merkezX} ${boyun + dikey * 50})">
        <circle r="14"/><text></text>
      </g>
      <g class="isaret isaret-hastalik" data-sayi="0" transform="translate(${merkezX} ${boyun + dikey * 86})">
        <rect x="-11" y="-11" width="22" height="22" rx="3" transform="rotate(45)"/><text></text>
      </g>
      <g class="dis-geri" role="button" tabindex="0" aria-label="${no} numaralı dişi geri getir" transform="translate(${merkezX} ${boyun + dikey * 50})">
        <title>Dişi geri getir</title>
        <circle r="22"/><path d="M-10 0H10M0 -10V10"/>
      </g>
      <rect class="no-zemin" x="${x}" y="${noY}" width="${tip.genislik}" height="${SERIT_Y}"/>
      <text class="no-yazi" x="${merkezX}" y="${noY + SERIT_Y / 2}">${no}</text>
    </g>`;
}

function dizilimOlustur(tipler) {
  const sagYari = SIRA_ARKADAN_ONE.reduce((t, n) => t + tipler[n].genislik, 0);
  let x = ORTA_X - sagYari;
  const sonuc = [];
  const ekle = (sira, kadran) => sira.forEach((n) => {
    sonuc.push({ no: kadran * 10 + n, x, tip: tipler[n] });
    x += tipler[n].genislik;
  });
  return { sonuc, ekle };
}

function ceneDizilimi(tipler, sagKadran, solKadran) {
  const { sonuc, ekle } = dizilimOlustur(tipler);
  ekle(SIRA_ARKADAN_ONE, sagKadran);
  ekle(SIRA_ONDEN_ARKAYA, solKadran);
  return sonuc;
}

// Koyu ağız boşluğunun üst/alt kenarı: dişler arasında papil yapan diş eti çizgisi
function etKenari(dizilim, boyun, yon) {
  const papil = boyun + yon * PAPIL_DERINLIK;
  const tepe = boyun - yon * 38;
  let yol = `L${dizilim[0].x} ${papil}`;
  dizilim.forEach((d) => {
    yol += `Q${d.x + d.tip.genislik / 2} ${tepe} ${d.x + d.tip.genislik} ${papil}`;
  });
  return { yol, papil };
}

function agizBoslugu(ust, alt) {
  const ustKenar = etKenari(ust, UST_BOYUN_Y, 1);
  const tersAlt = [...alt].reverse();
  const altPapil = ALT_BOYUN_Y - PAPIL_DERINLIK;
  const tepe = ALT_BOYUN_Y + 38;
  let altYol = `L${tersAlt[0].x + tersAlt[0].tip.genislik} ${altPapil}`;
  tersAlt.forEach((d) => {
    altYol += `Q${d.x + d.tip.genislik / 2} ${tepe} ${d.x} ${altPapil}`;
  });
  return `M0 ${ustKenar.papil}${ustKenar.yol}L${GENISLIK} ${ustKenar.papil}L${GENISLIK} ${altPapil}${altYol}L0 ${altPapil}Z`;
}

function seritAyraclari(dizilim, y) {
  return dizilim.slice(1).map((d) => {
    const sinif = d.x === ORTA_X ? "serit-orta" : "serit-ayrac";
    return `<line class="${sinif}" x1="${d.x}" x2="${d.x}" y1="${y}" y2="${y + SERIT_Y}"/>`;
  }).join("");
}

function dugmeSvg(d, i) {
  return `
    <g class="cene-dugme" data-grup="${i}" role="button" tabindex="0" aria-pressed="false">
      <rect x="${d.x}" y="${d.y}" width="${d.g}" height="44" rx="2"/>
      <text x="${d.x + d.g / 2}" y="${d.y + 22}">${d.ad}</text>
    </g>`;
}

function paneliCiz(kap) {
  const ust = ceneDizilimi(UST_DISLER, 1, 2);
  const alt = ceneDizilimi(ALT_DISLER, 4, 3);

  kap.innerHTML = `
    <svg viewBox="0 0 ${GENISLIK} ${YUKSEKLIK}" role="group" aria-label="Diş paneli">
      <defs>
        <linearGradient id="etRengi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f8d9d9"/>
          <stop offset=".5" stop-color="#eeb0b2"/>
          <stop offset="1" stop-color="#f8d9d9"/>
        </linearGradient>
        <linearGradient id="agizRengi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8e2024"/>
          <stop offset=".5" stop-color="#6f1417"/>
          <stop offset="1" stop-color="#8e2024"/>
        </linearGradient>
        <linearGradient id="govdeRengi" gradientUnits="userSpaceOnUse" x1="0" y1="-200" x2="0" y2="130">
          <stop offset="0" stop-color="#dcc69c"/>
          <stop offset=".6" stop-color="#ecdcbc"/>
          <stop offset=".72" stop-color="#f8f1e2"/>
          <stop offset="1" stop-color="#fdfaf3"/>
        </linearGradient>
        <linearGradient id="yanGolge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#7a5f38" stop-opacity=".38"/>
          <stop offset=".3" stop-color="#7a5f38" stop-opacity="0"/>
          <stop offset=".7" stop-color="#7a5f38" stop-opacity="0"/>
          <stop offset="1" stop-color="#7a5f38" stop-opacity=".38"/>
        </linearGradient>
        <linearGradient id="implantRengi" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#7f8b96"/>
          <stop offset=".45" stop-color="#eef2f5"/>
          <stop offset="1" stop-color="#6f7a85"/>
        </linearGradient>
        <filter id="kanalYumusat" x="-30%" y="-10%" width="160%" height="120%">
          <feGaussianBlur stdDeviation=".7"/>
        </filter>
      </defs>

      <rect x="0" y="${SERIT_Y}" width="${GENISLIK}" height="${ALT_SERIT_UST - SERIT_Y}" fill="url(#etRengi)"/>
      <path d="${agizBoslugu(ust, alt)}" fill="url(#agizRengi)"/>

      <rect class="serit-zemin" x="0" y="0" width="${GENISLIK}" height="${SERIT_Y}"/>
      <rect class="serit-zemin" x="0" y="${ALT_SERIT_UST}" width="${GENISLIK}" height="${SERIT_Y}"/>

      ${ust.map((d) => disSvg(d.no, d.x, d.tip, true)).join("")}
      ${alt.map((d) => disSvg(d.no, d.x, d.tip, false)).join("")}

      ${seritAyraclari(ust, 0)}
      ${seritAyraclari(alt, ALT_SERIT_UST)}

      ${CENE_DUGMELERI.map(dugmeSvg).join("")}
    </svg>`;
}

// secimDegisti: kullanıcı panelden seçimi değiştirdiğinde sıralı numara listesiyle çağrılır
// disGeriGetir: eksik dişin yerindeki düğmeye basılınca diş numarasıyla çağrılır
function paneliBaslat(secimDegisti, disGeriGetir) {
  const kap = document.getElementById("dis-paneli");
  const cikti = document.getElementById("secili-disler");
  paneliCiz(kap);

  const secili = new Set();
  const disOgeleri = [...kap.querySelectorAll(".dis")];
  const dugmeler = [...kap.querySelectorAll(".cene-dugme")];
  const eksik = new Set();
  const siraliSecim = () => [...secili].sort((a, b) => a - b);
  // Çene düğmeleri yalnızca ağızda bulunan dişleri kapsar
  const grupDisleri = (og) => CENE_DUGMELERI[og.dataset.grup].disler.filter((no) => !eksik.has(no));
  const tamamiSecili = (disler) => disler.length > 0 && disler.every((no) => secili.has(no));

  function guncelle() {
    disOgeleri.forEach((og) => {
      const acik = secili.has(Number(og.dataset.no));
      og.classList.toggle("secili", acik);
      og.setAttribute("aria-checked", String(acik));
    });
    dugmeler.forEach((og) => {
      og.setAttribute("aria-pressed", String(tamamiSecili(grupDisleri(og))));
    });
    cikti.textContent = secili.size ? siraliSecim().join(", ") : "Seçili diş yok";
  }

  function etkinlestir(hedef) {
    const geriDugmesi = hedef.closest(".dis-geri");
    if (geriDugmesi) {
      const disOgesi = geriDugmesi.closest(".dis");
      disOgesi.focus();
      disGeriGetir(Number(disOgesi.dataset.no));
      return;
    }
    const dugme = hedef.closest(".cene-dugme");
    if (dugme) {
      const disler = grupDisleri(dugme);
      const tamami = tamamiSecili(disler);
      disler.forEach((no) => (tamami ? secili.delete(no) : secili.add(no)));
    } else {
      const dis = hedef.closest(".dis");
      if (!dis) return;
      const no = Number(dis.dataset.no);
      // Eksik diş seçilemez; eski bir işlemden seçili geldiyse çıkarılabilir
      if (eksik.has(no) && !secili.has(no)) return;
      if (!secili.delete(no)) secili.add(no);
    }
    guncelle();
    secimDegisti(siraliSecim());
  }

  kap.addEventListener("click", (e) => etkinlestir(e.target));
  kap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      etkinlestir(e.target);
    }
  });

  return {
    secim: siraliSecim,
    ayarla(disler) {
      secili.clear();
      disler.forEach((no) => secili.add(no));
      guncelle();
    },
    // kayitlar: [{ dis, tur: "islem" | "hastalik", ad }]
    // gorunum: { kanalli: [no], implantli: [no] }
    durumAyarla(eksikDisler, kayitlar, gorunum) {
      eksik.clear();
      eksikDisler.forEach((no) => eksik.add(no));
      disOgeleri.forEach((og) => {
        const no = Number(og.dataset.no);
        const buDis = kayitlar.filter((k) => k.dis === no);
        ["islem", "hastalik"].forEach((tur) => {
          const isaret = og.querySelector(`.isaret-${tur}`);
          const sayi = buDis.filter((k) => k.tur === tur).length;
          isaret.dataset.sayi = sayi;
          isaret.querySelector("text").textContent = sayi;
        });
        og.classList.toggle("eksik", eksik.has(no));
        og.classList.toggle("kanalli", gorunum.kanalli.includes(no));
        og.classList.toggle("implant", gorunum.implantli.includes(no));
        const ekler = [eksik.has(no) ? "yok" : "", ...buDis.map((k) => k.ad)].filter(Boolean);
        og.setAttribute("aria-label", [`${no} numaralı diş`, ...ekler].join(", "));
      });
      guncelle();
    },
  };
}
