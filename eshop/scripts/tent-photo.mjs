// Měření geometrie nůžkového stanu ze studiové fotky.
//
// Z fotky potřebujeme dvě věci: čtyři rohy okapu (spodní hrana žluté valance)
// a čtyři paty nohou. Z nich se pak staví stěny jako perspektivní čtyřúhelníky.
//
// Vstupem je půdorys odečtený z noh, ne z valance — proč, viz measureTent().

import sharp from "sharp";

export const isYellow = (r, g, b) => r > 140 && g > 100 && b < 140 && r - b > 55;

export async function loadPhoto(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const im = { d: data, W: info.width, H: info.height, C: info.channels };
  im.rgb = (x, y) => {
    const i = (y * im.W + x) * im.C;
    return [im.d[i], im.d[i + 1], im.d[i + 2]];
  };
  im.lum = (x, y) => {
    const [r, g, b] = im.rgb(x, y);
    return r * 0.299 + g * 0.587 + b * 0.114;
  };
  return im;
}

/** Pro každý sloupec nejnižší žlutý pixel = spodní hrana valance (v pixelech). */
export function valanceProfile(im) {
  const out = new Array(im.W).fill(-1);
  for (let x = 0; x < im.W; x++)
    for (let y = im.H - 1; y >= 0; y--) {
      const [r, g, b] = im.rgb(x, y);
      if (isYellow(r, g, b)) { out[x] = y; break; }
    }
  return out;
}

/**
 * Spodní hrana valance zacelená přes zaclonění nohami. Noha ubírá žlutou jen
 * shora, takže morfologické uzavření (max, pak min) s poloměrem větším než
 * sloupek zářez vyplní a tvar hrany nezmění.
 */
export function repairedProfile(im) {
  const raw = valanceProfile(im);
  const R = Math.round(im.W * 0.022);
  const pass = (a, pick) =>
    a.map((_, x) => {
      let best = null;
      for (let k = -R; k <= R; k++) {
        const j = x + k;
        if (j < 0 || j >= a.length) continue;
        if (a[j] < 0) continue;
        best = best === null ? a[j] : pick(best, a[j]);
      }
      return best === null ? -1 : best;
    });
  return pass(pass(raw, Math.max), Math.min);
}

/**
 * Ořez střešní vrstvy = přední hrana okapu. Všechno nad ní jde navrch přes
 * stěny, takže se stěna o valanci ořízne přesně a nemá jak s ní nelícovat.
 *
 * Nejde vzít „nejnižší žlutý pixel ve sloupci": v části sloupců to není přední
 * valance, ale **žlutý podhled střechy viděný skrz otevřený stan**, který se
 * promítá níž. Ořez by tam spadl dovnitř stanu a střešní vrstva by přes stěnu
 * namalovala příhradoví a podhled z fotky — a právě to roste směrem k přednímu
 * rohu, kde je vnitřku vidět nejvíc.
 *
 * Základem je proto lomená čára mezi naměřenými rohy okapu (ty jdou z noh).
 * Skutečná hrana se od ní smí odchýlit jen v pásu ±`BAND` — tím se zachová
 * prověšení látky, ale prosvítající vnitřek se utne.
 */
const BAND = 0.014;

/**
 * Spodní hrana žluté měřená shora dolů. Na rozdíl od `valanceProfile` (sken
 * zdola) nespadne na podhled střechy uvnitř stanu. Černé logo hranu přerušuje,
 * takže se tmavé mezery překlenou; stříbrná konstrukce ne.
 */
export function frontEdgeProfile(im) {
  const out = new Array(im.W).fill(-1);
  const maxGap = Math.round(im.H * 0.06);
  for (let x = 0; x < im.W; x++) {
    let end = -1, gap = 0, started = false;
    for (let y = 0; y < im.H; y++) {
      const [r, g, b] = im.rgb(x, y);
      if (isYellow(r, g, b)) { started = true; end = y; gap = 0; continue; }
      if (!started) continue;
      if (r * 0.299 + g * 0.587 + b * 0.114 < 120 && gap < maxGap) { gap++; continue; } // logo
      break;
    }
    out[x] = end;
  }
  return out;
}

export function valanceClip(im, eave) {
  const raw = frontEdgeProfile(im);
  const seg = (a, b) => (x) => a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1e-9);
  const left = seg(eave.L, eave.F), right = seg(eave.F, eave.R);
  const out = new Float64Array(im.W);
  for (let x = 0; x < im.W; x++) {
    const fx = x / im.W;
    const lineY = (fx <= eave.F[0] ? left(fx) : right(fx)) * im.H;
    const lo = lineY - BAND * im.H, hi = lineY + BAND * im.H;
    out[x] = raw[x] < 0 ? lineY : Math.min(Math.max(raw[x], lo), hi);
  }
  return out;
}

/** Nohy: sloupky mají tmavé svislé hrany, měkký stín na zemi je nemá. */
export function measurePosts(im) {
  const band = [Math.round(im.H * 0.6), Math.round(im.H * 0.78)];
  const need = (band[1] - band[0]) * 0.8;
  const dark = new Array(im.W).fill(0);
  for (let x = 0; x < im.W; x++) {
    let n = 0;
    for (let y = band[0]; y < band[1]; y++) if (im.lum(x, y) < 212) n++;
    dark[x] = n;
  }
  const runs = [];
  let s = -1;
  for (let x = 0; x <= im.W; x++) {
    if (x < im.W && dark[x] >= need) { if (s < 0) s = x; }
    else if (s >= 0) { runs.push([s, x - 1]); s = -1; }
  }
  // dvě tmavé hrany jednoho sloupku patří k sobě
  const posts = [];
  for (const r of runs) {
    const last = posts[posts.length - 1];
    if (last && r[0] - last[1] < im.W * 0.016) last[1] = r[1];
    else posts.push([...r]);
  }
  return posts
    .filter(([a, b]) => b - a >= 2)
    .map(([a, b]) => {
      let foot = 0;
      for (let x = a; x <= b; x++)
        for (let y = im.H - 1; y >= band[0]; y--)
          if (im.lum(x, y) < 200) { if (y > foot) foot = y; break; }
      return { x0: a, x1: b, x: (a + b) / 2 / im.W, y: foot / im.H };
    });
}

/**
 * Půdorys a okap stanu odvozené z noh.
 *
 * Rohy se NEberou z valance. U dlouhého stanu se valance přes 4,5 m prověsí
 * o víc, než je rozdíl výšek jejích konců, takže proložení dvou přímek najde
 * vrchol prověšení místo skutečného rohu — a stěny pak kreslí každá jiný
 * půdorys. Nohy jsou naproti tomu jednoznačné, takže se z nich vezme celý
 * půdorys (rohové nohy = vrcholy konvexní obálky, prostřední leží na hraně)
 * a okap se dopočítá jako svislé zvednutí o výšku úměrnou vzdálenosti paty od
 * horizontu, který vedou úběžníky půdorysu.
 *
 * Chyba nahoře je přitom neškodná: střešní vrstva se kreslí až po stěnách, a
 * tak se stěna přesahující nad okap jen schová za valanci. Proto se okap ještě
 * schválně zvedne o `BLEED` — ať nikde nezůstane škvíra.
 */
const BLEED = 0.02;

export function measureTent(im) {
  const prof = repairedProfile(im);
  const posts = measurePosts(im);
  if (posts.length < 3) throw new Error("našel jsem míň než tři nohy — fotka je na měření nepoužitelná");

  // rohové nohy: vrcholy konvexní obálky, blízko sebe ležící se sloučí
  const pts = posts.map((p) => [p.x, p.y]);
  const crossp = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const sorted = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (src) => {
    const out = [];
    for (const p of src) {
      while (out.length > 1 && crossp(out[out.length - 2], out[out.length - 1], p) <= 2e-4) out.pop();
      out.push(p);
    }
    return out;
  };
  let corners = half(sorted).slice(0, -1).concat(half([...sorted].reverse()).slice(0, -1));

  // Čtvrtý roh bývá schovaný za tím nejbližším — dopočítá se z rovnoběžníku.
  if (corners.length === 3) {
    const near = corners.reduce((a, p) => (p[1] > a[1] ? p : a), corners[0]);
    const rest = corners.filter((p) => p !== near);
    corners = [...corners, [rest[0][0] + rest[1][0] - near[0], rest[0][1] + rest[1][1] - near[1]]];
  }
  // Prostřední noha dlouhé strany leží na hraně jen přibližně, takže obálce
  // občas proklouzne. Přebytečné vrcholy se odeberou v pořadí, jak málo mění
  // plochu — nejplošší vrchol je vždycky ten, co na hraně jen leží.
  while (corners.length > 4) {
    let drop = 0, flattest = Infinity;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[(i - 1 + corners.length) % corners.length];
      const b = corners[i];
      const c = corners[(i + 1) % corners.length];
      const area = Math.abs(crossp(a, b, c));
      if (area < flattest) { flattest = area; drop = i; }
    }
    corners.splice(drop, 1);
  }
  if (corners.length !== 4) throw new Error(`půdorys nevyšel jako čtyřúhelník (${corners.length} rohů)`);

  const F = corners.reduce((a, p) => (p[1] > a[1] ? p : a), corners[0]);
  const B = corners.reduce((a, p) => (p[1] < a[1] ? p : a), corners[0]);
  const side = corners.filter((p) => p !== F && p !== B).sort((a, b) => a[0] - b[0]);
  const foot = { L: side[0], F, R: side[1], B };

  // Výška okapu nad patou. Nohy jsou svislé a stejně vysoké, takže jejich
  // obrazová výška je úměrná vzdálenosti paty od horizontu. Horizont vede
  // úběžníky obou směrů půdorysu, které se dají z těch čtyř pat spočítat
  // přesně — na rozdíl od proložení výšek dvou postranních rohů, kde jsou
  // hloubky skoro stejné a extrapolace na přední roh se rozhoupe.
  const line = (a, b) => [a[1] - b[1], b[0] - a[0], a[0] * b[1] - b[0] * a[1]];
  const meet = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const horizon = meet(
    meet(line(foot.L, foot.F), line(foot.B, foot.R)), // úběžník jednoho směru
    meet(line(foot.F, foot.R), line(foot.L, foot.B))  // a druhého
  );
  // U rovnoběžníku (souměrný pohled, oba úběžníky v nekonečnu) vyjde horizont
  // degenerovaný — pak je promítání prakticky ortografické a výška konstantní.
  const degenerate = Math.abs(horizon[0]) + Math.abs(horizon[1]) < 1e-9 * Math.abs(horizon[2] || 1);
  const horizonY = (x) => (degenerate ? -Infinity : -(horizon[0] * x + horizon[2]) / horizon[1]);

  // Rozsah valance se bere ze SUROVÉ masky — zacelený profil je morfologií
  // roztažený o poloměr okna do stran a přesah stříšky by z něj vyšel dvakrát
  // větší, než ve skutečnosti je.
  const raw = valanceProfile(im);
  const cols = [];
  for (let x = 0; x < im.W; x++) if (raw[x] >= 0) cols.push(x);
  const xMin = cols[0], xMax = cols[cols.length - 1];
  const readAt = (x) => prof[Math.min(im.W - 1, Math.max(0, Math.round(x)))] / im.H;
  const hL = foot.L[1] - readAt(xMin + im.W * 0.004);
  const dL = foot.L[1] - horizonY(foot.L[0]);
  const h = ([x, y]) => (degenerate || !Number.isFinite(dL) || Math.abs(dL) < 1e-6 ? hL : hL * ((y - horizonY(x)) / dL));

  // Přesah stříšky do stran; u předního a zadního rohu míří hlavně do hloubky.
  const oxL = xMin / im.W - foot.L[0];
  const oxR = xMax / im.W - foot.R[0];
  const ox = { L: oxL, R: oxR, F: (oxL + oxR) / 2, B: (oxL + oxR) / 2 };

  // `eave` je zvednutý o BLEED a používá se na čtyřúhelníky stěn; `eaveTrue`
  // je bez něj a slouží jako ořez střešní vrstvy, aby padl na skutečnou hranu.
  const eave = {}, eaveTrue = {};
  for (const key of ["L", "F", "R", "B"]) {
    const p = foot[key];
    const hh = h(p);
    eave[key] = [p[0] + ox[key], p[1] - hh * (1 + BLEED)];
    eaveTrue[key] = [p[0] + ox[key], p[1] - hh];
  }
  return { eave, eaveTrue, foot, posts, prof };
}

/**
 * Hlídá, že stan má očekávaný půdorys. Roh nad nohou už kontrolovat nemusíme —
 * measureTent ho z noh přímo odvozuje. Zbývá poměr stran: generátor obrázků má
 * sklon zkopírovat půdorys z reference a vyrobit čtverec, i když je v zadání
 * obdélník, a to by jinak prošlo bez povšimnutí.
 */
export function checkFootprint({ foot }, { minEdgeRatio = 0 } = {}) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const ratio = d(foot.F, foot.R) / d(foot.L, foot.F);
  const spread = Math.max(ratio, 1 / ratio);
  const ok = !minEdgeRatio || spread >= minEdgeRatio;
  return {
    ok,
    spread: +spread.toFixed(3),
    reason: ok ? "" : `stan je málo protáhlý — poměr stran půdorysu ${spread.toFixed(2)}, čekám aspoň ${minEdgeRatio}`,
  };
}
