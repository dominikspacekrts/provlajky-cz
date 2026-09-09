// Vygeneruje vrstvy stěn nůžkového stanu do public/stany/vrstvy/.
//
// Proč vrstvy a ne kreslení v prohlížeči: stěna je plochý čtyřúhelník, takže
// se dá do fotky napasovat přesně — ale musí to být látka, ne barevná výplň.
// Textura se proto jednou vygeneruje (scripts/stena-textura.jpg) a tady
// se promítne do naměřených rohů projektivní transformací. Výsledkem je pro
// každou stranu a výšku jeden hotový PNG/WebP, který se v prohlížeči jen
// položí přes fotku — žádná matematika za běhu, žádné rozjetí při změně
// velikosti okna.
//
// Spuštění:  node scripts/build-tent-walls.mjs

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPhoto, measureTent, roofMask, hems, checkFootprint } from "./tent-photo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public", "stany");
const OUT = path.join(PUB, "vrstvy");
// Zdrojová textura je jen pro build, do public/ nepatří — servírovala by se
// zbytečně (2 MB), přestože ji potřebuje jen tenhle skript.
const TEXTURE = path.join(ROOT, "scripts", "stena-textura.jpg");

const SIZES = [
  { key: "3", file: "nuzkovy-3x3.jpg", backWidthM: 3, sideDepthM: 3 },
  { key: "45", file: "nuzkovy-3x45.jpg", backWidthM: 4.5, sideDepthM: 3, minEdgeRatio: 1.25 },
  { key: "6", file: "nuzkovy-3x6.jpg", backWidthM: 6, sideDepthM: 3, minEdgeRatio: 1.6 },
];

// Poloviční stěna je pultová: stojí na zemi a horní hranou se chytá za plastový
// úchyt na noze. Ten je na všech nohách a všech třech fotkách shodně v 0,588
// výšky stěny (měřeno od okapu k patě — rozptyl 0,587–0,595), takže se stěna
// v tomhle podílu na každé noze trefí přesně do úchytu a horní hrana je
// v rovině. Pozor: vychází to jen s okapem odečteným z plachty; se starým
// odhadem z výšky nohy padl podíl u přední nohy na 0,52 a u bočních na 0,41,
// takže hrana byla u jedné nohy nad úchytem a u druhé pod ním.
const HALF = 0.588;
// Nasvícení odečtené přímo z fotky (scripts/tent-photo.mjs → valance je svislá
// plocha ve stejných rovinách jako stěny): levá strana je o 6,7 % světlejší než
// pravá, podhled střechy má 0,65 jasu vnějšku. Vzdálené stěny vidíme zevnitř,
// ale na rozdíl od podhledu jim přisvětluje odraz od země — proto 0,74.
const LIGHT_LR = 1.067;
const INSIDE = 0.74;

// Strany stanu obcházejí půdorys v pořadí levá → přední → pravá → zadní, což
// při rozích pojmenovaných podle snímku (L = levý sloupek, F = nejbližší,
// R = pravý, B = zadní) vychází takhle:
//
//   levá  = L–F  (blízká, zvenku)          pravá = B–R  (vzdálená, vnitřní líc)
//   přední = F–R (blízká, zvenku, s logem) zadní = L–B  (vzdálená, vnitřní líc)
//
// Protilehlé stěny jsou rovnoběžné, takže sdílejí nasvícení: L–F ∥ B–R a
// F–R ∥ L–B — vnitřní líc se od vnějšího liší násobkem INSIDE.
const FACE = {
  left: { gain: 1.0, near: true },
  front: { gain: 1 / LIGHT_LR, near: true },
  right: { gain: INSIDE, near: false },
  back: { gain: INSIDE / LIGHT_LR, near: false },
};

// --- projektivní transformace ------------------------------------------
/** Homografie 3×3, která zobrazí čtyři body `from` na čtyři body `to`. */
function solveHomography(from, to) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Gaussova eliminace s výběrem hlavního prvku
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    const d = A[c][c];
    for (let k = c; k < 8; k++) A[c][k] /= d;
    b[c] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === c || !A[r][c]) continue;
      const f = A[r][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1];
}
const apply = (h, x, y) => {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
};
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * Zvedne horní rohy čtyřúhelníku tak, aby spojnice nikde neklesla pod ořezovou
 * hranu. Plachta se mezi rohy prověsí, takže hrana jde v půli rozpětí výš než
 * spojnice rohů — a nad spojnicí už textura není, takže by tam zůstal pruh
 * roztaženého horního řádku. Látka se místo toho napne až nad hranu a ořez ji
 * zase seřízne.
 */
function liftTop([a, b, c, d], clip) {
  let lift = 0;
  const x0 = Math.max(0, Math.ceil(Math.min(a[0], b[0])));
  const x1 = Math.min(clip.length - 1, Math.floor(Math.max(a[0], b[0])));
  for (let x = x0; x <= x1; x++) {
    const t = (x - a[0]) / (b[0] - a[0] || 1);
    lift = Math.max(lift, a[1] + (b[1] - a[1]) * t - clip[x]);
  }
  return [[a[0], a[1] - lift], [b[0], b[1] - lift], c, d];
}

// --- vzorkování textury -------------------------------------------------
/** Bilineárně, vodorovně zrcadlově opakovaně (široké stěny jsou víc dílů). */
function sample(tex, u, v) {
  const m = ((u % 2) + 2) % 2;
  const uu = m > 1 ? 2 - m : m;
  const fx = Math.min(Math.max(uu, 0), 1) * (tex.W - 1);
  const fy = Math.min(Math.max(v, 0), 1) * (tex.H - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, tex.W - 1), y1 = Math.min(y0 + 1, tex.H - 1);
  const tx = fx - x0, ty = fy - y0;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const p00 = tex.d[(y0 * tex.W + x0) * 3 + c], p10 = tex.d[(y0 * tex.W + x1) * 3 + c];
    const p01 = tex.d[(y1 * tex.W + x0) * 3 + c], p11 = tex.d[(y1 * tex.W + x1) * 3 + c];
    out[c] = (p00 * (1 - tx) + p10 * tx) * (1 - ty) + (p01 * (1 - tx) + p11 * tx) * ty;
  }
  return out;
}

const inside = (q, x, y) => {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (c === 0) continue;
    const s = c > 0 ? 1 : -1;
    if (!sign) sign = s;
    else if (s !== sign) return false;
  }
  return true;
};

/**
 * Vykreslí jednu stěnu: měkký kontaktní stín + látka napasovaná do rohů.
 *
 */
function renderWall(W, H, quad, tex, repeat, face, topClip) {
  const { gain, near } = face;
  const rgba = Buffer.alloc(W * H * 4, 0);
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const pad = Math.round(H * 0.045);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 2), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)) + 2);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 2), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)) + pad);

  // kontaktní stín pod spodní hranou, ať stěna nelevituje
  const [, , bR, bL] = quad; // pořadí rohů: horní A, horní B, dolní B, dolní A
  for (let x = x0; x <= x1; x++) {
    const t = (x - bL[0]) / (bR[0] - bL[0] || 1);
    if (t < -0.02 || t > 1.02) continue;
    const edge = bL[1] + (bR[1] - bL[1]) * t;
    for (let y = Math.round(edge); y <= Math.min(y1, Math.round(edge + pad)); y++) {
      const f = 1 - (y - edge) / pad;
      if (f <= 0) continue;
      const a = Math.round(84 * f * f);
      const i = (y * W + x) * 4;
      rgba[i] = 96; rgba[i + 1] = 96; rgba[i + 2] = 92; rgba[i + 3] = a;
    }
  }

  const inv = solveHomography(quad, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  const SS = 3; // 3×3 podvzorkování kvůli hladkým hranám
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let hits = 0, r = 0, g = 0, bl = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          if (topClip && py < topClip[x]) continue;
          if (!inside(quad, px, py)) continue;
          const [u, v] = apply(inv, px, py);
          if (v < -0.002 || v > 1.002) continue;
          const vv = Math.min(Math.max(v, 0), 1);
          const [tr, tg, tb] = sample(tex, u * repeat, vv);
          // Přehyb látky u obou rohů — bez něj sousední stěny splynou v jednu
          // plochu. Svislý spád má u blízkých a vzdálených stěn opačný smysl:
          // zvenku plachta ke spodku tmavne, zevnitř ji naopak nasvěcuje odraz
          // od země, takže tam je nejtmavší nahoře pod střechou.
          const corner = 1 - 0.11 * (Math.exp(-u / 0.03) + Math.exp(-(1 - u) / 0.03));
          const grad = near ? 1 - 0.06 * vv : 0.93 + 0.1 * vv;
          const ao = 1 - (near ? 0.15 : 0.24) * Math.exp(-vv / 0.055);
          const shade = gain * corner * grad * ao;
          r += tr * shade; g += tg * shade; bl += tb * shade;
          hits++;
        }
      if (!hits) continue;
      const cov = hits / (SS * SS);
      const i = (y * W + x) * 4;
      const a = Math.round(255 * cov);
      // stěna překryje případný stín pod sebou
      rgba[i] = Math.round(r / hits); rgba[i + 1] = Math.round(g / hits); rgba[i + 2] = Math.round(bl / hits);
      rgba[i + 3] = Math.max(rgba[i + 3], a);
      if (cov < 1) {
        const prev = rgba[i + 3];
        rgba[i + 3] = Math.max(prev, a);
      }
    }
  }
  return rgba;
}

/**
 * Střešní vrstva = jen vnější plachta s valancí (viz roofMask). Dřív se brala
 * jako „všechno nad hranou okapu", jenže v tom pásu je na fotce vidět i vnitřek
 * stanu — a ten se pak maloval přes stěnu, takže stěna nelícovala se stropem
 * a bylo skrz ni vidět dovnitř.
 */
function renderRoof(im, mask) {
  const rgba = Buffer.alloc(im.W * im.H * 4, 0);
  for (let i = 0; i < im.W * im.H; i++) {
    if (!mask[i]) continue;
    const x = i % im.W, y = (i / im.W) | 0;
    const [r, g, b] = im.rgb(x, y);
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/**
 * Výřez noh pod valancí. Nohy stojí uvnitř stanu, takže musí být vidět přes
 * vzdálené stěny (přes blízké ne — ty je zakryjí, protože se kreslí až po nich).
 * Sloupek má tmavé svislé hrany a světlý střed; maskuje se všechno mezi
 * nejvyšším a nejnižším tmavým pixelem ve sloupci, jinak by střed vypadl.
 */
function renderPosts(im, posts, clip) {
  const rgba = Buffer.alloc(im.W * im.H * 4, 0);
  for (const p of posts) {
    const x0 = Math.max(0, p.x0 - 2), x1 = Math.min(im.W - 1, p.x1 + 2);
    const foot = Math.min(im.H - 1, Math.round(p.y * im.H) + 3);
    for (let x = x0; x <= x1; x++) {
      const top = Math.max(0, Math.round(clip[x]));
      let a = -1, b = -1;
      for (let y = top; y <= foot; y++) if (im.lum(x, y) < 216) { if (a < 0) a = y; b = y; }
      if (a < 0) continue;
      for (let y = a; y <= b; y++) {
        const [r, g, bb] = im.rgb(x, y);
        const i = (y * im.W + x) * 4;
        rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = bb; rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

// --- sestavení jedné velikosti -----------------------------------------
async function build(size, tex) {
  const im = await loadPhoto(path.join(PUB, size.file));
  const h = hems(im);
  const tent = measureTent(im, h);
  const check = checkFootprint(tent, { minEdgeRatio: size.minEdgeRatio });

  const px = (p) => [p[0] * im.W, p[1] * im.H];
  const E = Object.fromEntries(Object.entries(tent.eave).map(([k, v]) => [k, px(v)]));
  const EF = Object.fromEntries(Object.entries(tent.eaveFar).map(([k, v]) => [k, px(v)]));
  const F = Object.fromEntries(Object.entries(tent.foot).map(([k, v]) => [k, px(v)]));

  // Přední a zadní stěna jdou přes celou šířku stanu, boční jsou vždy 3 m —
  // stejné dělení, jaké používá ceník v konfigurátoru (fullWallBack vs. Side).
  const widths = { front: size.backWidthM, back: size.backWidthM, left: size.sideDepthM, right: size.sideDepthM };
  // Blízké stěny končí u spodní hrany vnější plachty, vzdálené až u okapu
  // protější strany, na který je vidět zespodu pod střechou.
  const edges = {
    left: [E.L, E.F, F.F, F.L],
    front: [E.F, E.R, F.R, F.F],
    right: [EF.B, EF.R, F.R, F.B],
    back: [EF.L, EF.B, F.B, F.L],
  };

  const roof = roofMask(im, h);
  const nearClip = h.near.map((v) => v - im.H * 0.02);
  const write = (name, rgba) =>
    sharp(rgba, { raw: { width: im.W, height: im.H, channels: 4 } })
      .webp({ quality: 88, alphaQuality: 90 })
      .toFile(path.join(OUT, `${size.key}-${name}.webp`));

  await write("strecha", renderRoof(im, roof.mask));
  await write("nohy", renderPosts(im, tent.posts, h.near));

  for (const [side, q] of Object.entries(edges)) {
    for (const type of ["full", "half"]) {
      // Celá stěna se ořezává hranou plachty naměřenou v tom sloupci: rovná
      // horní hrana čtyřúhelníku by u prověšené plachty místy nedosáhla a
      // byla by tam vidět příhrada.
      //
      // Blízká stěna se ořízne o kousek VÝŠ, než kam sahá plachta: přebytek
      // zakryje střešní vrstva, která se kreslí až po ní, takže o hranu se
      // stará jedno jediné měření a nepřesnost nemá kde nechat škvíru.
      // Vzdálená stěna takový polštář nemá — nad ní je vidět podhled, takže
      // se musí trefit přesně.
      const clip = type !== "full" ? null : FACE[side].near ? nearClip : h.far;
      const quad = clip
        ? liftTop(q, clip)
        : [lerp(q[0], q[3], HALF), lerp(q[1], q[2], HALF), q[2], q[3]];
      const repeat = Math.max(1, Math.round((widths[side] / 3) * 2) / 2);
      await write(`${side}-${type}`, renderWall(im.W, im.H, quad, tex, repeat, FACE[side], clip));
    }
  }

  return { size, check, E, EF, F };
}

// --- běh ----------------------------------------------------------------
const texRaw = await sharp(TEXTURE)
  .extract(await sharp(TEXTURE).metadata().then((m) => ({
    left: Math.round(m.width * 0.012), top: Math.round(m.height * 0.012),
    width: Math.round(m.width * 0.976), height: Math.round(m.height * 0.976),
  })))
  .removeAlpha().raw().toBuffer({ resolveWithObject: true });
const tex = { d: texRaw.data, W: texRaw.info.width, H: texRaw.info.height };

await mkdir(OUT, { recursive: true });
const report = [];
for (const size of SIZES) {
  const r = await build(size, tex);
  report.push(r);
  const c = r.check;
  console.log(
    `${size.file.padEnd(20)} ${c.ok ? "OK   " : "CHYBA"} poměr stran půdorysu ${c.spread}` + (c.ok ? "" : `\n    → ${c.reason}`)
  );
}
await writeFile(
  path.join(OUT, "geometrie.json"),
  JSON.stringify(
    report.map((r) => ({ key: r.size.key, file: r.size.file, okap: r.E, okapVzdaleny: r.EF, paty: r.F, kontrola: r.check })),
    null,
    2
  )
);
console.log(`\nvrstvy → ${path.relative(ROOT, OUT)}`);
