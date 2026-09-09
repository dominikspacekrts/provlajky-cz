// Měření geometrie nůžkového stanu ze studiové fotky.
//
// Z fotky potřebujeme tři věci: paty noh, spodní hranu blízké plachty (dolní
// silueta střechy) a spodní hranu vzdálené plachty (nejnižší žlutá — okap
// protější strany, na který je vidět zespodu pod střechou). Z nich se staví
// stěny: blízké končí u blízké hrany, vzdálené u vzdálené.
//
// Proč se okap NEPOČÍTÁ z paty a výšky nohy, jak to bylo dřív: fotky jsou
// generované a nedrží jednu projekci. Půdorys je nakreslený v perspektivě
// (přední pata je o 73 px níž než boční), ale střecha je skoro symetrická —
// přední noha je tím pádem o 14 % delší než boční. Okap odvozený z paty plus
// konstantní výšky proto u předního rohu minul skutečnou plachtu o 80 px a
// mezi stěnou a střechou zůstala díra, kterou bylo vidět na příhradu. Obě
// hrany se teď berou přímo tak, jak jsou na fotce nakreslené, takže stěna
// vždycky přesně vyplní prostor mezi zemí a plachtou.

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

// --- profily hran střechy ----------------------------------------------
/** Sloupce bez dat (−1) dostanou hodnotu nejbližšího souseda. */
function fillGaps(a) {
  const out = Float64Array.from(a);
  let last = -1;
  for (let x = 0; x < out.length; x++) { if (out[x] >= 0) last = out[x]; else out[x] = last; }
  for (let x = out.length - 1; x >= 0; x--) { if (out[x] >= 0) last = out[x]; else out[x] = last; }
  return out;
}

/** Posuvné okno přes profil. */
const win = (a, R, pick) =>
  a.map((_, x) => {
    let b = a[x];
    for (let k = -R; k <= R; k++) {
      const j = x + k;
      if (j >= 0 && j < a.length) b = pick(b, a[j]);
    }
    return b;
  });

/**
 * Morfologické uzavření: dilatace a pak eroze. Zacelí zářez, který do hrany
 * ukousla noha nebo příhrada, a tvar hrany přitom nechá být — poloměr musí být
 * větší než polovina šířky zářezu.
 */
const close = (a, R) => win(win(a, R, Math.max), R, Math.min);

/**
 * Hrana zacelená přes zaclonění nohou nebo příhradou.
 *
 * Samotné uzavření zářez vyplní, ale zároveň by srovnalo i pravé prověšení
 * plachty mezi úchyty (u 3×3 hluboké 40 px) a stěna by se pak usekla pod
 * plachtou — mezi stěnou a střechou by byla vidět příhrada. Zacelená hodnota
 * se proto použije jen ve sloupcích, kde je zářez hlubší než `minDepth`, a
 * v jejich okolí (okraj zaclonění je taky nespolehlivý). Jinde platí hrana
 * tak, jak byla naměřená.
 *
 * Vyhlazuje se minimem, tedy směrem nahoru: nad hranou stěnu překryje střecha,
 * pod ní by zůstala škvíra do vnitřku stanu.
 */
function edgeProfile(raw, R, minDepth) {
  const smooth = win(fillGaps(raw), 4, Math.min);
  const filled = close(smooth, R);
  const bad = win(filled.map((v, x) => (v - smooth[x] > minDepth ? 1 : 0)), Math.round(R / 3), Math.max);
  return smooth.map((v, x) => (bad[x] ? filled[x] : v));
}

/** Otsuův práh: rozdělí hodnoty na dvě skupiny s nejmenším rozptylem uvnitř. */
function otsu(hist, n) {
  let sum = 0;
  for (let i = 0; i < hist.length; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = -1, T = 0;
  for (let i = 0; i < hist.length; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const v = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (v > best) { best = v; T = i; }
  }
  return T;
}

/** Největší souvislá oblast masky (4-okolí). */
function largestBlob(src, W, H) {
  const seen = new Uint8Array(W * H);
  const out = new Uint8Array(W * H);
  const stack = [];
  let best = 0;
  for (let i = 0; i < W * H; i++) {
    if (!src[i] || seen[i]) continue;
    const cells = [];
    seen[i] = 1; stack.push(i);
    while (stack.length) {
      const k = stack.pop(); cells.push(k);
      const x = k % W, y = (k / W) | 0;
      if (x > 0 && src[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; stack.push(k - 1); }
      if (x < W - 1 && src[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; stack.push(k + 1); }
      if (y > 0 && src[k - W] && !seen[k - W]) { seen[k - W] = 1; stack.push(k - W); }
      if (y < H - 1 && src[k + W] && !seen[k + W]) { seen[k + W] = 1; stack.push(k + W); }
    }
    if (cells.length > best) { best = cells.length; out.fill(0); for (const c of cells) out[c] = 1; }
  }
  return best ? out : null;
}

/**
 * Hrany střechy po sloupcích, v pixelech:
 *   top  — nejvyšší žlutá, horní silueta plachty,
 *   near — spodní hrana vnější plachty (blízký okap),
 *   far  — nejnižší žlutá vůbec, tedy okap na protější straně stanu.
 *
 * Žlutá je na snímku dvojí: osvětlená vnější plachta a podhled střechy viděný
 * skrz otevřený stan. Rozdělit je podle polohy nejde — podhled se promítá NÍŽ
 * než spodní hrana plachty — ale spolehlivě je rozdělí jas: Otsuův práh vyjde
 * na všech třech fotkách na 171–173 a plachta z něj vychází jako jeden velký
 * souvislý kus. Souvislost samotná nestačí: u 4,5m a 6m stanu plachta do
 * podhledu plynule přechází a spadly by do jedné oblasti.
 */
export function hems(im) {
  const { W, H } = im;
  const yellow = new Uint8Array(W * H);
  const hist = new Array(256).fill(0);
  let n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = im.rgb(x, y);
      if (!isYellow(r, g, b)) continue;
      yellow[y * W + x] = 1;
      hist[Math.round(im.lum(x, y))]++;
      n++;
    }
  if (!n) throw new Error("na snímku není žlutá střecha");

  const T = otsu(hist, n);
  const bright = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (yellow[y * W + x] && im.lum(x, y) >= T) bright[y * W + x] = 1;
  const main = largestBlob(bright, W, H);
  if (!main) throw new Error("na snímku není osvětlená plachta");

  const topRaw = new Float64Array(W).fill(-1);
  const nearRaw = new Float64Array(W).fill(-1);
  const farRaw = new Float64Array(W).fill(-1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) if (yellow[y * W + x]) { topRaw[x] = y; break; }
    for (let y = H - 1; y >= 0; y--) if (main[y * W + x]) { nearRaw[x] = y; break; }
    for (let y = H - 1; y >= 0; y--) if (yellow[y * W + x]) { farRaw[x] = y; break; }
  }
  const cols = [];
  for (let x = 0; x < W; x++) if (farRaw[x] >= 0) cols.push(x);
  const xMin = cols[0], xMax = cols[cols.length - 1];

  // Sloupek i s příhradou ukrojí u předního rohu z blízké hrany pás široký
  // skoro 0,15 šířky snímku; zacelí ho až uzavření s poloměrem přes polovinu
  // toho pásu. S menším poloměrem hrana v tom místě vyskočí o 60 px nahoru,
  // stěna se pod ní usekne a mezi stěnou a plachtou je vidět dovnitř stanu.
  const near = edgeProfile(nearRaw, Math.round(W * 0.09), H * 0.03);
  // Vzdálenou hranu cloní jen samotné nohy, tam stačí poloměr přes sloupek.
  const far = edgeProfile(farRaw, Math.round(W * 0.03), H * 0.03);
  const top = fillGaps(topRaw);
  // Blízká hrana nemůže ležet níž než vzdálená; u rohů siluety splývají.
  for (let x = 0; x < W; x++) near[x] = Math.min(near[x], far[x]);

  return { top, near, far, xMin, xMax };
}

/**
 * Maska střechy = všechno mezi horní a spodní hranou vnější plachty. Cokoli
 * v tom pásu leží (plachta, logo, sloupek před ní) je na fotce před stěnou,
 * takže se to jen přerazítkuje. Dřív se maska brala jako souvislá žlutá
 * oblast, jenže rohový kus plachty je od zbytku oddělený nohou a příhradou,
 * takže do ní nespadl a v rohu zůstala díra.
 */
export function roofMask(im, h = hems(im)) {
  const { W, H } = im;
  const mask = new Uint8Array(W * H);
  for (let x = h.xMin; x <= h.xMax; x++) {
    const a = Math.max(0, Math.round(h.top[x]));
    const b = Math.min(H - 1, Math.round(h.near[x]));
    for (let y = a; y <= b; y++) mask[y * W + x] = 1;
  }
  return { mask, bottom: h.near };
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
 * Půdorys z noh a k němu vrcholy stěn odečtené z hran střechy.
 *
 * Rohy půdorysu se berou z noh, ne z plachty: u dlouhého stanu se plachta přes
 * 4,5 m prověsí o víc, než je rozdíl výšek jejích konců, takže proložení dvou
 * přímek najde vrchol prověšení místo skutečného rohu. Nohy jsou jednoznačné
 * (rohové = vrcholy konvexní obálky, prostřední leží na hraně).
 *
 * Stěna je svislá v rovině noh, takže její horní roh leží přímo nad patou —
 * jen se v tom sloupci odečte hrana střechy. `eave` je pro blízké stěny,
 * `eaveFar` pro vzdálené; v rozích siluety (L, R) obě splývají.
 */
export function measureTent(im, h = hems(im)) {
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

  const at = (prof, xr) => prof[Math.min(im.W - 1, Math.max(0, Math.round(xr * im.W)))] / im.H;
  const eave = {}, eaveFar = {};
  for (const k of ["L", "F", "R", "B"]) {
    eave[k] = [foot[k][0], at(h.near, foot[k][0])];
    eaveFar[k] = [foot[k][0], at(h.far, foot[k][0])];
  }
  return { eave, eaveFar, foot, posts, hems: h };
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
