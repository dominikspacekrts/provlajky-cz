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
 * Maska vnější střechy včetně valance — a jen jí.
 *
 * Žlutá je na snímku dvojí: vnější plachta a podhled střechy viděný skrz
 * otevřený stan. Rozdělit je podle polohy nejde (podhled se promítá NÍŽ než
 * spodní hrana valance), ale jde to podle souvislosti: vnější plachta je jedna
 * velká souvislá oblast (~81 % veškeré žluté, jas ~196), zatímco podhled jsou
 * desítky malých ostrůvků mezi příhradami a je zřetelně tmavší (jas ~135).
 *
 * Černé logo dělá v masce díry, takže se ještě zaplní uzavřené oblasti. Okapová
 * příhrada valanci přetíná, ale ta uzavřená není — zůstane mimo masku a zakryje
 * ji stěna, což je správně: s nasazenou stěnou konstrukci vidět není.
 */
export function roofMask(im) {
  const { W, H } = im;
  const yellow = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = im.rgb(x, y);
      if (isYellow(r, g, b)) yellow[y * W + x] = 1;
    }

  const seen = new Uint8Array(W * H);
  const mask = new Uint8Array(W * H);
  const stack = [];
  let best = 0;
  for (let i = 0; i < W * H; i++) {
    if (!yellow[i] || seen[i]) continue;
    const cells = [];
    seen[i] = 1; stack.push(i);
    while (stack.length) {
      const k = stack.pop(); cells.push(k);
      const x = k % W, y = (k / W) | 0;
      if (x > 0 && yellow[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; stack.push(k - 1); }
      if (x < W - 1 && yellow[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; stack.push(k + 1); }
      if (y > 0 && yellow[k - W] && !seen[k - W]) { seen[k - W] = 1; stack.push(k - W); }
      if (y < H - 1 && yellow[k + W] && !seen[k + W]) { seen[k + W] = 1; stack.push(k + W); }
    }
    if (cells.length > best) { best = cells.length; mask.fill(0); for (const c of cells) mask[c] = 1; }
  }
  if (!best) throw new Error("na snímku není žlutá střecha");

  // zaplnit uzavřené díry (písmena loga): co z okraje snímku nejde obejít
  const outside = new Uint8Array(W * H);
  const push = (k) => { if (!mask[k] && !outside[k]) { outside[k] = 1; stack.push(k); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) {
    const k = stack.pop(), x = k % W, y = (k / W) | 0;
    if (x > 0) push(k - 1);
    if (x < W - 1) push(k + 1);
    if (y > 0) push(k - W);
    if (y < H - 1) push(k + W);
  }
  for (let i = 0; i < W * H; i++) if (!mask[i] && !outside[i]) mask[i] = 1;

  // Příhrady kříží valanci a dělají v masce svislé štěrbiny. Nejsou uzavřené,
  // takže je zaplnění děr nechytne, a jako průhledné pruhy by jimi prosvítal
  // vnitřek stanu. Maska se proto ve sloupci vyplní mezi svým vrchem a spodkem:
  // cokoli v tom rozsahu je na fotce před střechou, takže se jen přerazítkuje.
  for (let x = 0; x < W; x++) {
    let top = -1, bot = -1;
    for (let y = 0; y < H; y++) if (mask[y * W + x]) { if (top < 0) top = y; bot = y; }
    for (let y = top; y <= bot; y++) mask[y * W + x] = 1;
  }

  const raw = new Float64Array(W).fill(-1);
  for (let x = 0; x < W; x++)
    for (let y = H - 1; y >= 0; y--) if (mask[y * W + x]) { raw[x] = y; break; }
  let last = -1;
  for (let x = 0; x < W; x++) { if (raw[x] >= 0) last = raw[x]; else raw[x] = last; }
  for (let x = W - 1; x >= 0; x--) { if (raw[x] >= 0) last = raw[x]; else raw[x] = last; }

  // Písmeno loga, které se dotkne spodní hrany valance, není uzavřená díra a
  // zaplnění ho nechytne — hrana v tom sloupci vyskočí nahoru a stěna by tam
  // ukousla kus valance. Zářez zacelí morfologické uzavření s poloměrem větším
  // než písmeno; eroze pak vrátí tvar, takže se nesníží ani roh, kde je hrana
  // nejníž.
  const win = (a, R, pick) =>
    a.map((_, x) => {
      let b = a[x];
      for (let k = -R; k <= R; k++) {
        const j = x + k;
        if (j >= 0 && j < W) b = pick(b, a[j]);
      }
      return b;
    });
  const closed = win(win(raw, Math.round(W * 0.022), Math.max), Math.round(W * 0.022), Math.min);

  // Rohový kus valance je na fotce oddělený sloupkem a příhradou, takže do
  // souvislé oblasti nespadne a hrana masky tam vyskočí o ~0,04 výšky nahoru.
  // Stěna ořezaná takovou hranou má viditelný schod. Ořez se proto vede horní
  // obálkou: nikdy nevyjde nad masku (stěna tedy nepřeleze přes plachtu), ale
  // je hladký — nad stěnou pak zůstane plynulý klín podhledu místo zubu.
  const env = win(closed, Math.round(W * 0.06), Math.max);
  const S = Math.round(W * 0.03);
  const bottom = env.map((_, x) => {
    let sum = 0, n = 0;
    for (let k = -S; k <= S; k++) {
      const j = x + k;
      if (j >= 0 && j < W) { sum += env[j]; n++; }
    }
    return Math.max(sum / n, closed[x]);
  });
  return { mask, bottom };
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
