// =====================================================================
// PROVLAJKY — order management + flag template editor
// =====================================================================

console.log('%c[BOOT] app.js start', 'color:#2563eb;font-weight:bold');
console.log('[BOOT] knihovny:',
  'pdfjsLib=' + (typeof pdfjsLib !== 'undefined'),
  'Konva=' + (typeof Konva !== 'undefined'),
  'PDFLib=' + (typeof PDFLib !== 'undefined'),
  'Tesseract=' + (typeof Tesseract !== 'undefined'));

// Global error surfacing — if anything throws during init, show it instead of
// silently leaving the UI dead (buttons without listeners).
window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e.message, 'na', e.filename + ':' + e.lineno, e.error);
  const el = document.getElementById('sync-info');
  if (el) el.textContent = 'Chyba skriptu: ' + (e.message || e.error);
  alert('Chyba ve skriptu:\n' + e.message + '\n\n' + (e.filename || '') + ':' + (e.lineno || ''));
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED PROMISE]', e.reason);
});

// Log every click so we can tell if clicks reach JS or are blocked by overlay.
document.addEventListener('click', (e) => {
  const t = e.target;
  console.log('[CLICK]', t.tagName, 'id=' + (t.id || '-'), 'class=' + (t.className || '-'));
}, true);

// Configure pdf.js worker — guarded so a failed CDN load doesn't kill the app.
try {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  } else {
    console.warn('pdfjsLib se nenačetlo z CDN – náhled šablon nemusí fungovat.');
  }
} catch (e) {
  console.warn('pdf.js init selhal:', e);
}

// ---------- Persistent state ----------
const STORAGE_KEY = 'provlajky-orders';
const WC_CONFIG_KEY = 'provlajky-wc-config';

// IndexedDB — large-capacity store for orders & invoices (images blow past the
// ~5MB localStorage quota). wcConfig stays in localStorage (tiny).
const IDB_NAME = 'provlajky-db';
const IDB_STORE = 'kv';
let _idb = null;
function openIdb() {
  return new Promise((resolve, reject) => {
    if (_idb) return resolve(_idb);
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => { _idb = req.result; resolve(_idb); };
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const r = tx.objectStore(IDB_STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key, val) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Debounced async writes so frequent saveOrders() calls don't thrash IDB.
let _saveTimer = null, _saveInvTimer = null;
function saveOrders() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    idbSet('orders', state.orders).catch(e => console.error('IDB orders save failed', e));
  }, 150);
}
function loadWcConfig() {
  try { return JSON.parse(localStorage.getItem(WC_CONFIG_KEY) || 'null'); }
  catch { return null; }
}
function saveWcConfig(cfg) {
  localStorage.setItem(WC_CONFIG_KEY, JSON.stringify(cfg));
}

// ---------- App settings (costs/margins + partners) ----------
const SETTINGS_KEY = 'provlajky-settings';
const DEFAULT_MAIL_TPL_INVOICE = `<p>Dobrý den,</p>
<p>děkujeme za Vaši objednávku <strong>č. {{order}}</strong>. V příloze najdete fakturu na částku <strong>{{total}}</strong>, kterou prosím uhraďte převodem na účet uvedený ve faktuře (můžete využít QR platbu).</p>
<p style="background:#f7f8f9;border-left:3px solid #f4d03f;padding:12px 14px;margin:16px 0;color:#444">
<strong>Platba předem</strong><br>
Platbu předem požadujeme, protože zboží vyrábíme na zakázku podle individuálních potřeb zákazníka. Tímto eliminujeme riziko neprodejného vráceného zboží. Výrobu zahájíme až po úhradě, čímž garantujeme osobní přístup a precizní zpracování Vaší objednávky.<br><br>
Dodací lhůta se počítá ode dne, kdy nám platba přijde na účet.</p>
<p>S pozdravem,<br>tým PROVLAJKY</p>`;

const DEFAULT_MAIL_TPL_VISUAL = `<p>Dobrý den,</p>
<p>v příloze posíláme vizualizaci a cenovou nabídku k Vaší objednávce <strong>č. {{order}}</strong> v celkové výši <strong>{{total}}</strong>.</p>
<p>V případě dotazů nebo úprav nás neváhejte kontaktovat.</p>
<p>S pozdravem,<br>tým PROVLAJKY</p>`;

const DEFAULT_MAIL_TPL_ACCOUNTANT = `<p>Ahoj,</p>
<p>zde je faktura provlajky zaslaná {{date}}.</p>
<p>Prosím o potvrzení zaplacení odpovědí na tento mail.</p>
<p>díky<br>Dominik Špaček</p>`;

function defaultSettings() {
  const emptyBilling = () => ({ company:'', name:'', ico:'', dic:'', street:'', psc:'', city:'', bank:'' });
  return {
    costPerSize: { S: 0, M: 0, L: 0, XL: 0 },   // náklad na vlajku bez DPH dle velikosti
    partners: [
      { id: 'alex',    name: 'Alex',    share: 50, billing: emptyBilling() },
      { id: 'dominik', name: 'Dominik', share: 50, billing: emptyBilling() },
    ],
    mail: {
      host: '', port: 587, secure: false, user: '', pass: '',
      fromName: 'PROVLAJKY', from: '', accountant: '', supplier: '',
      tplInvoice: DEFAULT_MAIL_TPL_INVOICE,
      tplVisual: DEFAULT_MAIL_TPL_VISUAL,
      tplAccountant: DEFAULT_MAIL_TPL_ACCOUNTANT,
      signName: 'Dominik Špaček',
      signPhone: '+420 605 981 155',
    },
  };
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!s) return defaultSettings();
    const d = defaultSettings();
    return {
      costPerSize: { ...d.costPerSize, ...(s.costPerSize || {}) },
      partners: (s.partners && s.partners.length) ? s.partners : d.partners,
      mail: { ...d.mail, ...(s.mail || {}) },
    };
  } catch { return defaultSettings(); }
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

// WooCommerce order statuses → Czech labels.
const WC_STATUSES = {
  pending:    'Čeká na platbu',
  processing: 'Zpracovává se',
  'on-hold':  'Pozdržena',
  completed:  'Dokončena',
  cancelled:  'Zrušena',
  refunded:   'Vrácena',
  failed:     'Neúspěšná',
};
// Vlastní (lokální) stavy – nepatří do WooCommerce, slouží jen pro naši evidenci.
// Na web se neodesílají (WC by je odmítl).
const LOCAL_STATUSES = {
  'paid-awaiting':  'Zaplaceno – čeká na dodání',
  'paid-delivering':'Zaplaceno – odesláno',
};
const ALL_STATUSES = { ...WC_STATUSES, ...LOCAL_STATUSES };
function isLocalStatus(s) { return Object.prototype.hasOwnProperty.call(LOCAL_STATUSES, s); }
// Objednávka se počítá do financí (statistika/výdělky), jakmile je zaplacená:
// dokončená ve WC nebo s naším lokálním „zaplaceno" stavem.
function isRealizedOrder(o) {
  return o.status === 'completed' || isLocalStatus(o.status);
}
function statusLabel(s) { return ALL_STATUSES[s] || s || '—'; }

// Dodavatel (vystavovatel faktur).
const SUPPLIER = {
  name: 'ACTUAL PRO s.r.o.',
  street: 'nábřeží Míru 1055/82',
  city: '737 01 Český Těšín',
  ico: '25882201',
  dic: 'CZ25882201',
  bank: '3512506359/0800',   // GIBACZPX · IBAN CZ03 0800 0000 0035 1250 6359
  bic: 'GIBACZPX',
};

const INVOICES_KEY = 'provlajky-invoices';
function saveInvoices() {
  clearTimeout(_saveInvTimer);
  _saveInvTimer = setTimeout(() => {
    idbSet('invoices', state.invoices).catch(e => console.error('IDB invoices save failed', e));
  }, 150);
}

let _savePayoutTimer = null;
function savePayouts() {
  clearTimeout(_savePayoutTimer);
  _savePayoutTimer = setTimeout(() => {
    idbSet('payouts', state.payouts).catch(e => console.error('IDB payouts save failed', e));
  }, 150);
}

// Load orders+invoices+payouts from IDB; migrate any legacy localStorage data once.
async function loadPersisted() {
  let orders = await idbGet('orders');
  let invoices = await idbGet('invoices');
  let payouts = await idbGet('payouts');
  // One-time migration from old localStorage storage.
  if (!orders) {
    try { orders = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { orders = []; }
    if (orders.length) { await idbSet('orders', orders); }
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
  if (!invoices) {
    try { invoices = JSON.parse(localStorage.getItem(INVOICES_KEY) || '[]'); } catch { invoices = []; }
    if (invoices.length) { await idbSet('invoices', invoices); }
    try { localStorage.removeItem(INVOICES_KEY); } catch {}
  }
  state.orders = orders || [];
  state.invoices = invoices || [];
  state.payouts = payouts || [];
}

const state = {
  orders: [],
  invoices: [],
  payouts: [],
  settings: loadSettings(),
  wcConfig: loadWcConfig(),
  currentOrderId: null,
  currentItemId: null,

  // editor runtime
  shape: null,
  size: null,
  templatePath: null,
  templateBytes: null,
  pdfPageSize: null,
  stage: null,
  bgLayer: null,
  logoLayer: null,
  logoNode: null,
  transformer: null,
  scale: 1,
  sourceScale: 3,
  templateCanvas: null,
  linesCanvas: null,
  flagPolygon: null,
  sourceW: 0, sourceH: 0,
  fillNode: null,
  linesNode: null,
  templateNode: null,
  artworkNode: null,
  artworkGroup: null,
  zonesNode: null,
  legendNode: null,
  bgColor: null,
  sleeveColor: 'white', // rukáv na podpůrnou tyč u HS vlajek — jen bílá nebo černá

  // multi-piece banner editing (různé grafiky pro jednotlivé kusy)
  pieces: [],
  activePieceIndex: 0,
  multiMode: false,
};

// Drží vodítka (zóny+legenda) a úchyty nad logem/grafikou.
function raiseGuides() {
  if (state.zonesNode) state.zonesNode.moveToTop();
  if (state.legendNode) state.legendNode.moveToTop();
  if (state.transformer) state.transformer.moveToTop();
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const getOrder = (id) => state.orders.find(o => o.id === id);
const getItem = (orderId, itemId) => getOrder(orderId)?.items.find(i => i.id === itemId);

// ---------- Navigation ----------
function showStep(name) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + name).classList.add('active');
}

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.back;
    if (target === 'orders') { renderOrdersList(); showStep('orders'); }
    else if (target === 'order') { renderOrderDetail(); showStep('order'); }
    else { showStep(target); }
  });
});

// Top-level navigation (Domů / Objednávky / Finance).
function navTo(view) {
  document.querySelectorAll('.nav-link').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === view));
  if (view === 'home') { renderHome(); showStep('home'); }
  else if (view === 'orders') { renderOrdersList(); showStep('orders'); }
  else if (view === 'finance') { renderFinance(); showStep('finance'); }
}
document.querySelectorAll('[data-nav]').forEach(btn => {
  btn.addEventListener('click', () => navTo(btn.dataset.nav));
});

function renderHome() {
  document.getElementById('tile-orders-sub').textContent =
    `${state.orders.length} objednávek`;
  const unpaid = state.invoices.filter(i => !i.paid).length;
  document.getElementById('tile-finance-sub').textContent =
    `${state.invoices.length} faktur · ${unpaid} nezaplaceno`;
}

// Finance tabs
function renderFinance() {
  renderInvoices();
  renderStats();
  renderEarnings();
}
document.querySelectorAll('.fin-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fin-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.fintab;
    document.getElementById('fin-invoices').classList.toggle('hidden', tab !== 'invoices');
    document.getElementById('fin-stats').classList.toggle('hidden', tab !== 'stats');
    document.getElementById('fin-earnings').classList.toggle('hidden', tab !== 'earnings');
  });
});

// =====================================================================
// ORDERS — list + detail
// =====================================================================

// =====================================================================
// WooCommerce integration
// =====================================================================

// Build an authenticated WC REST URL. Keys are passed as query params so we
// avoid a CORS preflight (custom Authorization header triggers OPTIONS).
function wcUrl(path, params = {}) {
  const cfg = state.wcConfig;
  const base = cfg.url.replace(/\/+$/, '');
  const u = new URL(base + '/wp-json/wc/v3/' + path.replace(/^\/+/, ''));
  u.searchParams.set('consumer_key', cfg.key);
  u.searchParams.set('consumer_secret', cfg.secret);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function wcRequest(path, { method = 'GET', params = {}, body = null } = {}) {
  if (!state.wcConfig || !state.wcConfig.url || !state.wcConfig.key) {
    throw new Error('Není nastaveno napojení na web.');
  }
  const url = wcUrl(path, params);
  console.log('[WC] ' + method + ' ' + url.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));

  const opts = { method, mode: 'cors' };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  // Abort after 20 s so a hung CORS preflight surfaces as an error.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  opts.signal = ctrl.signal;

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    clearTimeout(timer);
    console.error('[WC] fetch failed:', e);
    if (e.name === 'AbortError') {
      throw new Error('Časový limit vypršel (web neodpověděl do 20 s).');
    }
    // TypeError "Failed to fetch" = network or CORS blocked by the browser.
    throw new Error('Spojení selhalo (pravděpodobně CORS nebo špatná URL). '
      + 'Detail: ' + e.message);
  }
  clearTimeout(timer);

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j.message) msg += ' – ' + j.message; } catch {}
    console.error('[WC] error response:', msg);
    throw new Error(msg);
  }
  return res.json();
}

// Parse a WC line item into our flag item (shape, size, qty).
// Pull every http(s) URL out of an arbitrary meta value (string, array, object).
function collectUrls(val, acc) {
  if (val == null) return;
  if (typeof val === 'string') {
    const matches = val.match(/https?:\/\/[^\s"'<>)\]]+/gi);
    if (matches) for (const m of matches) acc.push(m);
  } else if (Array.isArray(val)) {
    for (const v of val) collectUrls(v, acc);
  } else if (typeof val === 'object') {
    // common shapes: {url: "..."} or {file: "..."} or {name, url}
    for (const v of Object.values(val)) collectUrls(v, acc);
  }
}
const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)(\?|#|$)/i;

function mapLineItem(li) {
  let shape = null, size = null;
  const meta = li.meta_data || [];
  const urlAcc = [];
  for (const m of meta) {
    const key = (m.display_key || m.key || '').toString().toLowerCase();
    const rawVal = m.display_value != null ? m.display_value : m.value;
    const val = (rawVal || '').toString().trim();
    if (/tvar/.test(key)) { const mm = val.match(/[A-F]/i); if (mm) shape = mm[0].toUpperCase(); }
    if (/velikost|size/.test(key)) { const mm = val.match(/XL|S|M|L/i); if (mm) size = mm[0].toUpperCase(); }
    // Collect any URLs from this meta value (covers upload fields with any key).
    collectUrls(rawVal, urlAcc);
  }
  // Fallback: parse from the product name e.g. "Plážové vlajky - D, M"
  if (!shape || !size) {
    const nm = (li.name || '').match(/\b([A-F])\s*,\s*(XL|S|M|L)\b/i);
    if (nm) { shape = shape || nm[1].toUpperCase(); size = size || nm[2].toUpperCase(); }
  }
  // Prefer image URLs; keep other file URLs too (PDF/AI etc.) as artwork links.
  const uniq = [...new Set(urlAcc)];
  const artworkImages = uniq.filter(u => IMG_EXT_RE.test(u));
  const artworkFiles  = uniq.filter(u => !IMG_EXT_RE.test(u) && /\/(uploads|wp-content)\//i.test(u));

  // Prices WITHOUT VAT, from line subtotal (before order-level discounts).
  const qty = li.quantity || 1;
  const subtotal = parseFloat(li.subtotal || li.total || '0') || 0;          // ex VAT
  const subtotalTax = parseFloat(li.subtotal_tax || li.total_tax || '0') || 0;
  const unitPrice = qty ? subtotal / qty : 0;                                // ex VAT / ks
  const vatRate = subtotal > 0 ? subtotalTax / subtotal : 0.21;              // e.g. 0.21

  return {
    shape: shape || 'A',
    size: size || 'M',
    qty,
    unitPrice: Math.round(unitPrice * 100) / 100,  // bez DPH / ks
    vatRate: Math.round(vatRate * 1000) / 1000,
    wcLineName: li.name || '',
    wcProductId: li.product_id,
    artworkImages,                 // directly usable as logo
    artworkFiles,                  // links (PDF/AI/zip) – just clickable
  };
}

const ADDR_FIELDS = ['company', 'name', 'street', 'psc', 'city', 'ico', 'dic', 'email', 'phone'];
const emptyAddr = () => ({ company: '', name: '', street: '', psc: '', city: '', ico: '', dic: '', email: '', phone: '', isCompany: false });

// Build a structured address block from a WC billing/shipping object.
function wcAddr(a) {
  if (!a) return emptyAddr();
  const name = [a.first_name, a.last_name].filter(Boolean).join(' ');
  let street = a.address_1 || '';
  if (a.address_2) street += (street ? ', ' : '') + a.address_2;
  return {
    company: a.company || '',
    name,
    street,
    psc: a.postcode || '',
    city: a.city || '',
    email: a.email || '',
    phone: a.phone || '',
  };
}

// Try to split a free-text address block into {street, psc, city}.
// Expects something like "Ulice 12/3\n602 00 Brno" (lines in any order).
function splitAddressText(text) {
  const out = { street: '', psc: '', city: '' };
  if (!text) return out;
  const lines = text.split(/\n|,/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^E-?mail:/i.test(line) || /^Telefon:/i.test(line)) continue;
    const m = line.match(/^(\d{3})\s?(\d{2})\s+(.+)$/);
    if (m && !out.psc) { out.psc = `${m[1]} ${m[2]}`; out.city = m[3].trim(); continue; }
    if (/\d/.test(line) && !out.street) { out.street = line; continue; }   // has number → street
    if (!out.street) out.street = line;
    else if (!out.city) out.city = line;
  }
  return out;
}

// Normalise any order's customer to the structured {billing, shipping} shape,
// migrating older formats on the fly so existing saved orders keep working.
function normalizeCustomer(cust) {
  if (!cust) return { billing: emptyAddr(), shipping: emptyAddr() };

  const upgrade = (blk) => {
    const base = emptyAddr();
    if (!blk || typeof blk !== 'object') return base;
    Object.assign(base, blk);
    // Older structured shape used a single `address` multiline string.
    if (blk.address && !blk.street && !blk.psc && !blk.city) {
      const sp = splitAddressText(blk.address);
      base.street = sp.street; base.psc = sp.psc; base.city = sp.city;
    }
    delete base.address;
    return base;
  };

  if (cust.billing && typeof cust.billing === 'object') {
    return { billing: upgrade(cust.billing), shipping: upgrade(cust.shipping) };
  }
  // Oldest flat format → put everything into billing, address strings split.
  const b = emptyAddr();
  b.company = cust.company || ''; b.name = cust.name || '';
  b.email = cust.email || ''; b.phone = cust.phone || '';
  if (typeof cust.billing === 'string') Object.assign(b, splitAddressText(cust.billing));
  const s = emptyAddr();
  if (typeof cust.shipping === 'string') Object.assign(s, splitAddressText(cust.shipping));
  return { billing: b, shipping: s };
}

// Convenience: a one-line customer label for lists/exports.
function customerLabel(o) {
  const c = normalizeCustomer(o.customer);
  return c.billing.company || c.billing.name ||
         c.shipping.company || c.shipping.name || '(bez jména)';
}

// Map a WC order object into our local order shape, preserving any existing
// local data (designs) matched by wcId.
function mapWcOrder(wc) {
  const existing = state.orders.find(o => o.wcId === wc.id);
  const b = wc.billing || {};
  const s = wc.shipping || {};

  const lineItems = (wc.line_items || []).map(mapLineItem);
  // Re-attach designs from the existing order where shape+size line up.
  const items = lineItems.map((li, idx) => {
    let design = null;
    if (existing && existing.items[idx] &&
        existing.items[idx].shape === li.shape &&
        existing.items[idx].size === li.size) {
      design = existing.items[idx].design || null;
    }
    return { id: uid(), ...li, design };
  });

  const shipEx = parseFloat(wc.shipping_total || '0') || 0;   // bez DPH
  const shipTax = parseFloat(wc.shipping_tax || '0') || 0;
  const shipVatRate = shipEx > 0 ? shipTax / shipEx : 0.21;

  // Domestic vs foreign — from billing country code (CZ = tuzemsko).
  const country = (b.country || '').toUpperCase();
  const foreign = existing ? existing.foreign : (country && country !== 'CZ');

  return {
    id: existing ? existing.id : uid(),
    wcId: wc.id,
    createdAt: wc.date_created ? new Date(wc.date_created).getTime() : Date.now(),
    title: `Objednávka č. ${wc.number || wc.id}`,
    orderNumber: String(wc.number || wc.id),
    status: wc.status,
    currency: wc.currency || 'CZK',
    foreign: !!foreign,
    shipping: Math.round(shipEx * 100) / 100,            // bez DPH
    shipVatRate: Math.round(shipVatRate * 1000) / 1000,
    discountPct: existing?.discountPct || 0,  // keep locally-set discount
    customer: {
      billing: wcAddr(b),
      shipping: wcAddr(s),
    },
    items,
  };
}

async function syncWcOrders() {
  const info = document.getElementById('sync-info');
  const btn = document.getElementById('sync-wc');
  if (!state.wcConfig) {
    openWcModal();
    info.textContent = 'Nejdřív nastav napojení na web.';
    return;
  }
  btn.disabled = true;
  try {
    // 1) PUSH — odeslat lokální změny (stav + adresy) u upravených objednávek.
    showLoading('Odesílám změny na web…');
    info.textContent = 'Odesílám změny…';
    const dirty = state.orders.filter(o => o.wcId && o._dirty);
    let pushed = 0, pushFailed = 0;
    for (const o of dirty) {
      try {
        await pushOrderToWc(o);
        o._dirty = false;
        pushed++;
      } catch (e) {
        console.error('[WC] push fail order', o.wcId, e);
        pushFailed++;
      }
    }
    saveOrders();

    // 2) PULL — stáhnout objednávky, ale PŘIDAT jen ty, které ještě nemáme.
    //    Existující (už stažené) zůstávají nedotčené.
    showLoading('Stahuji nové objednávky…');
    info.textContent = 'Stahuji nové objednávky…';
    const haveIds = new Set(state.orders.filter(o => o.wcId).map(o => o.wcId));
    let page = 1, all = [];
    while (true) {
      const batch = await wcRequest('orders', {
        params: { per_page: 50, page, orderby: 'date', order: 'desc' },
      });
      all = all.concat(batch);
      if (batch.length < 50) break;
      page++;
      if (page > 10) break; // safety
    }
    const fresh = all.filter(wc => !haveIds.has(wc.id)).map(mapWcOrder);
    // New orders first, then everything we already had (unchanged).
    state.orders = fresh.concat(state.orders);
    saveOrders();
    rebuildStatusFilter();
    renderOrdersList();

    const parts = [];
    if (pushed) parts.push(`odesláno ${pushed} změn`);
    if (pushFailed) parts.push(`${pushFailed} změn se nepodařilo odeslat`);
    parts.push(`${fresh.length} nových objednávek`);
    info.textContent = parts.join(' · ') + ' · ' + new Date().toLocaleTimeString('cs-CZ');
    alert('✅ Synchronizováno.\n\n' +
      (pushed ? `Odesláno na web: ${pushed} změněných objednávek.\n` : '') +
      (pushFailed ? `⚠️ Neodesláno: ${pushFailed} (zkus znovu).\n` : '') +
      `Staženo nových: ${fresh.length}.\n` +
      'Dříve stažené objednávky zůstaly beze změny.');
  } catch (e) {
    info.textContent = '';
    alert('❌ Synchronizace selhala:\n\n' + e.message +
      '\n\nPokud jde o CORS/blokaci, je potřeba na webu povolit přístup (řeknu ti jak).');
  } finally {
    btn.disabled = false;
    hideLoading();
  }
}

// Convert our structured address back to a WC billing/shipping object.
function ourAddrToWc(a) {
  if (!a) return {};
  const parts = (a.name || '').trim().split(/\s+/);
  const first = parts.shift() || '';
  const last = parts.join(' ');
  return {
    first_name: first, last_name: last,
    company: a.company || '',
    address_1: a.street || '',
    postcode: a.psc || '',
    city: a.city || '',
    email: a.email || '',
    phone: a.phone || '',
  };
}

// Push a single order's local changes (status + addresses) to WooCommerce.
async function pushOrderToWc(o) {
  const cust = normalizeCustomer(o.customer);
  const body = {
    billing: ourAddrToWc(cust.billing),
    shipping: ourAddrToWc(cust.shipping),
  };
  // Lokální stav neposílej – nechej na webu stav beze změny.
  if (o.status && !isLocalStatus(o.status)) body.status = o.status;
  // Shipping in WC má svůj e-mail jen výjimečně; necháme co je.
  await wcRequest('orders/' + o.wcId, { method: 'PUT', body });
}

async function updateWcStatus(order, newStatus, infoElId) {
  order.status = newStatus;
  order._dirty = true;          // bude odesláno (hned i při příští synchronizaci)
  saveOrders();
  // Lokální stav (např. „Zaplaceno – čeká na dodání") na web neposíláme.
  if (isLocalStatus(newStatus) || !order.wcId || !state.wcConfig) {
    if (infoElId) setOcrStatus(infoElId, 'Uloženo lokálně.', 'done');
    renderOrdersList();
    return;
  }
  if (infoElId) setOcrStatus(infoElId, 'Ukládám na web…', 'active');
  try {
    await wcRequest('orders/' + order.wcId, { method: 'PUT', body: { status: newStatus } });
    order._dirty = false;
    saveOrders();
    if (infoElId) setOcrStatus(infoElId, 'Uloženo na web ✓', 'done');
    renderOrdersList();
  } catch (e) {
    if (infoElId) setOcrStatus(infoElId,
      'Uloženo lokálně, odešle se při synchronizaci (' + e.message + ')', 'error');
  }
}

// ---------- Loading overlay ----------
function showLoading(text) {
  document.getElementById('loading-text').textContent = text || 'Načítám…';
  document.getElementById('loading-overlay').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ---------- WC config modal ----------
function openWcModal() {
  fillWcConfigForm();
  fillSettingsForm();
  setOcrStatus('wc-status', '');
  document.getElementById('wc-modal').classList.remove('hidden');
}
function closeWcModal() {
  document.getElementById('wc-modal').classList.add('hidden');
}
document.getElementById('toggle-wc-config').addEventListener('click', () => {
  console.log('[UI] klik na Napojení webu → otevírám modal');
  openWcModal();
});
document.getElementById('wc-modal-close').addEventListener('click', closeWcModal);
document.getElementById('wc-modal').addEventListener('click', (e) => {
  if (e.target.id === 'wc-modal') closeWcModal();
});
document.getElementById('sync-wc').addEventListener('click', syncWcOrders);

function fillWcConfigForm() {
  const c = state.wcConfig || {};
  document.getElementById('wc-url').value = c.url || '';
  document.getElementById('wc-key').value = c.key || '';
  document.getElementById('wc-secret').value = c.secret || '';
}

// ---------- Settings (costs + partners) UI ----------
document.querySelectorAll('.set-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.set-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const t = btn.dataset.settab;
    document.getElementById('set-wc').classList.toggle('hidden', t !== 'wc');
    document.getElementById('set-costs').classList.toggle('hidden', t !== 'costs');
    document.getElementById('set-partners').classList.toggle('hidden', t !== 'partners');
    document.getElementById('set-mail').classList.toggle('hidden', t !== 'mail');
    document.getElementById('set-export').classList.toggle('hidden', t !== 'export');
  });
});

// One-time export of everything (orders/invoices/payouts/settings) for migration
// into the new Supabase-backed admin. Mirrors the shape the import expects:
// { exportedAt, orders, invoices, payouts, settings }.
document.getElementById('export-all-btn')?.addEventListener('click', () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    orders: state.orders,
    invoices: state.invoices,
    payouts: state.payouts,
    settings: state.settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `provlajky-export-${stamp}.json`);
});

function fillMailForm() {
  const m = state.settings.mail || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  set('mail-host', m.host); set('mail-port', m.port || 587);
  set('mail-user', m.user); set('mail-pass', m.pass);
  set('mail-fromname', m.fromName || 'PROVLAJKY'); set('mail-from', m.from);
  set('mail-accountant', m.accountant);
  set('mail-supplier', m.supplier);
  document.getElementById('mail-secure').checked = !!m.secure;
  set('mail-signname', m.signName || '');
  set('mail-signphone', m.signPhone || '');
  set('mail-tpl-invoice', m.tplInvoice || DEFAULT_MAIL_TPL_INVOICE);
  set('mail-tpl-visual', m.tplVisual || DEFAULT_MAIL_TPL_VISUAL);
  set('mail-tpl-accountant', m.tplAccountant || DEFAULT_MAIL_TPL_ACCOUNTANT);
}
function readMailForm() {
  const g = id => document.getElementById(id);
  state.settings.mail = {
    host: g('mail-host').value.trim(),
    port: parseInt(g('mail-port').value, 10) || 587,
    secure: g('mail-secure').checked,
    user: g('mail-user').value.trim(),
    pass: g('mail-pass').value,
    fromName: g('mail-fromname').value.trim() || 'PROVLAJKY',
    from: g('mail-from').value.trim(),
    accountant: g('mail-accountant').value.trim(),
    supplier: g('mail-supplier').value.trim(),
    signName: g('mail-signname').value.trim(),
    signPhone: g('mail-signphone').value.trim(),
    tplInvoice: g('mail-tpl-invoice').value,
    tplVisual: g('mail-tpl-visual').value,
    tplAccountant: g('mail-tpl-accountant').value,
  };
}
document.getElementById('mail-save').addEventListener('click', () => {
  readMailForm(); saveSettings();
  setOcrStatus('mail-status', 'Uloženo ✓', 'done');
});
document.getElementById('mail-test').addEventListener('click', async () => {
  readMailForm(); saveSettings();
  setOcrStatus('mail-status', 'Testuji připojení…', 'active');
  try {
    const res = await fetch('/api/test-smtp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtp: mailSmtpPayload() }),
    });
    const j = await res.json();
    if (j.ok) setOcrStatus('mail-status', 'Připojení funguje ✓', 'done');
    else setOcrStatus('mail-status', 'Chyba: ' + j.error, 'error');
  } catch (e) {
    setOcrStatus('mail-status', 'Server nedostupný – běží `node server.js`? ' + e.message, 'error');
  }
});

function mailSmtpPayload() {
  const m = state.settings.mail || {};
  return { host: m.host, port: m.port, secure: m.secure, user: m.user, pass: m.pass,
           fromName: m.fromName, from: m.from || m.user };
}

function fillSettingsForm() {
  fillMailForm();
  const s = state.settings;
  ['S','M','L','XL'].forEach(sz => {
    const el = document.getElementById('cost-' + sz);
    if (el) el.value = s.costPerSize[sz] || 0;
  });
  renderPartnersForm();
}

function renderPartnersForm() {
  const wrap = document.getElementById('partners-list');
  wrap.innerHTML = '';
  state.settings.partners.forEach((p, idx) => {
    const b = p.billing || {};
    const div = document.createElement('div');
    div.className = 'partner-block';
    div.innerHTML = `
      <h4>${escapeHtml(p.name)}</h4>
      <div class="partner-grid">
        <label>Jméno / název <input data-pf="name" value="${escapeHtml(p.name||'')}"></label>
        <label>Podíl na zisku (%) <input data-pf="share" type="number" min="0" max="100" value="${p.share||0}"></label>
        <label>Firma <input data-pf="b.company" value="${escapeHtml(b.company||'')}"></label>
        <label>Jméno na faktuře <input data-pf="b.name" value="${escapeHtml(b.name||'')}"></label>
        <label>IČO <input data-pf="b.ico" value="${escapeHtml(b.ico||'')}"></label>
        <label>DIČ <input data-pf="b.dic" value="${escapeHtml(b.dic||'')}"></label>
        <label class="full">Ulice a č.p. <input data-pf="b.street" value="${escapeHtml(b.street||'')}"></label>
        <label>PSČ <input data-pf="b.psc" value="${escapeHtml(b.psc||'')}"></label>
        <label>Město <input data-pf="b.city" value="${escapeHtml(b.city||'')}"></label>
        <label class="full">Číslo účtu <input data-pf="b.bank" value="${escapeHtml(b.bank||'')}"></label>
      </div>`;
    div.querySelectorAll('[data-pf]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const f = inp.dataset.pf;
        const v = e.target.value;
        if (f === 'name') p.name = v;
        else if (f === 'share') p.share = parseFloat(v) || 0;
        else if (f.startsWith('b.')) { p.billing = p.billing || {}; p.billing[f.slice(2)] = v; }
      });
    });
    wrap.appendChild(div);
  });
}

document.getElementById('costs-save').addEventListener('click', () => {
  ['S','M','L','XL'].forEach(sz => {
    state.settings.costPerSize[sz] = parseFloat(document.getElementById('cost-' + sz).value) || 0;
  });
  saveSettings();
  alert('Náklady uloženy.');
});
document.getElementById('partners-save').addEventListener('click', () => {
  saveSettings();
  alert('Společníci uloženi.');
  renderPartnersForm();
});

function setSaveBtnLoading(loading) {
  const btn = document.getElementById('wc-save');
  btn.disabled = loading;
  btn.querySelector('.btn-label').textContent =
    loading ? 'Testuji…' : 'Uložit a otestovat';
  btn.querySelector('.spinner').classList.toggle('hidden', !loading);
}

document.getElementById('wc-save').addEventListener('click', async () => {
  const url = document.getElementById('wc-url').value.trim();
  const key = document.getElementById('wc-key').value.trim();
  const secret = document.getElementById('wc-secret').value.trim();
  if (!url || !key || !secret) { setOcrStatus('wc-status', 'Vyplň všechna pole.', 'error'); return; }
  // Normalise URL: must start with http(s), no trailing slash.
  let normUrl = url;
  if (!/^https?:\/\//i.test(normUrl)) normUrl = 'https://' + normUrl;
  normUrl = normUrl.replace(/\/+$/, '');
  document.getElementById('wc-url').value = normUrl;

  state.wcConfig = { url: normUrl, key, secret };
  saveWcConfig(state.wcConfig);          // uloží se hned
  setOcrStatus('wc-status', 'Ukládám a testuji připojení…', 'active');
  setSaveBtnLoading(true);
  try {
    const data = await wcRequest('orders', { params: { per_page: 1 } });
    setOcrStatus('wc-status', 'Připojeno a uloženo ✓', 'done');
    alert('✅ Připojeno k webu a údaje uloženy.\n\nTeď klikni na „⟳ Synchronizovat z webu".');
    closeWcModal();
    document.getElementById('sync-info').textContent =
      'Připojeno ✓ — klikni na „⟳ Synchronizovat z webu".';
  } catch (e) {
    setOcrStatus('wc-status', 'Chyba: ' + e.message, 'error');
    alert('❌ Test připojení selhal:\n\n' + e.message +
      '\n\nÚdaje jsou uložené, můžeš zkusit znovu.');
  } finally {
    setSaveBtnLoading(false);
  }
});

// ---------- Status filter ----------
function rebuildStatusFilter() {
  const sel = document.getElementById('status-filter');
  const current = sel.value;
  const present = new Set(state.orders.map(o => o.status).filter(Boolean));
  sel.innerHTML = '<option value="">Všechny</option>';
  for (const st of Object.keys(ALL_STATUSES)) {
    if (present.has(st)) {
      const opt = document.createElement('option');
      opt.value = st; opt.textContent = statusLabel(st);
      sel.appendChild(opt);
    }
  }
  sel.value = current;
}
document.getElementById('status-filter').addEventListener('change', renderOrdersList);

function renderOrdersList() {
  const list = document.getElementById('orders-list');
  list.innerHTML = '';
  const filter = document.getElementById('status-filter').value;
  const visible = state.orders.filter(o => !filter || o.status === filter);
  document.getElementById('orders-empty').style.display =
    visible.length ? 'none' : 'block';

  const sorted = visible.slice().sort((a, b) => b.createdAt - a.createdAt);
  for (const o of sorted) {
    const card = document.createElement('div');
    card.className = 'order-card';
    const itemCount = o.items.length;
    const designs = o.items.filter(i => i.design?.thumb).length;
    const customer = customerLabel(o);
    const statusCls = o.status ? 'status-' + o.status : 'status-local';
    const statusTxt = o.status ? statusLabel(o.status) : 'Lokální';
    const supCls = o.supplierPaid ? 'sup-paid' : 'sup-unpaid';
    const supTxt = o.supplierPaid ? 'Dodavatel zaplacen' : 'Dodavatel nezaplacen';
    const totals = computeOrderTotals(o);
    const profit = computeOrderProfit(o);
    const cur = o.currency || 'CZK';
    card.innerHTML = `
      <div>
        <div class="title">${escapeHtml(o.title || customer)}</div>
        <div class="meta">
          ${escapeHtml(customer)} ·
          ${new Date(o.createdAt).toLocaleDateString('cs-CZ')}
          · ${itemCount} položek · ${designs} návrhů
        </div>
      </div>
      <div class="right-col">
        <div class="order-money">
          <div class="om-total">${escapeHtml(fmtMoney(totals.grand, cur))}</div>
          <div class="om-profit">zisk ${escapeHtml(fmtMoney(profit, cur))}${hasActualCost(o) ? '' : ' (předb.)'}</div>
        </div>
        <span class="status-badge ${statusCls}">${escapeHtml(statusTxt)}</span>
        <span class="status-badge sup-pill ${supCls}" data-sup="${o.id}" title="Přepnout platbu dodavateli">${escapeHtml(supTxt)}</span>
        <div class="btn">Otevřít →</div>
      </div>
    `;
    card.querySelector('.sup-pill').addEventListener('click', (e) => {
      e.stopPropagation();
      o.supplierPaid = !o.supplierPaid;
      saveOrders();
      renderOrdersList();
    });
    card.addEventListener('click', () => openOrder(o.id));
    list.appendChild(card);
  }
}

document.getElementById('new-order').addEventListener('click', () => {
  const order = {
    id: uid(),
    createdAt: Date.now(),
    title: 'Objednávka ' + new Date().toLocaleDateString('cs-CZ'),
    orderNumber: '',
    currency: 'CZK',
    foreign: false,
    shipping: 0,
    shipVatRate: 0.21,
    discountPct: 0,
    customer: {
      billing: emptyAddr(),
      shipping: emptyAddr(),
    },
    items: [],
  };
  state.orders.push(order);
  saveOrders();
  openOrder(order.id);
});

function openOrder(id) {
  state.currentOrderId = id;
  renderOrderDetail();
  showStep('order');
}

function renderOrderDetail() {
  const o = getOrder(state.currentOrderId);
  if (!o) { showStep('orders'); return; }
  const titleText = o.orderNumber ? `Objednávka č. ${o.orderNumber}` : o.title;
  document.getElementById('order-title').textContent = titleText;
  document.getElementById('bc-order').textContent = titleText;
  document.getElementById('order-number').value = o.orderNumber || '';
  document.getElementById('bc-shape').textContent = '';
  document.getElementById('bc-size').textContent = '';
  renderStatusSelect(o);
  document.getElementById('order-destination').value = o.foreign ? 'foreign' : 'cz';
  document.getElementById('order-supplier-paid').value = o.supplierPaid ? '1' : '';

  // Fill the two structured address blocks (billing / shipping).
  const cust = normalizeCustomer(o.customer);
  o.customer = cust; // persist normalized shape going forward
  ['bill', 'ship'].forEach(prefix => {
    const data = prefix === 'bill' ? cust.billing : cust.shipping;
    ADDR_FIELDS.forEach(field => {
      const el = document.getElementById(`${prefix}-${field}`);
      if (el) el.value = data[field] || '';
    });
  });
  document.getElementById('bill-iscompany').checked = !!cust.billing.isCompany;

  renderCustomerPicker(o);
  renderItemsList();
  renderSupplierInvoices();
}

// Unikátní zákazníci ze všech objednávek (klíč = firma|jméno z fakturace).
function getCustomerDatabase() {
  const map = new Map();
  for (const o of state.orders) {
    const c = normalizeCustomer(o.customer);
    const key = ((c.billing.company || '') + '|' + (c.billing.name || '')).trim().toLowerCase();
    if (key === '|' || key === '') continue;          // prázdný zákazník
    // nejnovější objednávka vyhrává (nejaktuálnější údaje)
    const prev = map.get(key);
    if (!prev || o.createdAt > prev._at) map.set(key, { billing: c.billing, shipping: c.shipping, _at: o.createdAt });
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => (a.billing.company || a.billing.name).localeCompare(b.billing.company || b.billing.name, 'cs'));
}

function renderCustomerPicker(currentOrder) {
  const sel = document.getElementById('customer-picker');
  if (!sel) return;
  const db = getCustomerDatabase();
  sel.innerHTML = '<option value="">— nový zákazník —</option>';
  db.forEach(c => {
    const label = [c.billing.company, c.billing.name].filter(Boolean).join(' · ') +
      (c.billing.city ? ` (${c.billing.city})` : '');
    const opt = document.createElement('option');
    opt.value = c.key; opt.textContent = label;
    sel.appendChild(opt);
  });
  sel.value = '';
  sel._db = db;
}

document.getElementById('customer-picker').addEventListener('change', (e) => {
  const o = getOrder(state.currentOrderId);
  if (!o) return;
  const sel = e.target;
  const c = (sel._db || []).find(x => x.key === sel.value);
  if (!c) return;
  if (!confirm('Vyplnit fakturační i doručovací údaje tohoto zákazníka?')) { sel.value = ''; return; }
  o.customer = {
    billing: { ...c.billing },
    shipping: { ...c.shipping },
  };
  saveOrders();
  openOrder(o.id);   // znovu vykreslí detail s vyplněnými poli
});

// Customer field changes auto-save (structured billing/shipping).
['bill', 'ship'].forEach(prefix => {
  ADDR_FIELDS.forEach(field => {
    const el = document.getElementById(`${prefix}-${field}`);
    if (!el) return;
    el.addEventListener('input', (e) => {
      const o = getOrder(state.currentOrderId);
      if (!o) return;
      o.customer = normalizeCustomer(o.customer);
      const target = prefix === 'bill' ? o.customer.billing : o.customer.shipping;
      target[field] = e.target.value;
      o._dirty = true;   // pošle se na web při příští synchronizaci
      saveOrders();
    });
  });
});
// Checkbox "na firmu"
document.getElementById('bill-iscompany').addEventListener('change', (e) => {
  const o = getOrder(state.currentOrderId);
  if (!o) return;
  o.customer = normalizeCustomer(o.customer);
  o.customer.billing.isCompany = e.target.checked;
  saveOrders();
});
function renderStatusSelect(o) {
  const sel = document.getElementById('order-status');
  sel.innerHTML = '';
  // WC stavy + naše lokální stavy; vždy včetně aktuálního, i kdyby byl neznámý.
  const keys = Object.keys(ALL_STATUSES);
  if (o.status && !keys.includes(o.status)) keys.unshift(o.status);
  for (const st of keys) {
    const opt = document.createElement('option');
    opt.value = st; opt.textContent = statusLabel(st);
    sel.appendChild(opt);
  }
  if (o.status) sel.value = o.status;
  setOcrStatus('order-status-info',
    o.wcId ? '' : 'Lokální objednávka (nesynchronizuje se na web).');
}
document.getElementById('order-status').addEventListener('change', (e) => {
  const o = getOrder(state.currentOrderId);
  if (!o) return;
  updateWcStatus(o, e.target.value, 'order-status-info');
});
document.getElementById('order-destination').addEventListener('change', (e) => {
  const o = getOrder(state.currentOrderId);
  if (!o) return;
  o.foreign = e.target.value === 'foreign';
  saveOrders();
});

document.getElementById('order-supplier-paid').addEventListener('change', (e) => {
  const o = getOrder(state.currentOrderId);
  if (!o) return;
  o.supplierPaid = e.target.value === '1';
  saveOrders();
  renderOrdersList();
});

document.getElementById('order-number').addEventListener('input', (e) => {
  const o = getOrder(state.currentOrderId);
  if (!o) return;
  o.orderNumber = e.target.value.trim();
  const newTitle = o.orderNumber ? `Objednávka č. ${o.orderNumber}` : o.title;
  document.getElementById('order-title').textContent = newTitle;
  document.getElementById('bc-order').textContent = newTitle;
  saveOrders();
});


// =====================================================================
// OCR — Tesseract.js with Czech+English, with parsing heuristics
// =====================================================================
let _ocrWorker = null;
async function getOcrWorker(onProgress) {
  if (_ocrWorker) return _ocrWorker;
  _ocrWorker = await Tesseract.createWorker(['ces', 'eng'], 1, {
    logger: m => onProgress && onProgress(m),
  });
  return _ocrWorker;
}

function setOcrStatus(elId, text, kind) {
  const el = document.getElementById(elId);
  el.textContent = text;
  el.className = 'ocr-status' + (kind ? ' ' + kind : '');
}

async function runOcr(dataUrl, statusElId) {
  setOcrStatus(statusElId, 'Načítám OCR engine…', 'active');
  const worker = await getOcrWorker((m) => {
    if (m.status && statusElId) {
      const pct = m.progress != null ? Math.round(m.progress * 100) + ' %' : '';
      setOcrStatus(statusElId, `${m.status} ${pct}`.trim(), 'active');
    }
  });
  setOcrStatus(statusElId, 'Rozpoznávám text…', 'active');
  // Tesseract.js v5 returns text-only by default; we explicitly ask for the
  // block / paragraph / line / word tree so we get per-word bounding boxes.
  const { data } = await worker.recognize(dataUrl, {}, { blocks: true, text: true });
  // Flatten words from the block tree into a single list (some versions
  // expose `data.words` directly, others only via `data.blocks`).
  if (!data.words || !data.words.length) {
    const flat = [];
    for (const blk of data.blocks || []) {
      for (const para of blk.paragraphs || []) {
        for (const ln of para.lines || []) {
          for (const w of ln.words || []) flat.push(w);
        }
      }
    }
    data.words = flat;
  }
  return data;
}

// ---------- Customer parsing ----------
// Detect both dotted (62.141.23.197) and spaced (62 141 23 197) IP forms.
// Also validate the four octets are <= 255 so we don't reject real phones.
function looksLikeIp(s) {
  const dotted = s.match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/);
  const spaced = s.match(/\b(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\b/);
  for (const m of [dotted, spaced]) {
    if (m && m.slice(1, 5).every(n => +n <= 255)) return true;
  }
  return false;
}
function normalizePhone(raw) {
  const cleaned = raw.replace(/[^\d+]/g, ' ').trim().replace(/\s+/g, ' ');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 9 && digits.length <= 13) return cleaned;
  return null;
}
function findPhone(text) {
  const lines = text.split('\n');

  // 1) Prefer the value following a "Telefon" label on the same line.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bIP\b/i.test(line)) continue;
    const inline = line.match(/Tel[ea]?fon[^\d+]{0,5}([+\d][\d\s().+-]{7,30})/i);
    if (inline && !looksLikeIp(inline[1])) {
      const n = normalizePhone(inline[1]);
      if (n) return n;
    }
  }
  // 2) "Telefon" alone on a line, number on the next.
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^Tel[ea]?fon[:\s]*$/i.test(lines[i].trim())) continue;
    const next = lines[i + 1].trim();
    if (!next || /\bIP\b/i.test(next) || looksLikeIp(next)) continue;
    const m = next.match(/[+\d][\d\s().+-]{7,30}/);
    if (m) { const n = normalizePhone(m[0]); if (n) return n; }
  }
  // 3) Fallback: any 9-digit-ish sequence with optional +420 prefix, but
  //    only on lines that don't mention IP and don't look like an IP.
  for (const line of lines) {
    if (/\bIP\b/i.test(line)) continue;
    if (looksLikeIp(line)) continue;
    const m = line.match(/(\+?\s*4\s*2\s*0[\s.-]*)?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}/);
    if (m && !looksLikeIp(m[0])) {
      const n = normalizePhone(m[0]);
      if (n) return n;
    }
  }
  return null;
}

// Walk back from a legal-form suffix to grab just the company name itself,
// ignoring any junk to its left ("Datum vytvoření: Neubox CZ s.r.o." → "Neubox CZ s.r.o.").
function extractCompanyFromLine(line) {
  const m = line.match(/(s\.?\s?r\.?\s?o\.?|a\.?\s?s\.?|spol\.?\s+s\s+r\.?\s?o\.?|z\.?\s?s\.?|o\.?\s?p\.?\s?s\.?)\.?\s*$/i);
  if (!m) return null;
  const suffixStart = line.toLowerCase().lastIndexOf(m[1].toLowerCase());
  if (suffixStart < 0) return line.trim();
  const before = line.substring(0, suffixStart).trim();
  const words = before.split(/\s+/);
  const result = [m[0].trim()];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (!w) break;
    // A company-name token starts capitalized/digit and doesn't end with ":"
    if (/^[A-ZÁ-Ž0-9]/.test(w) && !/:$/.test(w)) result.unshift(w);
    else break;
  }
  return result.join(' ');
}

// Try block-level column detection first — Tesseract often segments
// Fakturace / Doprava into separate blocks already.
function detectColumnsByBlocks(data) {
  const blocks = data.blocks || [];
  if (blocks.length < 2) return null;
  const blkText = (b) => {
    if (b.text) return b.text;
    return (b.paragraphs || [])
      .map(p => (p.lines || []).map(l => l.text || '').join('\n')).join('\n');
  };
  let fakBlock = null, dopBlock = null;
  for (const b of blocks) {
    const t = blkText(b);
    if (!fakBlock && /Faktur/i.test(t)) fakBlock = b;
    if (!dopBlock && /Doprav/i.test(t)) dopBlock = b;
  }
  if (!fakBlock || !dopBlock || fakBlock === dopBlock) return null;
  return { faktur: blkText(fakBlock), doprav: blkText(dopBlock) };
}

// ----- Column-aware extraction using word bboxes ------------------------
// WP admin renders Fakturace and Doprava side-by-side. Tesseract returns
// per-word bounding boxes; we use them to assign each word to its column.
function detectAddressColumns(data) {
  const words = (data && data.words) || [];
  if (!words.length) return null;
  let fak = null, dop = null;
  for (const w of words) {
    if (!fak && /^Faktur/i.test(w.text)) fak = w;
    if (!dop && /^Doprav/i.test(w.text)) dop = w;
    if (fak && dop) break;
  }
  if (!fak || !dop) return null;

  const headerH = Math.max(fak.bbox.y1 - fak.bbox.y0, dop.bbox.y1 - dop.bbox.y0);
  const startY  = Math.max(fak.bbox.y1, dop.bbox.y1);
  const maxY    = startY + headerH * 20;

  // Column X-ranges. We REQUIRE words to start at or past each header's left
  // edge — that excludes the "Obecné" column to the left of Fakturace.
  const tol     = headerH * 1.5;
  const fakLeft = fak.bbox.x0 - tol;
  const dopLeft = dop.bbox.x0 - tol;
  const midX    = (fak.bbox.x1 + dop.bbox.x0) / 2;

  const STOP = /^(Checkout|Custom|Položka|Položky|Náklady|Množství|Mezisoučet|Stav|Zákazník)$/i;

  const fakWords = [], dopWords = [];
  for (const w of words) {
    if (w.bbox.y0 <= startY) continue;
    if (w.bbox.y0 > maxY) continue;
    const x = w.bbox.x0;
    if (x >= fakLeft && x < midX) fakWords.push(w);
    else if (x >= dopLeft && x >= midX) dopWords.push(w);
    // anything else (Obecné column, far-right gutter) is ignored
  }
  const trimAtStop = (ws) => {
    ws.sort((a, b) => a.bbox.y0 - b.bbox.y0);
    for (let i = 0; i < ws.length; i++) {
      if (STOP.test(ws[i].text)) return ws.slice(0, i);
    }
    return ws;
  };
  const groupLines = (ws) => {
    // Build lines by Y proximity, then sort each line's words by X so word
    // order matches the original visual reading order.
    const tolY = Math.max(6, headerH * 0.45);
    const lines = [];
    for (const w of ws) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - w.bbox.y0) < tolY) last.words.push(w);
      else lines.push({ y: w.bbox.y0, words: [w] });
    }
    lines.forEach(l => l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0));
    return lines.map(l => l.words.map(w => w.text).join(' ')).join('\n');
  };
  return {
    faktur: groupLines(trimAtStop(fakWords)),
    doprav: groupLines(trimAtStop(dopWords)),
  };
}

// Parse one column's text into structured pieces.
const COMPANY_RE = /([A-ZÁ-Ž][\wÁ-Žá-ž&.-]*(?:\s+[A-ZÁ-Ž0-9][\wÁ-Žá-ž&.-]*){0,4}\s+(?:s\.?\s?r\.?\s?o\.?|a\.?\s?s\.?|spol\.?\s+s\s+r\.?\s?o\.?|o\.?\s?p\.?\s?s\.?|z\.?\s?s\.?))/;
const LEGAL_SUFFIX_RE = /(s\.?\s?r\.?\s?o\.?|a\.?\s?s\.?|spol\.?\s+s\s+r\.?\s?o\.?|z\.?\s?s\.?|o\.?\s?p\.?\s?s\.?)$/i;

function parseAddressBlock(text) {
  const out = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Email + phone
  const emailM = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (emailM) out.email = emailM[0];
  const phone = findPhone(text);
  if (phone) out.phone = phone;

  // Company: line ending with a legal-form suffix. Walk back to drop labels
  // that may share the same OCR row (e.g. "Datum vytvoření:").
  for (const line of lines) {
    if (LEGAL_SUFFIX_RE.test(line)) {
      out.company = extractCompanyFromLine(line) || line;
      break;
    }
  }

  // PSČ line
  for (const line of lines) {
    const m = line.match(/^(\d{3})\s?(\d{2})\s+(.+?)$/);
    if (m && +m[1] >= 100 && +m[1] <= 999) {
      out.psc = `${m[1]} ${m[2]} ${m[3].trim()}`;
      break;
    }
  }
  // Street
  for (const line of lines) {
    if (out.psc && line === out.psc) continue;
    if (out.company && line === out.company) continue;
    if (/^\d{3}\s?\d{2}\b/.test(line)) continue;
    if (/[\w.+-]+@/.test(line)) continue;
    if (/^Tel|^E-?mail|^Faktur|^Doprav/i.test(line)) continue;
    const sm = line.match(/^([A-ZÁ-Ža-zá-ž][\wÁ-Žá-ž .-]{1,40}?\s+\d{1,5}(?:\/\d{1,5})?)$/);
    if (sm) { out.street = sm[1].trim(); break; }
  }
  // Name: line of exactly two capitalized words
  for (const line of lines) {
    if (out.company && line === out.company) continue;
    if (out.street && line === out.street) continue;
    if (out.psc && line === out.psc) continue;
    if (/[\w.+-]+@/.test(line)) continue;
    if (/^[+\d][\d\s().+-]+$/.test(line)) continue;
    if (/^(Tel|E-?mail|Faktur|Doprav)/i.test(line)) continue;
    const nm = line.match(/^([A-ZÁ-Ž][a-zá-ž]{1,20})\s+([A-ZÁ-Ž][a-zá-ž]{1,20})$/);
    if (nm) { out.name = line; break; }
  }

  // Complete address block: firma + jméno + ulice + PSČ + e-mail + telefon
  const parts = [];
  if (out.company) parts.push(out.company);
  if (out.name)    parts.push(out.name);
  if (out.street)  parts.push(out.street);
  if (out.psc)     parts.push(out.psc);
  if (out.email)   parts.push('E-mail: ' + out.email);
  if (out.phone)   parts.push('Telefon: ' + out.phone);
  if (parts.length >= 2) out.address = parts.join('\n');
  return out;
}

// WordPress admin shows Fakturace + Doprava as TWO COLUMNS; OCR reads rows and
// merges both columns together, so section-based parsing fails. Instead we
// extract canonical pieces (company, person name, street with house number,
// PSČ + city) by pattern from anywhere in the text and assemble the address.
function parseCustomer(text) {
  const out = {};

  // Email
  const emailM = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (emailM) out.email = emailM[0];

  // Phone (helper defined above)
  const phone = findPhone(text);
  if (phone) out.phone = phone;

  // Order number: "Objednávka č. 825" / "Objednávka 825 –"
  const orderNumM = text.match(/Objedn[aá]vk[ay]\s*(?:č\.?|c\.?|#)?\s*(\d{1,8})/i);
  if (orderNumM) out.orderNumber = orderNumM[1];

  // Company: legal-form suffixes are a strong signal.
  const companyM = text.match(
    /([A-ZÁ-Ž][\wÁ-Žá-ž&.-]*(?:\s+[A-ZÁ-Ž0-9][\wÁ-Žá-ž&.-]*){0,4}\s+(?:s\.?\s?r\.?\s?o\.?|a\.?\s?s\.?|spol\.?\s+s\s+r\.?\s?o\.?|o\.?\s?p\.?\s?s\.?|z\.?\s?s\.?))/
  );
  if (companyM) out.company = companyM[1].replace(/\s+/g, ' ').trim();

  // PSČ + city: "702 00 Moravská Ostrava"
  const pscM = text.match(/\b(\d{3})\s?(\d{2})\s+([A-ZÁ-Ž][A-Za-zÁ-Žá-ž\s.-]{1,60}?)(?=\s{2,}|\s+[A-ZÁ-Ž][a-zá-ž]+\s+s\.|\s*$|\n)/);
  let cityLine = null;
  if (pscM) {
    const city = pscM[3].trim().replace(/\s+[A-ZÁ-Ž][a-zá-ž]+\s+[A-ZÁ-Ž][a-zá-ž]+.*$/, '').trim();
    cityLine = `${pscM[1]} ${pscM[2]} ${city}`;
  }

  // Street with house number: "U Parku 2867/1"
  // Words starting capital/lower, ending with number (optionally NN/NN).
  const streetM = text.match(/\b([A-ZÁ-Ža-zá-ž][A-Za-zÁ-Žá-ž.\s]{1,40}?\s+\d{1,5}(?:\/\d{1,5})?)\b/);
  let streetLine = streetM ? streetM[1].trim() : null;

  // Person name: two consecutive capitalized words (Czech). Filter out known
  // headings, cities, and slices of the company name.
  const blacklist = /^(Fakturace|Doprava|Doručovací|Doručení|Pokladna|Praha|Brno|Ostrava|Plzeň|Liberec|Olomouc|Hradec|Pardubice|Zlín|Custom Fields|Položka|Cena celkem|Číslo ID|Plážové vlajky|Návrh vlajky|Návrh na|U Parku)/i;
  let nameLine = null;
  const nameRe = /\b([A-ZÁ-Ž][a-zá-ž]{1,20})\s+([A-ZÁ-Ž][a-zá-ž]{1,20})\b/g;
  for (const m of text.matchAll(nameRe)) {
    const cand = m[0];
    if (blacklist.test(cand)) continue;
    if (out.company && out.company.includes(cand)) continue;
    if (cityLine && cityLine.includes(cand)) continue;
    if (streetLine && streetLine.includes(cand)) continue;
    nameLine = cand;
    break;
  }
  if (nameLine) out.name = nameLine;

  // Assemble address (used for both billing & shipping — user can edit).
  const addr = [];
  if (out.company) addr.push(out.company);
  if (out.name)    addr.push(out.name);
  if (streetLine)  addr.push(streetLine);
  if (cityLine)    addr.push(cityLine);
  if (addr.length >= 2) {
    const joined = addr.join('\n');
    out.billing = joined;
    out.shipping = joined;
  }
  return out;
}

// ---------- Order items parsing ----------
const SHIPPING_RE = /^(Položky[:\s]|GLS|DPD|PPL|Česká pošta|Zásilkovna|Doprava\s*:)/i;

function parseOrderItems(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  let cur = null;
  const finish = () => {
    if (cur && cur.shape && cur.size) {
      if (!cur.qty) cur.qty = 1;
      items.push({ shape: cur.shape, size: cur.size, qty: cur.qty });
    }
    cur = null;
  };
  for (const line of lines) {
    // Shipping section repeats the product — skip it so we don't double-count.
    if (SHIPPING_RE.test(line)) { finish(); continue; }

    const tvar = line.match(/Tvar\s*[:\s]\s*([A-F])\b/i);
    const vel = line.match(/Velikost\s*[:\s]\s*(XL|S|M|L)\b/i);
    const qty = line.match(/[x×]\s*(\d{1,3})\b/);
    if (tvar) { if (cur && cur.shape) finish(); cur = cur || {}; cur.shape = tvar[1].toUpperCase(); }
    if (vel)  { cur = cur || {}; cur.size = vel[1].toUpperCase(); }
    if (qty && cur) cur.qty = parseInt(qty[1], 10);
    const compact = line.match(/\b([A-F])\s*,\s*(XL|S|M|L)\b/);
    if (compact && !tvar && !vel) {
      if (cur && cur.shape) finish();
      cur = { shape: compact[1].toUpperCase(), size: compact[2].toUpperCase() };
      if (qty) cur.qty = parseInt(qty[1], 10);
    }
  }
  finish();

  // Dedupe by shape+size — keep max qty so duplicate scans don't multiply rows.
  const map = new Map();
  for (const it of items) {
    const k = it.shape + '|' + it.size;
    const ex = map.get(k);
    if (!ex || it.qty > ex.qty) map.set(k, it);
  }
  return Array.from(map.values());
}

document.getElementById('delete-order').addEventListener('click', () => {
  if (!confirm('Opravdu smazat tuto objednávku?')) return;
  state.orders = state.orders.filter(o => o.id !== state.currentOrderId);
  saveOrders();
  state.currentOrderId = null;
  renderOrdersList();
  showStep('orders');
});

// ---------- Items ----------
const SHAPES = ['A', 'B', 'C', 'D', 'E', 'F'];
const SIZES = ['S', 'M', 'L', 'XL'];
const BANNER_PRICE_PER_M2 = 407.5;          // Kč/m² bez DPH (PVC bannery)
function isBanner(it) { return it && it.type === 'banner'; }
// Plocha banneru v m² ze zadaných rozměrů v cm.
function bannerAreaM2(it) {
  return ((it.widthCm || 0) / 100) * ((it.heightCm || 0) / 100);
}
// Cena PVC banneru za kus = plocha (m²) × cena/m², zaokrouhleno nahoru na Kč.
function bannerUnitPrice(it) {
  return Math.ceil(bannerAreaM2(it) * BANNER_PRICE_PER_M2 - 1e-6);
}

// Udrží item.designs (jeden návrh na kus) v souladu s aktuálním počtem kusů.
function ensureDesignsLength(item) {
  const n = Math.max(1, item.qty || 1);
  if (!Array.isArray(item.designs)) item.designs = [];
  while (item.designs.length < n) item.designs.push(null);
  if (item.designs.length > n) item.designs.length = n;
}

document.getElementById('add-item').addEventListener('click', () => {
  const o = getOrder(state.currentOrderId);
  if (!o) return;
  o.items.push({ id: uid(), type: 'flag', shape: 'A', size: 'M', qty: 1, unitPrice: 0, vatRate: 0.21, design: null });
  saveOrders();
  renderItemsList();
});

document.getElementById('add-banner').addEventListener('click', () => {
  const o = getOrder(state.currentOrderId);
  if (!o) return;
  o.items.push({ id: uid(), type: 'banner', widthCm: 100, heightCm: 100, qty: 1,
    unitPrice: bannerUnitPrice({ widthCm: 100, heightCm: 100 }), vatRate: 0.21, design: null });
  saveOrders();
  renderItemsList();
});

// Money formatting in CZK (or order currency).
function fmtMoney(n, currency) {
  const cur = currency || 'CZK';
  // Round UP to whole crowns (with a tiny epsilon so 1234.00 stays 1234).
  const v = Math.ceil((n || 0) - 1e-6);
  try {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur,
      minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  } catch {
    return v.toLocaleString('cs-CZ') + ' ' + cur;
  }
}

function renderItemsList() {
  const o = getOrder(state.currentOrderId);
  const wrap = document.getElementById('items-list');
  wrap.innerHTML = '';
  if (!o) return;
  o.items.forEach((item) => {
    if (item.type == null) item.type = 'flag';
    if (item.unitPrice == null) item.unitPrice = 0;
    if (item.vatRate == null) item.vatRate = 0.21;
    const row = document.createElement('div');
    row.className = 'item-row';

    if (isBanner(item)) {
      renderBannerRow(o, item, row, wrap);
      return;
    }

    const lineEx = (item.unitPrice || 0) * (item.qty || 0);
    const thumbStyle = item.design?.thumb ? `background-image:url('${item.design.thumb}')` : '';
    row.innerHTML = `
      <div class="item-thumb-lead ${item.design?.thumb ? '' : 'empty'}" style="${thumbStyle}"></div>
      <label class="field">tvar
        <select class="item-shape">
          ${SHAPES.map(s => `<option value="${s}" ${s===item.shape?'selected':''}>${s}</option>`).join('')}
        </select>
      </label>
      <label class="field">velikost
        <select class="item-size">
          ${SIZES.map(s => `<option value="${s}" ${s===item.size?'selected':''}>${s}</option>`).join('')}
        </select>
      </label>
      <label class="field">počet
        <input class="item-qty" type="number" min="1" value="${item.qty}">
      </label>
      <label class="field">cena/ks bez DPH
        <input class="item-price" type="number" min="0" step="0.01" value="${item.unitPrice}">
      </label>
      <div class="field">celkem bez DPH
        <span class="item-linetotal">${fmtMoney(lineEx, o.currency)}</span>
      </div>
      <div class="item-spacer"></div>
      <div class="item-actions">
        ${renderArtworkLinks(item)}
        <button class="btn item-design">${item.design ? 'Upravit návrh' : 'Vytvořit návrh'}</button>
        <button class="btn danger item-delete">×</button>
      </div>
    `;
    row.querySelector('.item-shape').addEventListener('change', (e) => {
      item.shape = e.target.value;
      item.design = null; // shape change invalidates design
      saveOrders();
      renderItemsList();
    });
    row.querySelector('.item-size').addEventListener('change', (e) => {
      item.size = e.target.value;
      item.design = null;
      saveOrders();
      renderItemsList();
    });
    const refreshLine = () => {
      saveOrders();
      renderTotals();
      row.querySelector('.item-linetotal').textContent =
        fmtMoney(item.unitPrice * item.qty, o.currency);
    };
    row.querySelector('.item-qty').addEventListener('input', (e) => {
      item.qty = parseInt(e.target.value, 10) || 1;
      refreshLine();
    });
    row.querySelector('.item-price').addEventListener('input', (e) => {
      item.unitPrice = parseFloat(e.target.value) || 0;
      refreshLine();
    });
    row.querySelector('.item-design').addEventListener('click', () => {
      openEditorForItem(item.id);
    });
    row.querySelector('.item-delete').addEventListener('click', () => {
      if (!confirm('Smazat položku?')) return;
      o.items = o.items.filter(i => i.id !== item.id);
      saveOrders();
      renderItemsList();
    });
    wrap.appendChild(row);
  });
  renderTotals();
}

// Row for a PVC banner: enter width & height (m), price = area × Kč/m².
function renderBannerRow(o, item, row, wrap) {
  row.classList.add('banner-row');
  const recalc = () => { item.unitPrice = bannerUnitPrice(item); };
  recalc();
  const lineEx = item.unitPrice * (item.qty || 0);
  const doneCount = item.multiArtwork ? (item.designs || []).filter(Boolean).length : null;
  const hasAnyDesign = item.multiArtwork ? doneCount > 0 : !!item.design;
  row.innerHTML = `
    <div class="item-thumb-lead banner-badge">PVC</div>
    <label class="field">šířka (cm)
      <input class="banner-w" type="number" min="0" step="1" value="${item.widthCm}">
    </label>
    <label class="field">výška (cm)
      <input class="banner-h" type="number" min="0" step="1" value="${item.heightCm}">
    </label>
    <label class="field">počet
      <input class="item-qty" type="number" min="1" value="${item.qty}">
    </label>
    <div class="field">cena/ks bez DPH
      <span class="item-unit">${fmtMoney(item.unitPrice, o.currency)}</span>
      <small class="muted banner-area">${bannerAreaM2(item).toFixed(2)} m² × ${BANNER_PRICE_PER_M2} Kč</small>
    </div>
    <div class="field">celkem bez DPH
      <span class="item-linetotal">${fmtMoney(lineEx, o.currency)}</span>
    </div>
    <div class="item-spacer"></div>
    <div class="item-actions">
      ${renderArtworkLinks(item)}
      ${item.multiArtwork ? `<small class="muted">${doneCount}/${item.qty} grafik</small>` : ''}
      <button class="btn item-design">${hasAnyDesign ? 'Upravit návrh' : 'Vytvořit návrh'}</button>
      <button class="btn danger item-delete">×</button>
    </div>
  `;
  const refresh = () => {
    recalc();
    saveOrders();
    renderTotals();
    row.querySelector('.item-unit').textContent = fmtMoney(item.unitPrice, o.currency);
    row.querySelector('.banner-area').textContent = `${bannerAreaM2(item).toFixed(2)} m² × ${BANNER_PRICE_PER_M2} Kč`;
    row.querySelector('.item-linetotal').textContent = fmtMoney(item.unitPrice * (item.qty || 0), o.currency);
  };
  row.querySelector('.banner-w').addEventListener('input', (e) => {
    item.widthCm = parseFloat(e.target.value) || 0; refresh();
  });
  row.querySelector('.banner-h').addEventListener('input', (e) => {
    item.heightCm = parseFloat(e.target.value) || 0; refresh();
  });
  row.querySelector('.item-qty').addEventListener('input', (e) => {
    item.qty = parseInt(e.target.value, 10) || 1; refresh();
  });
  row.querySelector('.item-design').addEventListener('click', () => {
    openEditorForItem(item.id);
  });
  row.querySelector('.item-delete').addEventListener('click', () => {
    if (!confirm('Smazat položku?')) return;
    o.items = o.items.filter(i => i.id !== item.id);
    saveOrders();
    renderItemsList();
  });
  wrap.appendChild(row);
}

// Shared totals computation (bez DPH / DPH / s DPH). Discount applies to
// products only; shipping unchanged. Used by detail, invoice and stats.
// Cost (náklad) of an order's products from settings.costPerSize.
// Sum of supplier invoices converted to CZK (actual expense).
function supplierActualCostCzk(o) {
  return (o.supplierInvoices || []).reduce((s, inv) => s + (inv.amountCzk || 0), 0);
}
// True if we have at least one converted supplier invoice → exact cost known.
function hasActualCost(o) { return supplierActualCostCzk(o) > 0; }

function computeOrderCost(o) {
  // Prefer ACTUAL supplier invoices (in CZK) if present – exact expense.
  const actual = supplierActualCostCzk(o);
  if (actual > 0) return actual;
  // Otherwise fall back to the estimated cost per size.
  const cps = state.settings.costPerSize || {};
  let cost = 0;
  for (const it of (o.items || [])) {
    cost += (cps[it.size] || 0) * (it.qty || 0);
  }
  return cost;
}
// Profit = základ daně celkem (produkty po slevě + doprava, bez DPH) − náklad.
function computeOrderProfit(o) {
  const t = computeOrderTotals(o);
  return t.totalEx - computeOrderCost(o);
}

function computeOrderTotals(o) {
  const discountPct = o.discountPct || 0;
  const f = (x) => discountPct ? x * (1 - discountPct / 100) : x;
  let prodEx = 0, prodVat = 0;
  for (const it of (o.items || [])) {
    const lineEx = (it.unitPrice || 0) * (it.qty || 0);
    prodEx += lineEx;
    prodVat += lineEx * (it.vatRate != null ? it.vatRate : 0.21);
  }
  const discountEx = prodEx * (discountPct / 100);
  const netProdEx = prodEx - discountEx;
  const netProdVat = f(prodVat);
  const shipEx = o.shipping || 0;
  const shipVat = shipEx * (o.shipVatRate != null ? o.shipVatRate : 0.21);
  const totalEx = netProdEx + shipEx;
  const totalVat = netProdVat + shipVat;
  return {
    prodEx, discountEx, netProdEx, netProdVat,
    shipEx, shipVat, totalEx, totalVat,
    grand: totalEx + totalVat,
  };
}

// Totals box (WC-style): everything broken into bez DPH / DPH / s DPH.
function renderTotals() {
  const o = getOrder(state.currentOrderId);
  const box = document.getElementById('order-totals');
  if (!o) { box.innerHTML = ''; return; }
  if (o.shipping == null) o.shipping = 0;
  if (o.shipVatRate == null) o.shipVatRate = 0.21;
  if (o.discountPct == null) o.discountPct = 0;
  const cur = o.currency;
  const t = computeOrderTotals(o);
  const { prodEx, discountEx, totalEx, totalVat, grand } = t;
  const shipEx = t.shipEx;

  const row = (label, val, cls = '') =>
    `<div class="totals-row ${cls}"><span>${label}</span><span>${fmtMoney(val, cur)}</span></div>`;

  box.innerHTML = `
    ${row('Mezisoučet položek (bez DPH)', prodEx)}
    <div class="totals-row discount-controls">
      <span>Sleva z produktů:
        <button class="btn mini ${o.discountPct===0?'active':''}" data-disc="0">0 %</button>
        <button class="btn mini ${o.discountPct===5?'active':''}" data-disc="5">5 %</button>
        <button class="btn mini ${o.discountPct===10?'active':''}" data-disc="10">10 %</button>
      </span>
      <span>${o.discountPct ? '− ' + fmtMoney(discountEx, cur) : '—'}</span>
    </div>
    <div class="totals-row"><span>Doprava (bez DPH)
      <input class="ship-input" type="number" min="0" step="0.01" value="${o.shipping}"></span>
      <span>${fmtMoney(shipEx, cur)}</span></div>
    ${row('Základ daně celkem (bez DPH)', totalEx)}
    ${row('DPH', totalVat)}
    ${row('Celkem k úhradě (s DPH)', grand, 'grand')}
  `;

  box.querySelectorAll('[data-disc]').forEach(btn => {
    btn.addEventListener('click', () => {
      o.discountPct = parseInt(btn.dataset.disc, 10) || 0;
      saveOrders();
      renderTotals();
    });
  });
  box.querySelector('.ship-input').addEventListener('input', (e) => {
    o.shipping = parseFloat(e.target.value) || 0;
    saveOrders();
    renderTotals();
  });
}

// ---------- Supplier invoices (EUR → CZK via ČNB rate) ----------
async function fetchCnbRate(dateIso, currency = 'EUR') {
  const res = await fetch(`/api/exchange-rate?date=${encodeURIComponent(dateIso)}&currency=${currency}`);
  let j;
  try { j = await res.json(); } catch { throw new Error('Server nevrátil platnou odpověď (běží node server.js?).'); }
  if (!j.ok) throw new Error(j.error || 'Kurz se nepodařilo načíst.');
  return j; // { rate, amount, perUnit, date, source }
}

function renderSupplierInvoices() {
  const o = getOrder(state.currentOrderId);
  const list = document.getElementById('supplier-invoices-list');
  const summary = document.getElementById('supplier-cost-summary');
  if (!o || !list) return;
  // default date = today
  const dEl = document.getElementById('sup-inv-date');
  if (dEl && !dEl.value) dEl.value = new Date().toISOString().slice(0, 10);

  const invs = o.supplierInvoices || [];
  if (!invs.length) {
    list.innerHTML = '<p class="muted">Zatím žádná faktura od dodavatele.</p>';
  } else {
    list.innerHTML = invs.map((inv, i) => `
      <div class="sup-inv-row">
        <span class="sii-file">${inv.fileData
          ? `<a href="${inv.fileData}" download="${escapeHtml(inv.filename || 'faktura')}" target="_blank">📎 ${escapeHtml(inv.filename || 'faktura')}</a>`
          : '—'}</span>
        <span class="sii-eur">${(inv.amountEur || 0).toFixed(2)} €</span>
        <span class="sii-rate muted">kurz ${inv.rate ? inv.rate.toFixed(3) : '?'} (${escapeHtml(inv.rateDate || inv.date || '')})</span>
        <span class="sii-czk"><strong>${fmtMoney(inv.amountCzk || 0, 'CZK')}</strong></span>
        <button class="rm" data-rm="${i}" title="Odebrat">×</button>
      </div>`).join('');
    list.querySelectorAll('[data-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        invs.splice(parseInt(btn.dataset.rm, 10), 1);
        o.supplierInvoices = invs;
        saveOrders();
        renderSupplierInvoices();
        renderOrdersList();
        renderStats(); renderEarnings();
      });
    });
  }

  const totalCzk = supplierActualCostCzk(o);
  if (totalCzk > 0) {
    const profit = computeOrderProfit(o);
    summary.innerHTML =
      `<div class="totals-row"><span>Náklady dodavateli celkem</span><span>${fmtMoney(totalCzk, 'CZK')}</span></div>
       <div class="totals-row grand"><span>Přesný zisk (výnos − náklady)</span><span>${fmtMoney(profit, 'CZK')}</span></div>`;
  } else {
    summary.innerHTML = '<p class="muted">Zatím počítáme s předběžnými náklady (z nastavení marže). Po nahrání faktury dodavatele se zisk přepočítá přesně.</p>';
  }
}

(function wireSupplierInvoices() {
  const addBtn = document.getElementById('sup-inv-add');
  if (!addBtn) return;
  addBtn.addEventListener('click', async () => {
    const o = getOrder(state.currentOrderId);
    if (!o) return;
    const fileEl = document.getElementById('sup-inv-file');
    const eurEl = document.getElementById('sup-inv-eur');
    const dateEl = document.getElementById('sup-inv-date');
    const eur = parseFloat(eurEl.value);
    const dateIso = dateEl.value;
    if (!eur || eur <= 0) { setOcrStatus('sup-inv-status', 'Zadej částku v EUR.', 'error'); return; }
    if (!dateIso) { setOcrStatus('sup-inv-status', 'Zadej datum.', 'error'); return; }
    setOcrStatus('sup-inv-status', 'Načítám kurz ČNB…', 'active');
    try {
      const r = await fetchCnbRate(dateIso, 'EUR');
      const perUnit = r.perUnit || (r.rate / (r.amount || 1));
      const amountCzk = Math.round(eur * perUnit * 100) / 100;
      // optional file
      let fileData = null, filename = null;
      const file = fileEl.files && fileEl.files[0];
      if (file) {
        fileData = await new Promise((res, rej) => {
          const rd = new FileReader();
          rd.onload = ev => res(ev.target.result);
          rd.onerror = rej;
          rd.readAsDataURL(file);
        });
        filename = file.name;
      }
      o.supplierInvoices = o.supplierInvoices || [];
      o.supplierInvoices.push({
        id: uid(), filename, fileData,
        amountEur: eur, rate: perUnit, rateDate: r.date, date: dateIso,
        amountCzk, source: r.source || 'ČNB',
      });
      saveOrders();
      eurEl.value = ''; fileEl.value = '';
      setOcrStatus('sup-inv-status', `Převedeno kurzem ${perUnit.toFixed(3)} Kč/€ (${r.date}) → ${fmtMoney(amountCzk, 'CZK')} ✓`, 'done');
      renderSupplierInvoices();
      renderOrdersList();
      renderStats(); renderEarnings();
    } catch (e) {
      setOcrStatus('sup-inv-status', 'Chyba: ' + e.message, 'error');
    }
  });
})();

// Download links for any artwork the customer attached to this order line.
function renderArtworkLinks(item) {
  const files = [...(item.artworkImages || []), ...(item.artworkFiles || [])];
  if (!files.length) return '';
  return files.map((url, i) => {
    const label = files.length > 1 ? `⬇ Grafika ${i + 1}` : '⬇ Grafika';
    // download attribute hints the browser to save; works for same-origin and
    // most cross-origin static files.
    return `<a class="btn artwork-link" href="${escapeHtml(url)}" download target="_blank" rel="noopener">${label}</a>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// =====================================================================
// EDITOR — open from an order item
// =====================================================================

async function openEditorForItem(itemId) {
  const o = getOrder(state.currentOrderId);
  const item = getItem(state.currentOrderId, itemId);
  if (!o || !item) return;
  state.currentItemId = itemId;

  // Barva rukávu na tyč je jen u HS vlajek (banner tuto volbu nemá).
  document.getElementById('sleeve-color-row').style.display = isBanner(item) ? 'none' : '';

  // PVC banner: obdélníkový rámeček v poměru rozměrů (žádná PDF šablona).
  if (isBanner(item)) {
    state.shape = 'banner';
    state.size = `${item.widthCm}×${item.heightCm}`;
    document.getElementById('bc-shape').textContent = 'PVC banner';
    document.getElementById('bc-size').textContent = `${item.widthCm}×${item.heightCm} cm`;

    const toggleWrap = document.getElementById('multi-artwork-toggle-wrap');
    const toggle = document.getElementById('multi-artwork-toggle');
    if ((item.qty || 1) > 1) {
      toggleWrap.style.display = '';
      document.getElementById('multi-artwork-count').textContent = item.qty;
      toggle.checked = !!item.multiArtwork;
    } else {
      toggleWrap.style.display = 'none';
      toggle.checked = false;
      item.multiArtwork = false;
    }

    showStep('editor');
    state.multiMode = !!item.multiArtwork && (item.qty || 1) > 1;
    document.getElementById('stage-container').classList.toggle('multi-stage', state.multiMode);
    if (state.multiMode) {
      await renderBannerPieces(item);
    } else {
      loadBannerTemplate(item);
      await restoreDesign(item.design);
    }
    return;
  }

  document.getElementById('multi-artwork-toggle-wrap').style.display = 'none';
  document.getElementById('stage-container').classList.remove('multi-stage');
  state.multiMode = false;

  state.shape = item.shape;
  state.size = item.size;
  // Pořadí šablon: nové HS šablony (assets/HS/{VEL}/{VEL}{TVAR} HS.pdf) mají
  // přednost, pak starší sablony_grafika, nakonec původní Šablony vlajek.
  state.templateCandidates = [
    `assets/HS/${item.size}/${item.size}${item.shape} HS.pdf`,
    `sablony_grafika/${item.size}${item.shape}.pdf`,
    `Šablony vlajek/TVAR ${item.shape}/Beachflag_${item.size}${item.shape}_HS.pdf`,
  ];
  document.getElementById('bc-shape').textContent = 'Tvar: ' + item.shape;
  document.getElementById('bc-size').textContent = 'Velikost: ' + item.size;
  showStep('editor');
  await loadTemplate();
  setSleeveColor((item.design && item.design.sleeveColor) || 'white');
  await restoreDesign(item.design);
}

// =====================================================================
// EDITOR — template processing
// =====================================================================

// Synthetic rectangular "template" for a PVC banner (frame in W×H aspect).
// opts: { containerId, targetSize, maxW, maxH } — used to render one of
// several stacked stages when the item has per-piece designs (see
// renderBannerPieces()); defaults reproduce the original single-stage behavior.
function loadBannerTemplate(item, opts) {
  const containerId = (opts && opts.containerId) || 'stage-container';
  document.getElementById(containerId).innerHTML = '';
  const pad = 50;
  const aspect = (item.widthCm || 1) / (item.heightCm || 1);
  const target = (opts && opts.targetSize) || 820;
  let innerW, innerH;
  if (aspect >= 1) { innerW = target; innerH = Math.round(target / aspect); }
  else { innerH = target; innerW = Math.round(target * aspect); }
  const W = innerW + pad * 2, H = innerH + pad * 2;

  // Template canvas: white page + thin frame in the banner rectangle.
  const tc = document.createElement('canvas'); tc.width = W; tc.height = H;
  const ctx = tc.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 2;
  ctx.strokeRect(pad + 1, pad + 1, innerW - 2, innerH - 2);

  const lc = document.createElement('canvas'); lc.width = W; lc.height = H;

  state.templateBytes = null;
  state.templateCanvas = tc;
  state.linesCanvas = lc;
  state.flagPolygon = [[pad, pad], [pad + innerW, pad], [pad + innerW, pad + innerH], [pad, pad + innerH]];
  state.hasZones = false; state.zonesCanvas = null; state.legendCanvas = null;
  state.sourceW = W; state.sourceH = H;
  state.pdfPageSize = { width: W, height: H };

  const maxW = (opts && opts.maxW) || Math.min(900, window.innerWidth - 80);
  const maxH = (opts && opts.maxH) || (window.innerHeight - 380);
  state.scale = Math.min(maxW / W, maxH / H, 2);

  initStage(containerId);
}

async function loadTemplate() {
  const loading = document.getElementById('loading');
  loading.classList.add('show');
  loading.textContent = 'Načítám šablonu…';
  document.getElementById('stage-container').innerHTML = '';

  try {
    // Zkus kandidáty v pořadí (nová šablona → fallback na starou).
    const candidates = state.templateCandidates ||
      [state.templatePath].filter(Boolean);
    let res = null;
    for (const path of candidates) {
      const r = await fetch(encodeURI(path));
      if (r.ok) { res = r; state.templatePath = path; break; }
    }
    if (!res) throw new Error('Šablonu se nepodařilo načíst (žádný soubor nenalezen).');
    state.templateBytes = await res.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: state.templateBytes.slice(0) }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1 });
    state.pdfPageSize = { width: viewport.width, height: viewport.height };

    const maxW = Math.min(900, window.innerWidth - 80);
    const maxH = window.innerHeight - 380;
    state.scale = Math.min(maxW / viewport.width, maxH / viewport.height, 2);

    const renderViewport = page.getViewport({ scale: state.scale * state.sourceScale });
    const pad = 60;
    const innerW = Math.ceil(renderViewport.width);
    const innerH = Math.ceil(renderViewport.height);
    const padded = document.createElement('canvas');
    padded.width = innerW + pad * 2;
    padded.height = innerH + pad * 2;
    const pctx = padded.getContext('2d');
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, padded.width, padded.height);
    pctx.save();
    pctx.translate(pad, pad);
    await page.render({ canvasContext: pctx, viewport: renderViewport }).promise;
    pctx.restore();

    const processed = processTemplate(padded);

    const crop = (src) => {
      const c = document.createElement('canvas');
      c.width = innerW; c.height = innerH;
      c.getContext('2d').drawImage(src, pad, pad, innerW, innerH, 0, 0, innerW, innerH);
      return c;
    };
    state.templateCanvas = crop(processed.cleanedTemplate);
    state.linesCanvas = crop(processed.linesCanvas);
    state.flagPolygon = processed.flagPolygon.map(p => [p[0] - pad, p[1] - pad]);
    state.hasZones = processed.hasZones;
    state.zonesCanvas = processed.zonesCanvas ? crop(processed.zonesCanvas) : null;
    state.legendCanvas = processed.legendCanvas ? crop(processed.legendCanvas) : null;
    state.sourceW = innerW;
    state.sourceH = innerH;

    initStage();
  } catch (e) {
    loading.textContent = 'Chyba: ' + e.message + ' (Otevři přes lokální server, ne file://)';
  }
}

// Moore-Neighbor contour tracing on a binary mask.
function traceContour(mask, w, h) {
  let sx = -1, sy = -1;
  for (let y = 0; y < h && sx < 0; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (mask[row + x]) { sx = x; sy = y; break; }
    }
  }
  if (sx < 0) return [];
  const dx = [0, 1, 1, 1, 0, -1, -1, -1];
  const dy = [-1, -1, 0, 1, 1, 1, 0, -1];
  const points = [[sx, sy]];
  let cx = sx, cy = sy;
  let backDir = 6;
  const limit = w * h * 4;
  for (let it = 0; it < limit; it++) {
    let nextDir = -1;
    for (let i = 1; i <= 8; i++) {
      const d = (backDir + i) % 8;
      const nx = cx + dx[d], ny = cy + dy[d];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (mask[ny * w + nx]) { nextDir = d; break; }
    }
    if (nextDir < 0) break;
    cx += dx[nextDir]; cy += dy[nextDir];
    backDir = (nextDir + 4) % 8;
    if (cx === sx && cy === sy && points.length > 2) break;
    points.push([cx, cy]);
  }
  return points;
}

function rdp(points, epsilon) {
  const n = points.length;
  if (n < 3) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    const a = points[start], b = points[end];
    const abx = b[0] - a[0], aby = b[1] - a[1];
    const len2 = abx * abx + aby * aby;
    let maxD = 0, idx = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      let d;
      if (len2 === 0) {
        d = Math.hypot(p[0] - a[0], p[1] - a[1]);
      } else {
        let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = a[0] + t * abx, py = a[1] + t * aby;
        d = Math.hypot(p[0] - px, p[1] - py);
      }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > epsilon && idx > 0) {
      keep[idx] = 1;
      stack.push([start, idx]);
      stack.push([idx, end]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function processTemplate(srcCanvas) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const srcImg = srcCanvas.getContext('2d').getImageData(0, 0, w, h);
  const src = srcImg.data;

  const rawBoundary = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (Math.min(src[i*4], src[i*4+1], src[i*4+2]) < 225) rawBoundary[i] = 1;
  }

  const bLabels = new Int32Array(w * h);
  const bSizes = [0];
  let nb = 1;
  for (let s = 0; s < w * h; s++) {
    if (bLabels[s] !== 0 || !rawBoundary[s]) continue;
    const label = nb++;
    let size = 0;
    const st = [s];
    while (st.length) {
      const idx = st.pop();
      if (bLabels[idx] !== 0 || !rawBoundary[idx]) continue;
      bLabels[idx] = label;
      size++;
      const x = idx % w, y = (idx / w) | 0;
      if (x > 0)   st.push(idx - 1);
      if (x < w-1) st.push(idx + 1);
      if (y > 0)   st.push(idx - w);
      if (y < h-1) st.push(idx + w);
    }
    bSizes[label] = size;
  }

  const bbox = {};
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const l = bLabels[row + x];
      if (!l) continue;
      const b = bbox[l];
      if (!b) bbox[l] = { x1: x, y1: y, x2: x, y2: y };
      else {
        if (x < b.x1) b.x1 = x; else if (x > b.x2) b.x2 = x;
        if (y < b.y1) b.y1 = y; else if (y > b.y2) b.y2 = y;
      }
    }
  }
  // A component must span at least 30% of the LONGER canvas axis in at least
  // ONE axis — AND have its longest dimension >= 25% of the longer axis.
  // Dimension-label text (e.g. "87x240 cm") spans only a small area and
  // fails this test even when both the red line AND its text are connected.
  const longAxis = Math.max(w, h);
  const minSpan  = longAxis * 0.25;   // at least 25% of the longer axis
  const MIN_BOUNDARY_SIZE = 1500;
  const cleanBoundary = new Uint8Array(w * h);
  const keepLabel = new Uint8Array(bSizes.length);
  for (let l = 1; l < bSizes.length; l++) {
    if (bSizes[l] < MIN_BOUNDARY_SIZE) continue;
    const b = bbox[l];
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    // keep only if the longest dimension reaches minSpan
    if (Math.max(dx, dy) < minSpan) continue;
    keepLabel[l] = 1;
  }
  for (let i = 0; i < w * h; i++) {
    if (bLabels[i] !== 0 && keepLabel[bLabels[i]]) cleanBoundary[i] = 1;
  }

  const dilatedBoundary = cleanBoundary.slice();
  const dilateRadius = 4;
  dilateMask(dilatedBoundary, w, h, dilateRadius);

  const outside = new Uint8Array(w * h);
  const stack = [];
  const pushIfFree = (idx) => {
    if (!dilatedBoundary[idx] && !outside[idx]) { outside[idx] = 1; stack.push(idx); }
  };
  for (let x = 0; x < w; x++) { pushIfFree(x); pushIfFree((h-1)*w + x); }
  for (let y = 0; y < h; y++) { pushIfFree(y*w); pushIfFree(y*w + w - 1); }
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w, y = (idx / w) | 0;
    if (x > 0)   pushIfFree(idx - 1);
    if (x < w-1) pushIfFree(idx + 1);
    if (y > 0)   pushIfFree(idx - w);
    if (y < h-1) pushIfFree(idx + w);
  }

  const labels = new Int32Array(w * h);
  const sizes = [0];
  let nl = 1;
  for (let s = 0; s < w * h; s++) {
    if (labels[s] !== 0 || outside[s]) continue;
    const label = nl++;
    let size = 0;
    const st = [s];
    while (st.length) {
      const idx = st.pop();
      if (labels[idx] !== 0 || outside[idx]) continue;
      labels[idx] = label;
      size++;
      const x = idx % w, y = (idx / w) | 0;
      if (x > 0)   st.push(idx - 1);
      if (x < w-1) st.push(idx + 1);
      if (y > 0)   st.push(idx - w);
      if (y < h-1) st.push(idx + w);
    }
    sizes[label] = size;
  }
  let flagLabel = 0, flagSize = 0;
  for (let l = 1; l < sizes.length; l++) {
    if (sizes[l] > flagSize) { flagSize = sizes[l]; flagLabel = l; }
  }

  const flagArea = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (labels[i] === flagLabel) flagArea[i] = 1;
  }
  const notFlag = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) notFlag[i] = flagArea[i] ? 0 : 1;
  dilateMask(notFlag, w, h, dilateRadius - 1);
  const flagTight = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) flagTight[i] = notFlag[i] ? 0 : 1;

  const rawContour = traceContour(flagTight, w, h);
  const flagPolygon = rdp(rawContour, 1.2);

  const linesCanvas = document.createElement('canvas');
  linesCanvas.width = w; linesCanvas.height = h;
  const lctx = linesCanvas.getContext('2d');
  const lImg = lctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    if (!cleanBoundary[i] || !flagArea[i]) continue;
    const r = src[i*4], g = src[i*4+1], b = src[i*4+2];
    if (Math.max(r,g,b) - Math.min(r,g,b) < 40) continue;
    lImg.data[i*4] = r;
    lImg.data[i*4+1] = g;
    lImg.data[i*4+2] = b;
    lImg.data[i*4+3] = src[i*4+3];
  }
  lctx.putImageData(lImg, 0, 0);

  // cleanedTemplate: show flag area as pure white (no lines, no text, no guides).
  // Only the structural black outline on the flag border and white background remain.
  const cleanedTemplate = document.createElement('canvas');
  cleanedTemplate.width = w; cleanedTemplate.height = h;
  const cctx = cleanedTemplate.getContext('2d');
  cctx.fillStyle = '#ffffff';
  cctx.fillRect(0, 0, w, h);
  const cImg = cctx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) {
    // Everything inside the flag area → pure white (no guides, text, etc.)
    if (flagArea[i]) {
      cImg.data[i*4] = 255; cImg.data[i*4+1] = 255; cImg.data[i*4+2] = 255;
      cImg.data[i*4+3] = 255;
      continue;
    }
    // Outside flag: keep original (white bg, black pole, dimension numbers)
    cImg.data[i*4]   = src[i*4];
    cImg.data[i*4+1] = src[i*4+1];
    cImg.data[i*4+2] = src[i*4+2];
    cImg.data[i*4+3] = src[i*4+3];
  }
  cctx.putImageData(cImg, 0, 0);

  // ----- Color-zone templates (e.g. nová grafická šablona) -----
  // Detect saturated color area inside the flag; if present, build two overlay
  // canvases: the colored zones (inside flag) shown semi-transparently as a
  // print guide, and the legend/marks OUTSIDE the flag kept as-is.
  let zonesColored = 0, flagPixels = 0;
  for (let i = 0; i < w * h; i++) {
    if (!flagArea[i]) continue;
    flagPixels++;
    const r = src[i*4], g = src[i*4+1], b = src[i*4+2];
    if (Math.max(r,g,b) - Math.min(r,g,b) > 40) zonesColored++;
  }
  const hasZones = flagPixels > 0 && (zonesColored / flagPixels) > 0.25;

  let zonesCanvas = null, legendCanvas = null;
  if (hasZones) {
    // zones = original colors inside flag, transparent elsewhere
    const zc = document.createElement('canvas'); zc.width = w; zc.height = h;
    const zctx = zc.getContext('2d');
    const zImg = zctx.createImageData(w, h);
    // legend = non-white marks OUTSIDE flag, transparent elsewhere
    const lc = document.createElement('canvas'); lc.width = w; lc.height = h;
    const lc2 = lc.getContext('2d');
    const legImg = lc2.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const r = src[i*4], g = src[i*4+1], b = src[i*4+2], a = src[i*4+3];
      if (flagArea[i]) {
        zImg.data[i*4]=r; zImg.data[i*4+1]=g; zImg.data[i*4+2]=b; zImg.data[i*4+3]=a;
      } else if (Math.min(r,g,b) < 235) {  // keep legend text/swatches
        legImg.data[i*4]=r; legImg.data[i*4+1]=g; legImg.data[i*4+2]=b; legImg.data[i*4+3]=a;
      }
    }
    zctx.putImageData(zImg, 0, 0);
    lc2.putImageData(legImg, 0, 0);
    zonesCanvas = zc; legendCanvas = lc;
  }

  return { cleanedTemplate, flagPolygon, linesCanvas, hasZones, zonesCanvas, legendCanvas };
}

function dilateMask(mask, w, h, passes) {
  for (let p = 0; p < passes; p++) {
    const next = mask.slice();
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        if (mask[i]) continue;
        if (mask[i-1] || mask[i+1] || mask[i-w] || mask[i+w]) next[i] = 1;
      }
    }
    mask.set(next);
  }
}

function polygonToStagePoints(poly) {
  const sx = state.stage.width() / state.sourceW;
  const sy = state.stage.height() / state.sourceH;
  const out = new Array(poly.length * 2);
  for (let i = 0; i < poly.length; i++) {
    out[i*2]   = poly[i][0] * sx;
    out[i*2+1] = poly[i][1] * sy;
  }
  return out;
}

function initStage(containerId = 'stage-container') {
  document.getElementById('loading').classList.remove('show');

  const w = state.pdfPageSize.width * state.scale;
  const h = state.pdfPageSize.height * state.scale;

  state.stage = new Konva.Stage({
    container: containerId,
    width: w,
    height: h,
  });
  state.bgLayer = new Konva.Layer();
  state.logoLayer = new Konva.Layer();
  state.stage.add(state.bgLayer);
  state.stage.add(state.logoLayer);

  state.templateNode = new Konva.Image({
    image: state.templateCanvas,
    width: w, height: h, listening: false,
  });
  // fillNode: smooth vector fill. Stroke same color as fill + 2px overlap
  // creates a natural anti-aliased edge without any hard pixel boundary.
  state.fillNode = new Konva.Line({
    points: polygonToStagePoints(state.flagPolygon),
    closed: true,
    fill: '#ffffff',
    stroke: '#ffffff',
    strokeWidth: 3,
    tension: 0.35,
    listening: false,
    visible: false,
    perfectDrawEnabled: false,
  });
  // linesNode kept in state for PDF export but never shown in editor UI.
  state.linesNode = new Konva.Image({
    image: state.linesCanvas,
    width: w, height: h, listening: false, visible: false,
  });

  state.bgLayer.add(state.templateNode);
  state.bgLayer.add(state.fillNode);
  // linesNode NOT added to stage — kept only for PDF export reference
  state.bgLayer.draw();

  state.logoNode = null;
  state.artworkNode = null;
  state.bgColor = null;
  document.getElementById('bg-color').value = '#ffffff';
  document.getElementById('bg-hex').value = '#ffffff';
  const dab = document.getElementById('delete-artwork');
  if (dab) dab.disabled = true;

  state.transformer = new Konva.Transformer({
    rotateEnabled: true,
    enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    keepRatio: true,
    anchorSize: 14,
    anchorStroke: '#2563eb',
    anchorFill: '#ffffff',
    borderStroke: '#2563eb',
    rotateAnchorOffset: 30,
    ignoreStroke: true,
  });
  state.logoLayer.add(state.transformer);
  state.artworkGroup = null;

  // Overlay vodítek (jen u nové grafické šablony): barevné zóny průhledně +
  // legenda mimo vlajku. Slouží jen pro editaci, do exportu se skryje.
  state.zonesNode = null;
  state.legendNode = null;
  if (state.hasZones && state.zonesCanvas) {
    state.zonesNode = new Konva.Image({
      image: state.zonesCanvas, width: w, height: h,
      opacity: 0.45, listening: false,
    });
    state.logoLayer.add(state.zonesNode);
    if (state.legendCanvas) {
      state.legendNode = new Konva.Image({
        image: state.legendCanvas, width: w, height: h, listening: false,
      });
      state.logoLayer.add(state.legendNode);
    }
    state.transformer.moveToTop();   // úchyty nad vším
  }

  // Výběr klikem: logo / hotová grafika se vybere do transformeru, klik mimo zruší.
  state.stage.on('click tap', (e) => {
    if (e.target === state.stage) {
      state.transformer.nodes([]); state.logoLayer.draw(); return;
    }
    if (e.target === state.logoNode || e.target === state.artworkNode) {
      state.transformer.nodes([e.target]);
      state.transformer.moveToTop();
      state.logoLayer.draw();
    }
  });

  ['rotate-left', 'rotate-right', 'delete-logo'].forEach(id => {
    document.getElementById(id).disabled = true;
  });
}

// =====================================================================
// EDITOR — multi-piece PVC banner (různé grafiky pro jednotlivé kusy)
// =====================================================================

// Fields that belong to a single piece: initStage()/loadBannerTemplate()
// and the editing helpers (placeFullArtwork, placeLogo, applyBgColor, ...)
// read/write these directly on the global `state` while that piece is active.
const PIECE_STATE_FIELDS = [
  'stage', 'bgLayer', 'logoLayer', 'templateNode', 'fillNode', 'linesNode',
  'logoNode', 'artworkNode', 'artworkGroup', 'transformer',
  'flagPolygon', 'sourceW', 'sourceH', 'scale', 'pdfPageSize',
  'templateCanvas', 'linesCanvas', 'bgColor',
];

function snapshotPieceState() {
  const snap = {};
  for (const k of PIECE_STATE_FIELDS) snap[k] = state[k];
  return snap;
}

// Zaměří kus `i`: nejdřív uloží živé změny právě editovaného kusu zpět do
// state.pieces[activePieceIndex], pak do `state` nakopíruje kus `i` — díky
// tomu nad ním beze změny fungují všechny stávající editační funkce.
function focusPiece(i) {
  if (state.pieces[state.activePieceIndex]) {
    Object.assign(state.pieces[state.activePieceIndex], snapshotPieceState());
  }
  state.activePieceIndex = i;
  Object.assign(state, state.pieces[i]);

  document.getElementById('bg-color').value = state.bgColor || '#ffffff';
  document.getElementById('bg-hex').value = state.bgColor || '#ffffff';
  const dab = document.getElementById('delete-artwork');
  if (dab) dab.disabled = !state.artworkNode;
  ['rotate-left', 'rotate-right', 'delete-logo'].forEach(id => {
    document.getElementById(id).disabled = !state.logoNode;
  });

  document.querySelectorAll('#stage-container .piece-wrapper').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.idx) === i);
  });
}

// Vyrenderuje N samostatných banner-stagí pod sebou (jeden na kus podle
// item.qty), obnoví uložené návrhy z item.designs[i] a zaměří první kus.
async function renderBannerPieces(item) {
  ensureDesignsLength(item);
  const n = item.qty || 1;
  const wrap = document.getElementById('stage-container');
  wrap.innerHTML = '';
  wrap.classList.add('multi-stage');
  state.pieces = [];

  const perTarget = Math.max(260, Math.min(820, Math.round(2400 / n)));
  const maxW = Math.min(820, window.innerWidth - 120);
  const maxH = perTarget + 100;

  for (let i = 0; i < n; i++) {
    const pieceWrap = document.createElement('div');
    pieceWrap.className = 'piece-wrapper';
    pieceWrap.dataset.idx = String(i);

    const header = document.createElement('div');
    header.className = 'piece-header';
    header.textContent = `Kus ${i + 1}/${n}`;

    const host = document.createElement('div');
    host.id = `piece-stage-${i}`;

    pieceWrap.appendChild(header);
    pieceWrap.appendChild(host);
    wrap.appendChild(pieceWrap);

    // Capture-phase: switch the active piece *before* Konva's own (bubble
    // phase) click handler on the stage evaluates e.target === state.stage.
    pieceWrap.addEventListener('click', () => {
      if (state.activePieceIndex !== i) focusPiece(i);
    }, true);

    loadBannerTemplate(item, { containerId: host.id, targetSize: perTarget, maxW, maxH });
    await restoreDesign(item.designs[i]);
    state.pieces[i] = snapshotPieceState();
  }

  // `state` currently holds the last built piece — tell focusPiece() that,
  // so it writes back into the right slot before switching to piece 0.
  state.activePieceIndex = n - 1;
  focusPiece(0);
}

// ---------- Background color ----------
function applyBgColor(color) {
  if (!state.fillNode) return;
  // A solid colour and a full artwork are mutually exclusive.
  if (state.artworkNode) { state.artworkNode.destroy(); state.artworkNode = null;
    const d = document.getElementById('delete-artwork'); if (d) d.disabled = true; }
  state.bgColor = color;
  state.fillNode.fill(color);
  state.fillNode.stroke(color); // stroke matches fill → hladký okraj bez artefaktů
  state.fillNode.visible(true);
  state.templateNode.visible(false);
  state.bgLayer.draw();
}
function clearBgColor() {
  state.bgColor = null;
  state.fillNode.visible(false);
  state.templateNode.visible(true);
  state.bgLayer.draw();
}

document.getElementById('bg-color').addEventListener('input', (e) => {
  document.getElementById('bg-hex').value = e.target.value;
  applyBgColor(e.target.value);
});
document.getElementById('bg-hex').addEventListener('change', (e) => {
  let v = e.target.value.trim();
  if (!v.startsWith('#')) v = '#' + v;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    document.getElementById('bg-color').value = v;
    applyBgColor(v);
  } else { alert('Neplatný hex kód (#RRGGBB).'); }
});
document.querySelectorAll('.swatch[data-color]').forEach(s => {
  s.addEventListener('click', () => {
    const c = s.dataset.color;
    document.getElementById('bg-color').value = c;
    document.getElementById('bg-hex').value = c;
    applyBgColor(c);
  });
});
document.getElementById('bg-reset').addEventListener('click', clearBgColor);

// ---------- Sleeve colour (rukáv na podpůrnou tyč) — HS flags only, white or black ----------
function setSleeveColor(color) {
  state.sleeveColor = color;
  document.querySelectorAll('[data-sleeve-color]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sleeveColor === color);
  });
  const label = document.getElementById('sleeve-color-label');
  if (label) label.textContent = color === 'black' ? 'černá' : 'bílá';
}
document.querySelectorAll('[data-sleeve-color]').forEach(btn => {
  btn.addEventListener('click', () => setSleeveColor(btn.dataset.sleeveColor));
});

// ---------- Full artwork (hotová grafika) ----------
// Movable/scalable artwork clipped to the flag shape. opts = saved transform.
function placeFullArtwork(img, dataUrl, opts, orig) {
  if (!state.stage) return;
  if (state.artworkGroup) { state.artworkGroup.destroy(); state.artworkGroup = null; state.artworkNode = null; }

  const W = state.stage.width(), H = state.stage.height();
  const pts = polygonToStagePoints(state.flagPolygon); // flat [x,y,...]
  let x0=W, x1=0, y0=H, y1=0;
  for (let i=0;i<pts.length;i+=2){
    const x=pts[i], y=pts[i+1];
    if (x<x0)x0=x; if (x>x1)x1=x; if (y<y0)y0=y; if (y>y1)y1=y;
  }
  const fw=x1-x0, fh=y1-y0;

  // Clip group = flag silhouette; the artwork inside can be dragged/scaled freely.
  const group = new Konva.Group({
    clipFunc(ctx) {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i=2;i<pts.length;i+=2) ctx.lineTo(pts[i], pts[i+1]);
      ctx.closePath();
    },
  });

  const scale = Math.max(fw/img.width, fh/img.height); // cover-fit default
  const dw = img.width*scale, dh = img.height*scale;
  const node = new Konva.Image({
    image: img,
    x: (opts?.x) ?? (x0 + (fw - dw)/2),
    y: (opts?.y) ?? (y0 + (fh - dh)/2),
    width: (opts?.w) ?? dw,
    height: (opts?.h) ?? dh,
    rotation: (opts?.rotation) ?? 0,
    draggable: true,
  });
  node._sourceDataUrl = dataUrl;
  // Keep the ORIGINAL uploaded file (e.g. PDF) so we can attach it as-is later.
  node._origDataUrl = (orig && orig.src) || dataUrl;
  node._origType = (orig && orig.type) || 'image/png';
  group.add(node);
  state.logoLayer.add(group);
  group.moveToBottom();              // pod logem
  state.artworkGroup = group;
  state.artworkNode = node;

  state.transformer.nodes([node]);   // rovnou vybrané, aby šlo hned hýbat
  raiseGuides();
  state.templateNode.visible(false);
  state.fillNode.visible(false);
  state.bgColor = null;
  state.bgLayer.draw();
  state.logoLayer.draw();

  document.getElementById('delete-artwork').disabled = false;
}

function clearArtwork() {
  if (state.transformer && state.artworkNode &&
      state.transformer.nodes().includes(state.artworkNode)) {
    state.transformer.nodes([]);
  }
  if (state.artworkGroup) { state.artworkGroup.destroy(); state.artworkGroup = null; }
  state.artworkNode = null;
  state.templateNode.visible(true);
  state.bgLayer.draw();
  state.logoLayer.draw();
  document.getElementById('delete-artwork').disabled = true;
}

// Vyrenderuje 1. stránku PDF na PNG dataURL (přes pdf.js).
async function pdfFileToImageDataUrl(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(2000 / vp1.width, 2000 / vp1.height, 4); // ~2000px delší strana
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas.toDataURL('image/png');
}

document.getElementById('artwork-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  try {
    // Always keep the original file as a data URL (so a PDF stays a PDF).
    const origDataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = ev => res(ev.target.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    let dataUrl;
    if (isPdf) {
      showLoading('Načítám PDF grafiku…');
      dataUrl = await pdfFileToImageDataUrl(file);
      hideLoading();
    } else {
      dataUrl = origDataUrl;
    }
    const orig = { src: origDataUrl, type: file.type || (isPdf ? 'application/pdf' : 'image/png') };
    const img = new Image();
    img.onload = () => placeFullArtwork(img, dataUrl, undefined, orig);
    img.src = dataUrl;
  } catch (err) {
    hideLoading();
    alert('Grafiku se nepodařilo načíst: ' + err.message);
  }
  e.target.value = '';
});
document.getElementById('delete-artwork').addEventListener('click', clearArtwork);

document.getElementById('multi-artwork-toggle').addEventListener('change', async (e) => {
  const item = getItem(state.currentOrderId, state.currentItemId);
  if (!item || !isBanner(item)) return;
  item.multiArtwork = e.target.checked;
  ensureDesignsLength(item);
  if (item.multiArtwork && !item.designs.some(Boolean) && item.design) {
    // Carry over the existing single design so it isn't lost on toggle.
    item.designs[0] = item.design;
  }
  saveOrders();

  state.multiMode = item.multiArtwork;
  const stageContainer = document.getElementById('stage-container');
  stageContainer.classList.toggle('multi-stage', state.multiMode);
  if (state.multiMode) {
    await renderBannerPieces(item);
  } else {
    loadBannerTemplate(item);
    await restoreDesign(item.design);
  }
});

// ---------- Logo ----------
document.getElementById('logo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => placeLogo(img, ev.target.result);
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

function placeLogo(img, dataUrl, opts) {
  if (state.logoNode) state.logoNode.destroy();
  const stageW = state.stage.width();
  const stageH = state.stage.height();
  const targetW = (opts?.w) ?? stageW * 0.3;
  const ratio = img.height / img.width;
  const targetH = (opts?.h) ?? targetW * ratio;

  state.logoNode = new Konva.Image({
    image: img,
    x: (opts?.x) ?? (stageW - targetW) / 2,
    y: (opts?.y) ?? (stageH - targetH) / 2,
    width: targetW,
    height: targetH,
    rotation: (opts?.rotation) ?? 0,
    draggable: true,
  });
  state.logoNode._sourceDataUrl = dataUrl;
  state.logoLayer.add(state.logoNode);
  state.transformer.nodes([state.logoNode]);
  raiseGuides();
  state.logoLayer.draw();

  ['rotate-left', 'rotate-right', 'delete-logo'].forEach(id => {
    document.getElementById(id).disabled = false;
  });
}

document.getElementById('rotate-left').addEventListener('click', () => {
  if (state.logoNode) { state.logoNode.rotation(state.logoNode.rotation() - 15); state.logoLayer.draw(); }
});
document.getElementById('rotate-right').addEventListener('click', () => {
  if (state.logoNode) { state.logoNode.rotation(state.logoNode.rotation() + 15); state.logoLayer.draw(); }
});
document.getElementById('delete-logo').addEventListener('click', () => {
  if (state.logoNode) {
    state.transformer.nodes([]);
    state.logoNode.destroy();
    state.logoNode = null;
    state.logoLayer.draw();
    ['rotate-left', 'rotate-right', 'delete-logo'].forEach(id => {
      document.getElementById(id).disabled = true;
    });
  }
});

// ---------- Save / restore design ----------
function hideTransformerForExport() {
  if (state.transformer) state.transformer.nodes([]);
  // Skryj vodítka (barevné zóny + legendu) – nepatří do výsledného návrhu.
  if (state.zonesNode) state.zonesNode.visible(false);
  if (state.legendNode) state.legendNode.visible(false);
  state.logoLayer && state.logoLayer.draw();
}
function restoreTransformerAfterExport() {
  if (state.zonesNode) state.zonesNode.visible(true);
  if (state.legendNode) state.legendNode.visible(true);
  if (state.logoNode && state.transformer) {
    state.transformer.nodes([state.logoNode]);
  }
  state.logoLayer && state.logoLayer.draw();
}

function makeThumbnail() {
  hideTransformerForExport();
  const url = state.stage.toDataURL({ pixelRatio: 2 }); // 2× for quality in client PDF
  restoreTransformerAfterExport();
  return url;
}

function captureDesign() {
  const PR = 2; // must match makeThumbnail pixelRatio
  const stageW = state.stage.width(), stageH = state.stage.height();

  // Record exact flag bounding box in STAGE pixels so the compositor can crop
  // the thumbnail to only the flag area (no surrounding white space).
  let flagBounds = null;
  if (state.flagPolygon && state.sourceW > 0) {
    const sx = stageW / state.sourceW, sy = stageH / state.sourceH;
    const xs = state.flagPolygon.map(p => p[0] * sx);
    const ys = state.flagPolygon.map(p => p[1] * sy);
    const bx = Math.floor(Math.min(...xs)), by = Math.floor(Math.min(...ys));
    const bw = Math.ceil(Math.max(...xs)) - bx;
    const bh = Math.ceil(Math.max(...ys)) - by;
    flagBounds = { x: bx, y: by, w: bw, h: bh, pr: PR };
  }

  let fullArtwork = null;
  if (state.artworkNode) {
    const a = state.artworkNode;
    fullArtwork = {
      src: a._sourceDataUrl,
      origSrc: a._origDataUrl || a._sourceDataUrl,
      origType: a._origType || 'image/png',
      x: a.x() / stageW, y: a.y() / stageH,
      w: (a.width() * a.scaleX()) / stageW,
      h: (a.height() * a.scaleY()) / stageH,
      rotation: a.rotation(),
    };
  }
  const d = {
    bgColor: state.bgColor,
    sleeveColor: state.sleeveColor,
    logo: null,
    fullArtwork,
    thumb: makeThumbnail(),
    flagBounds,
  };
  if (state.logoNode) {
    d.logo = {
      src: state.logoNode._sourceDataUrl,
      x: state.logoNode.x() / stageW,
      y: state.logoNode.y() / stageH,
      w: (state.logoNode.width() * state.logoNode.scaleX()) / stageW,
      h: (state.logoNode.height() * state.logoNode.scaleY()) / stageH,
      rotation: state.logoNode.rotation(),
    };
  }
  return d;
}

function loadImageAsync(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Async: callers that build several stages in sequence (renderBannerPieces)
// must await this so placeFullArtwork/placeLogo land on the right stage
// before state moves on to the next piece.
async function restoreDesign(design) {
  if (!design) return;
  if (design.fullArtwork && design.fullArtwork.src) {
    const fa = design.fullArtwork;
    const aimg = await loadImageAsync(fa.src);
    const W = state.stage.width(), H = state.stage.height();
    const opts = (fa.x != null) ? { x: fa.x*W, y: fa.y*H, w: fa.w*W, h: fa.h*H, rotation: fa.rotation } : undefined;
    placeFullArtwork(aimg, fa.src, opts, fa.origSrc ? { src: fa.origSrc, type: fa.origType } : undefined);
  } else if (design.bgColor) {
    document.getElementById('bg-color').value = design.bgColor;
    document.getElementById('bg-hex').value = design.bgColor;
    applyBgColor(design.bgColor);
  }
  if (design.logo) {
    const img = await loadImageAsync(design.logo.src);
    const stageW = state.stage.width();
    const stageH = state.stage.height();
    placeLogo(img, design.logo.src, {
      x: design.logo.x * stageW,
      y: design.logo.y * stageH,
      w: design.logo.w * stageW,
      h: design.logo.h * stageH,
      rotation: design.logo.rotation,
    });
    // reset scale (we already baked in the target width)
    state.logoNode.scaleX(1); state.logoNode.scaleY(1);
    state.logoLayer.draw();
  }
}

document.getElementById('save-design').addEventListener('click', () => {
  const item = getItem(state.currentOrderId, state.currentItemId);
  if (!item) { alert('Položka nenalezena.'); return; }
  if (state.multiMode) {
    const activeIdx = state.activePieceIndex;
    focusPiece(activeIdx); // sync any live edits on the active piece into state.pieces[]
    ensureDesignsLength(item);
    item.designs = state.pieces.map((p) => {
      Object.assign(state, p);
      return captureDesign();
    });
    item.design = item.designs.find(Boolean) || null;
    state.activePieceIndex = state.pieces.length - 1; // `state` now reflects the last piece
    focusPiece(activeIdx);
  } else {
    item.design = captureDesign();
  }
  saveOrders();
  alert('Návrh uložen.');
});

document.getElementById('clear-design').addEventListener('click', () => {
  const msg = state.multiMode
    ? `Opravdu smazat návrh kusu ${state.activePieceIndex + 1}? Vyresetuje se jen tento kus.`
    : 'Opravdu smazat tento návrh? Vyresetuje se editor a u položky se návrh odstraní.';
  if (!confirm(msg)) return;
  // Reset editor: remove logo, artwork, background fill (jen aktivní kus v multi režimu).
  if (state.logoNode) { state.transformer.nodes([]); state.logoNode.destroy(); state.logoNode = null; }
  clearArtwork();
  clearBgColor();
  document.getElementById('bg-color').value = '#ffffff';
  document.getElementById('bg-hex').value = '#ffffff';
  if (!state.multiMode) setSleeveColor('white');
  ['rotate-left', 'rotate-right', 'delete-logo'].forEach(id => {
    document.getElementById(id).disabled = true;
  });
  state.logoLayer.draw();
  const item = getItem(state.currentOrderId, state.currentItemId);
  if (!item) return;
  if (state.multiMode) {
    ensureDesignsLength(item);
    item.designs[state.activePieceIndex] = null;
  } else {
    item.design = null;
  }
  saveOrders();
});

// =====================================================================
// EXPORT — single design (PDF / SVG, original PDF size)
// =====================================================================

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getLogoExportData() {
  if (!state.logoNode) return null;
  const node = state.logoNode;
  const rotation = node.rotation();
  const x = node.x();
  const y = node.y();
  const w = node.width() * node.scaleX();
  const h = node.height() * node.scaleY();
  const img = node.image();
  const off = document.createElement('canvas');
  off.width = img.naturalWidth || img.width;
  off.height = img.naturalHeight || img.height;
  off.getContext('2d').drawImage(img, 0, 0);
  return { dataUrl: off.toDataURL('image/png'), x, y, w, h, rotation };
}

// Export the current stage (banner) as a flat one-page PDF in its aspect ratio.
async function exportStageAsPdf() {
  const { PDFDocument } = PDFLib;
  hideTransformerForExport();
  const dataUrl = state.stage.toDataURL({ pixelRatio: 3 });
  restoreTransformerAfterExport();
  const pngBytes = await fetch(dataUrl).then(r => r.arrayBuffer());
  const pdfDoc = await PDFDocument.create();
  const png = await pdfDoc.embedPng(pngBytes);
  const page = pdfDoc.addPage([png.width, png.height]);
  page.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
  const bytes = await pdfDoc.save();
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `banner_${state.size}.pdf`);
}

document.getElementById('export-pdf').addEventListener('click', async () => {
  try {
    const { PDFDocument, degrees, rgb } = PDFLib;
    // Banner nemá zdrojové PDF – exportuj rovnou snímek plátna jako PDF stránku.
    if (!state.templateBytes) { await exportStageAsPdf(); return; }
    const pdfDoc = await PDFDocument.load(state.templateBytes.slice(0));
    const page = pdfDoc.getPages()[0];
    const pageW = page.getWidth();
    const pageH = page.getHeight();

    if (state.bgColor) {
      const hex = state.bgColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const ptScale = pageW / state.sourceW;
      const poly = state.flagPolygon;
      const sp = poly.map(p => [p[0] * ptScale, pageH - p[1] * ptScale]);
      let d = `M ${sp[0][0]} ${sp[0][1]}`;
      for (let i = 0; i < sp.length; i++) {
        const cur = sp[i];
        const next = sp[(i + 1) % sp.length];
        const mx = (cur[0] + next[0]) / 2;
        const my = (cur[1] + next[1]) / 2;
        d += ` Q ${cur[0]} ${cur[1]} ${mx} ${my}`;
      }
      d += ' Z';
      page.drawSvgPath(d, { color: rgb(r, g, b), borderWidth: 0 });

      const linesBytes = await fetch(state.linesCanvas.toDataURL('image/png')).then(r => r.arrayBuffer());
      const linesImg = await pdfDoc.embedPng(linesBytes);
      page.drawImage(linesImg, { x: 0, y: 0, width: pageW, height: pageH });
    }

    hideTransformerForExport();
    const logo = getLogoExportData();
    restoreTransformerAfterExport();
    if (logo) {
      const pngBytes = await fetch(logo.dataUrl).then(r => r.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const s = 1 / state.scale;
      const wPt = logo.w * s;
      const hPt = logo.h * s;
      const rad = (logo.rotation * Math.PI) / 180;
      const blStageX = logo.x - logo.h * Math.sin(rad);
      const blStageY = logo.y + logo.h * Math.cos(rad);
      const drawX = blStageX * s;
      const drawY = pageH - blStageY * s;
      page.drawImage(pngImage, {
        x: drawX, y: drawY,
        width: wPt, height: hPt,
        rotate: degrees(-logo.rotation),
      });
    }

    const bytes = await pdfDoc.save();
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }),
      `vlajka_${state.shape}_${state.size}.pdf`);
  } catch (e) { alert('Export PDF selhal: ' + e.message); }
});

document.getElementById('export-svg').addEventListener('click', () => {
  try {
    hideTransformerForExport();
    const w = state.stage.width();
    const h = state.stage.height();
    const stageDataUrl = state.stage.toDataURL({ pixelRatio: 2 });
    restoreTransformerAfterExport();
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image x="0" y="0" width="${w}" height="${h}" xlink:href="${stageDataUrl}"/>
</svg>`;
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }),
      `vlajka_${state.shape}_${state.size}.svg`);
  } catch (e) { alert('Export SVG selhal: ' + e.message); }
});

// =====================================================================
// EXPORT — A4 client PDF: all designs in current order, one per page
// =====================================================================

// Try to load a Unicode TTF so we can render Czech diacritics in PDFs.
// If the network fetch fails, we fall back to Helvetica + diacritic stripping.
const FONT_URLS = {
  reg:  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
  bold: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
};
let _fontBytesCache = null;
async function loadCzechFontBytes() {
  if (_fontBytesCache) return _fontBytesCache;
  const [reg, bold] = await Promise.all([
    fetch(FONT_URLS.reg).then(r => { if (!r.ok) throw new Error('reg'); return r.arrayBuffer(); }),
    fetch(FONT_URLS.bold).then(r => { if (!r.ok) throw new Error('bold'); return r.arrayBuffer(); }),
  ]);
  _fontBytesCache = { reg, bold };
  return _fontBytesCache;
}
function stripDiacritics(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// =====================================================================
// CLIENT PDF — mockup compositor + new layout
// =====================================================================

function getMockupPath(shape, size) {
  if (!shape || !size) return null;            // banner / neznámý typ → bez mockupu
  const s = shape.toUpperCase(), sz = size.toUpperCase();
  // New green HS visualization mockups (shapes A–F, sizes S/M/L/XL).
  if ('ABCDEF'.includes(s) && ['S','M','L','XL'].includes(sz)) {
    return `assets/mockups_hs/${sz}${s}.png`;
  }
  return null;
}

function loadImageFromUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Cannot load: ' + src));
    img.src = src;
  });
}

// Turn white-on-transparent logo into dark-on-transparent for use on white PDFs.
async function makeDarkLogoDataUrl() {
  try {
    const img = await loadImageFromUrl('assets/Provlajky-logo-bile.png');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      if (d.data[i+3] < 10) continue;         // transparent → skip
      const r=d.data[i], g=d.data[i+1], b=d.data[i+2];
      if (r > 210 && g > 210 && b > 210) {    // white → near-black
        d.data[i]=22; d.data[i+1]=22; d.data[i+2]=22;
      }
      // yellow & grey parts of the icon stay as-is
    }
    ctx.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
  } catch(e) {
    console.warn('Dark logo failed:', e);
    return null;
  }
}

// Composite design onto the mockup template image.
// design = full design object {thumb, flagBounds, ...}
// flagBounds records the exact flag area in the stage so we crop precisely.
async function compositeDesignOnMockup(design, shape, size) {
  const designDataUrl = design.thumb;
  const path = getMockupPath(shape, size);
  if (!path) return designDataUrl;

  let mockupImg;
  try { mockupImg = await loadImageFromUrl(path); }
  catch(e) { console.warn('Mockup not found:', path); return designDataUrl; }

  const W = mockupImg.naturalWidth, H = mockupImg.naturalHeight;

  // Analyse mockup: find the GREEN flag pixels (HS visualization templates use
  // a solid green fill for the printable flag area).
  const ac = document.createElement('canvas');
  ac.width = W; ac.height = H;
  const actx = ac.getContext('2d');
  actx.drawImage(mockupImg, 0, 0);
  const src = actx.getImageData(0, 0, W, H).data;

  const greyMask = new Uint8Array(W * H);
  for (let y=0; y<H; y++) {
    for (let x=0; x<W; x++) {
      const i=(y*W+x)*4;
      const r=src[i], g=src[i+1], b=src[i+2];
      // Green: green channel clearly dominant over red & blue.
      if (g > 90 && g > r + 35 && g > b + 35) greyMask[y*W+x] = 1;
    }
  }
  // Keep only the LARGEST connected green blob = the flag itself.
  // (Discards green antialiasing of the title/labels, etc.)
  const lbl = new Int32Array(W * H);
  let best = 0, bestSize = 0;
  let nlab = 0;
  for (let s = 0; s < W*H; s++) {
    if (lbl[s] || !greyMask[s]) continue;
    nlab++;
    let size = 0;
    const st = [s];
    while (st.length) {
      const idx = st.pop();
      if (lbl[idx] || !greyMask[idx]) continue;
      lbl[idx] = nlab; size++;
      const x = idx % W, y = (idx / W) | 0;
      if (x>0) st.push(idx-1);
      if (x<W-1) st.push(idx+1);
      if (y>0) st.push(idx-W);
      if (y<H-1) st.push(idx+W);
    }
    if (size > bestSize) { bestSize = size; best = nlab; }
  }
  if (!best) return designDataUrl;

  const flagMask = new Uint8Array(W * H);
  let x0=W, x1=0, y0=H, y1=0;
  for (let i=0;i<W*H;i++) {
    if (lbl[i] === best) {
      flagMask[i] = 1;
      const x = i % W, y = (i / W) | 0;
      if (x<x0) x0=x; if (x>x1) x1=x;
      if (y<y0) y0=y; if (y>y1) y1=y;
    }
  }
  if (x1<=x0 || y1<=y0) return designDataUrl;
  const fw = x1-x0, fh = y1-y0;

  // Load full thumbnail
  const fullImg = await loadImageFromUrl(designDataUrl);

  // If flagBounds is stored, crop the thumbnail to just the flag area
  // so the compositor maps flag→flag instead of full-stage→flag.
  let designSrc;
  const fb = design.flagBounds;
  if (fb && fb.w > 0 && fb.h > 0) {
    const pr = fb.pr || 2;
    const cc = document.createElement('canvas');
    cc.width = Math.round(fb.w * pr);
    cc.height = Math.round(fb.h * pr);
    cc.getContext('2d').drawImage(
      fullImg,
      Math.round(fb.x * pr), Math.round(fb.y * pr),
      Math.round(fb.w * pr), Math.round(fb.h * pr),
      0, 0, cc.width, cc.height
    );
    designSrc = cc;
  } else {
    // Fallback for designs saved before flagBounds was introduced
    designSrc = fullImg;
  }

  // Build soft edge mask for natural blending at flag border.
  const mc = document.createElement('canvas');
  mc.width=W; mc.height=H;
  const mctx=mc.getContext('2d');
  const md=mctx.createImageData(W,H);
  for (let i=0;i<W*H;i++) {
    if (flagMask[i]) { md.data[i*4]=md.data[i*4+1]=md.data[i*4+2]=md.data[i*4+3]=255; }
  }
  mctx.putImageData(md,0,0);
  const bmc=document.createElement('canvas');
  bmc.width=W; bmc.height=H;
  const bmctx=bmc.getContext('2d');
  bmctx.filter='blur(4px)';
  bmctx.drawImage(mc,0,0);
  bmctx.filter='none';

  // Scale by HEIGHT (uniform → no distortion) so the whole flag is shown top to
  // bottom and nothing is cut off. Horizontally centered; same shape so widths
  // match closely, any tiny gap/overflow is handled by the bg fill + soft mask.
  const dsW = designSrc.width || designSrc.naturalWidth || fw;
  const dsH = designSrc.height || designSrc.naturalHeight || fh;
  const sc = fh / dsH;
  const drawW = dsW * sc, drawH = fh;
  const dx = x0 + (fw - drawW) / 2, dy = y0;

  const dl=document.createElement('canvas');
  dl.width=W; dl.height=H;
  const dlctx=dl.getContext('2d');
  // 1) Optional solid background colour as a base (harmless under the artwork).
  if (design.bgColor) {
    dlctx.fillStyle = design.bgColor;
    const pad = Math.max(fw, fh) * 0.06;
    dlctx.fillRect(x0 - pad, y0 - pad, fw + pad * 2, fh + pad * 2);
  }
  // 2) Draw the sharp design at its true aspect ratio (height-fit, centered).
  //    Logos/texts in the middle stay untouched and undistorted.
  dlctx.drawImage(designSrc, dx, dy, drawW, drawH);
  // 3) Fill any horizontal gap (tištěná šablona je užší než tvar v mockupu) by
  //    SMEARING the design's outermost opaque pixel of each row outward to the
  //    flag edge. Tím gradient/pozadí doteče k okraji přesnou barvou (bez blur,
  //    bez šedé) a loga/texty uprostřed zůstanou beze změny.
  {
    const id = dlctx.getImageData(0, 0, W, H);
    const px = id.data;
    for (let y = y0; y <= y1; y++) {
      // flag horizontal extent for this row
      let fxL = -1, fxR = -1;
      const row = y * W;
      for (let x = x0; x <= x1; x++) {
        if (flagMask[row + x]) { if (fxL < 0) fxL = x; fxR = x; }
      }
      if (fxL < 0) continue;
      // opaque design extent within the flag row
      let dxL = -1, dxR = -1;
      for (let x = fxL; x <= fxR; x++) {
        if (px[(row + x) * 4 + 3] > 25) { if (dxL < 0) dxL = x; dxR = x; }
      }
      if (dxL < 0) continue; // no design here → leave bg fill
      // Sample a CLEAN pixel a few px inside (skip the antialiased semi-transparent
      // edge), and overwrite the edge pixels too — removes the faint outline.
      const inset = 3;
      const sl = Math.min(dxL + inset, dxR);
      const li = (row + sl) * 4;
      for (let x = fxL; x < sl; x++) {
        const o = (row + x) * 4;
        px[o] = px[li]; px[o+1] = px[li+1]; px[o+2] = px[li+2]; px[o+3] = 255;
      }
      const sr = Math.max(dxR - inset, dxL);
      const ri = (row + sr) * 4;
      for (let x = sr + 1; x <= fxR; x++) {
        const o = (row + x) * 4;
        px[o] = px[ri]; px[o+1] = px[ri+1]; px[o+2] = px[ri+2]; px[o+3] = 255;
      }
    }
    // Vertical smear (top/bottom): dolije rohy u žerdi, kde spodní/horní řádky
    // vlajky už nemají žádný pixel návrhu.
    for (let x = x0; x <= x1; x++) {
      let fyT = -1, fyB = -1;
      for (let y = y0; y <= y1; y++) {
        if (flagMask[y * W + x]) { if (fyT < 0) fyT = y; fyB = y; }
      }
      if (fyT < 0) continue;
      let dyT = -1, dyB = -1;
      for (let y = fyT; y <= fyB; y++) {
        if (px[(y * W + x) * 4 + 3] > 25) { if (dyT < 0) dyT = y; dyB = y; }
      }
      if (dyT < 0) continue;
      const inset = 3;
      const st = Math.min(dyT + inset, dyB);
      const ti = (st * W + x) * 4;
      for (let y = fyT; y < st; y++) {
        const o = (y * W + x) * 4;
        px[o] = px[ti]; px[o+1] = px[ti+1]; px[o+2] = px[ti+2]; px[o+3] = 255;
      }
      const sb = Math.max(dyB - inset, dyT);
      const bi = (sb * W + x) * 4;
      for (let y = sb + 1; y <= fyB; y++) {
        const o = (y * W + x) * 4;
        px[o] = px[bi]; px[o+1] = px[bi+1]; px[o+2] = px[bi+2]; px[o+3] = 255;
      }
    }
    dlctx.putImageData(id, 0, 0);
  }
  // 4) Clip everything to the soft flag mask.
  dlctx.globalCompositeOperation='destination-in';
  dlctx.drawImage(bmc,0,0);

  // Compose: mockup → design on top.
  const out=document.createElement('canvas');
  out.width=W; out.height=H;
  const octx=out.getContext('2d');
  octx.drawImage(mockupImg,0,0);
  octx.drawImage(dl,0,0);

  return out.toDataURL('image/png', 1.0);
}

// Build the client visualization PDF and return the bytes (Uint8Array).
async function buildClientPdfBytes(order) {
  const designedItems = order.items.filter(i => i.multiArtwork
    ? (i.designs || []).some(d => d && d.thumb)
    : (i.design && i.design.thumb));
  if (!designedItems.length) throw new Error('Žádné uložené návrhy.');
  {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    let font, fontR, sanitize = s => String(s ?? '');
    try {
      const bytes = await loadCzechFontBytes();
      pdfDoc.registerFontkit(window.fontkit);
      fontR = await pdfDoc.embedFont(bytes.reg,  { subset: true });
      font  = await pdfDoc.embedFont(bytes.bold, { subset: true });
    } catch {
      fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
      font  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      sanitize = stripDiacritics;
    }
    const T = s => sanitize(String(s ?? ''));
    const cur = order.currency || 'CZK';
    const money = n => T(fmtMoney(n, cur));

    // Dark logo PNG
    let logoEmbedded = null;
    const darkLogoUrl = await makeDarkLogoDataUrl();
    if (darkLogoUrl) {
      const lb = await fetch(darkLogoUrl).then(r => r.arrayBuffer());
      logoEmbedded = await pdfDoc.embedPng(lb);
    }

    const A4w = 595.28, A4h = 841.89, M = 45;
    const line = rgb(0.87, 0.88, 0.90);
    const ink  = rgb(0.10, 0.10, 0.10);
    const grey = rgb(0.50, 0.52, 0.55);

    // Composite every designed item's mockup up front.
    const visuals = [];
    for (const item of designedItems) {
      showLoading(`Generuji vizualizaci ${isBanner(item) ? 'PVC banneru' : 'tvar ' + item.shape + ' / ' + item.size}…`);
      if (item.multiArtwork) {
        const list = item.designs || [];
        for (let i = 0; i < list.length; i++) {
          const d = list[i];
          if (!d || !d.thumb) continue;
          const url = await compositeDesignOnMockup(d, item.shape, item.size);
          const bytes = await fetch(url).then(r => r.arrayBuffer());
          const img = url.startsWith('data:image/png')
            ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          visuals.push({ item, img, pieceLabel: `kus ${i + 1}/${list.length}` });
        }
      } else {
        const url = await compositeDesignOnMockup(item.design, item.shape, item.size);
        const bytes = await fetch(url).then(r => r.arrayBuffer());
        const img = url.startsWith('data:image/png')
          ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        visuals.push({ item, img });
      }
    }

    const contentW = A4w - M * 2;
    let page = pdfDoc.addPage([A4w, A4h]);
    let y = A4h - M;
    const newPage = () => { page = pdfDoc.addPage([A4w, A4h]); y = A4h - M; };

    // --- Header: logo left, web right ---
    if (logoEmbedded) {
      const lh = 32, lw = logoEmbedded.width * lh / logoEmbedded.height;
      page.drawImage(logoEmbedded, { x: M, y: y - lh, width: lw, height: lh });
    }
    const web = T('provlajky.cz');
    page.drawText(web, { x: A4w-M-font.widthOfTextAtSize(web,11), y: y-11, size:11, font, color: ink });
    const mail = T('info@provlajky.cz');
    page.drawText(mail, { x: A4w-M-fontR.widthOfTextAtSize(mail,8.5), y: y-24, size:8.5, font:fontR, color: grey });
    y -= 44;
    page.drawLine({ start:{x:M,y}, end:{x:A4w-M,y}, thickness:0.5, color:line });
    y -= 22;

    // --- Title ---
    const onlyBanners = designedItems.every(isBanner);
    const title = T(onlyBanners ? 'NÁVRH GRAFIKY' : 'NÁVRH PLÁŽOVÉ VLAJKY');
    page.drawText(title, { x:(A4w-font.widthOfTextAtSize(title,15))/2, y, size:15, font, color:ink });
    y -= 16;
    const sub = T(customerLabel(order));
    page.drawText(sub, { x:(A4w-fontR.widthOfTextAtSize(sub,9))/2, y, size:9, font:fontR, color:grey });
    y -= 22;

    // --- Images stacked vertically (one under another), packed to fit ---
    const capGap = 14, blockGap = 20, bottomReserve = M + 24;
    // Velikost obrázků zvol tak, aby se na první stránku vešlo co nejvíc návrhů
    // (typicky 2 pod sebe), ať pod prvním nezůstává prázdné místo.
    const avail = y - bottomReserve;
    const perBlock = (capGap + blockGap);
    const fitCount = Math.max(1, Math.min(visuals.length, Math.floor((avail + blockGap) / (275 + perBlock))) || 1);
    const maxImgH = Math.min(320, (avail - (fitCount - 1) * blockGap) / fitCount - capGap);
    for (const v of visuals) {
      const d = v.img.scale(1);
      const scale = Math.min(contentW / d.width, maxImgH / d.height);
      const w = d.width * scale, h = d.height * scale;
      // new page if this image + caption won't fit above the bottom margin
      if (y - h - capGap < bottomReserve - 2) newPage();
      const ix = (A4w - w) / 2;
      page.drawImage(v.img, { x: ix, y: y - h, width: w, height: h });
      const it = v.item;
      const cap = T(isBanner(it)
        ? `PVC banner ${it.widthCm}×${it.heightCm} cm` + (v.pieceLabel ? ` · ${v.pieceLabel}` : ` · ${it.qty} ks`)
        : `${it.shape} · ${it.size} · ${it.qty} ks`);
      page.drawText(cap, { x: (A4w - fontR.widthOfTextAtSize(cap, 8.5)) / 2, y: y - h - capGap, size: 8.5, font: fontR, color: grey });
      y -= h + capGap + blockGap;
    }

    // --- Price table (whole order) ---
    const priceNeed = ((order.items || []).length + 6) * 15 + 70;
    if (y - priceNeed < M + 40) newPage();
    page.drawLine({ start:{x:M,y}, end:{x:A4w-M,y}, thickness:0.5, color:line });
    y -= 16;
    page.drawText(T('CENOVÁ NABÍDKA'), { x:M, y, size:8, font, color:grey });
    y -= 16;

    const pRow = (label, val, bold=false) => {
      const f = bold ? font : fontR;
      const sz = bold ? 10.5 : 9.5;
      page.drawText(T(label), { x:M, y, size:sz, font:f, color: bold ? ink : grey });
      const vt = T(val);
      page.drawText(vt, { x:A4w-M-f.widthOfTextAtSize(vt,sz), y, size:sz, font:f, color:ink });
      y -= bold ? 0 : 15;
    };

    const tt = computeOrderTotals(order);
    // Per-item lines (bez DPH) – všechny položky objednávky.
    for (const it of (order.items || [])) {
      const lineEx = (it.unitPrice||0) * (it.qty||1);
      const label = isBanner(it)
        ? `PVC banner ${(it.widthCm||0)}×${(it.heightCm||0)} cm  ×  ${it.qty} ks`
        : `Plážová vlajka tvar ${it.shape}, vel. ${it.size}  ×  ${it.qty} ks`;
      pRow(label, money(lineEx));
    }
    if (order.discountPct) pRow(`Sleva ${order.discountPct} %`, '- ' + money(tt.discountEx));
    if (tt.shipEx > 0) pRow('Doprava (bez DPH)', money(tt.shipEx));
    pRow('Cena bez DPH', money(tt.totalEx));
    pRow('DPH celkem', money(tt.totalVat));
    y -= 4;
    page.drawLine({ start:{x:M,y}, end:{x:A4w-M,y}, thickness:0.6, color:ink });
    y -= 16;
    pRow('Celkem k úhradě (vč. DPH)', money(tt.grand), true);

    // --- Footer ---
    const fY = M + 14;
    page.drawLine({ start:{x:M,y:fY+18}, end:{x:A4w-M,y:fY+18}, thickness:0.4, color:line });
    page.drawText(T('Nezávazná cenová nabídka · platí 30 dní'), { x:M, y:fY, size:7.5, font:fontR, color:grey });
    const dt = T(new Date().toLocaleDateString('cs-CZ'));
    page.drawText(dt, { x:A4w-M-fontR.widthOfTextAtSize(dt,7.5), y:fY, size:7.5, font:fontR, color:grey });

    return await pdfDoc.save();
  }
}

document.getElementById('export-client-pdf').addEventListener('click', async () => {
  const order = getOrder(state.currentOrderId);
  if (!order) return;
  showLoading('Generuji PDF pro klienta…');
  try {
    const bytes = await buildClientPdfBytes(order);
    const safe = (customerLabel(order) || 'klient').replace(/[^a-zA-Z0-9_-]+/g,'_');
    downloadBlob(new Blob([bytes], {type:'application/pdf'}), `vizualizace_${safe}.pdf`);
  } catch(e) {
    alert('Export selhalo: ' + e.message);
    console.error(e);
  } finally {
    hideLoading();
  }
});

// =====================================================================
// PROHLÁŠENÍ PRO ÚČETNÍ (Oświadczenie) – polské prohlášení o vývozu vlajek
// z Polska do ČR (dodavatel FFLINEA). Mění se jen datum + názvy z faktury.
// =====================================================================
const DECLARATION_SUPPLIER = 'FFLINEA';
const DECLARATION_NIP = '6692565571';

async function generateDeclarationPdf(order, { flagsText, dateStr }) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  let font, fontB, sanitize = s => String(s ?? '');
  try {
    const b = await loadCzechFontBytes();
    pdfDoc.registerFontkit(window.fontkit);
    font  = await pdfDoc.embedFont(b.reg,  { subset: true });
    fontB = await pdfDoc.embedFont(b.bold, { subset: true });
  } catch {
    font  = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    sanitize = stripDiacritics;
  }
  const T = s => sanitize(String(s ?? ''));
  const A4w = 595.28, A4h = 841.89, M = 70;
  const ink = rgb(0.1, 0.1, 0.1);
  const page = pdfDoc.addPage([A4w, A4h]);
  let y = A4h - M;

  // Datum vpravo nahoře
  const dateLine = T('Czeski Cieszyn, ' + dateStr);
  page.drawText(dateLine, { x: A4w - M - font.widthOfTextAtSize(dateLine, 11), y, size: 11, font, color: ink });
  y -= 40;

  // Hlavička odběratele
  const head = ['Actual Pro s.r.o.', 'Nábřeží Míru 1055/82', '737 01 Český Těšín',
    'IČ: 25882201', 'DIČ: CZ25882201'];
  for (const ln of head) { page.drawText(T(ln), { x: M, y, size: 11, font, color: ink }); y -= 16; }
  y -= 26;

  // Titulek
  const title = T('Oświadczenie');
  page.drawText(title, { x: (A4w - fontB.widthOfTextAtSize(title, 15)) / 2, y, size: 15, font: fontB, color: ink });
  y -= 34;

  // Tělo – word-wrap
  const body = `Oświadczam, że zakupione przez nas flagi reklamowe dla firm: ${flagsText} od ${DECLARATION_SUPPLIER} NIP: ${DECLARATION_NIP} zostały wywiezione poza granicę Państwa Polskiego. Zakupione flagi reklamowe użytkowane będą na terytorium Państwa Czech. Transport flag reklamowych na miejsce docelowe na terytorium Czech.`;
  const size = 11.5, lh = 18, maxW = A4w - M * 2;
  const words = body.split(/\s+/);
  let line = '';
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (font.widthOfTextAtSize(T(test), size) > maxW && line) {
      page.drawText(T(line), { x: M, y, size, font, color: ink }); y -= lh;
      line = wd;
    } else { line = test; }
  }
  if (line) { page.drawText(T(line), { x: M, y, size, font, color: ink }); y -= lh; }

  y -= 90;
  page.drawText(T('Pieczęć i podpis'), { x: M, y, size: 11, font, color: ink });

  return await pdfDoc.save();
}

// Spojí názvy firem do polského výčtu: „A, B oraz C".
function joinCompaniesPl(names) {
  const n = names.filter(Boolean);
  if (n.length <= 1) return n.join('');
  return n.slice(0, -1).join(', ') + ' oraz ' + n[n.length - 1];
}

function addDeclarationCompanyRow(value = '') {
  const box = document.getElementById('declaration-companies');
  const row = document.createElement('div');
  row.className = 'decl-company-row';
  row.innerHTML = `
    <input class="decl-company" list="company-options" placeholder="Název firmy" value="${escapeHtml(value)}">
    <button class="btn danger decl-rm" type="button" title="Odebrat">×</button>`;
  row.querySelector('.decl-rm').addEventListener('click', () => {
    const rows = box.querySelectorAll('.decl-company-row');
    if (rows.length > 1) row.remove();
    else row.querySelector('.decl-company').value = '';
  });
  box.appendChild(row);
}

function openDeclarationModal() {
  // Naplň datalist firmami ze seznamu zákazníků.
  const dl = document.getElementById('company-options');
  const companies = [...new Set(getCustomerDatabase()
    .map(c => c.billing.company).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'cs'));
  dl.innerHTML = companies.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
  // Reset řádky – jedna firma, předvyplněná aktuální objednávkou (pokud nějaká).
  const box = document.getElementById('declaration-companies');
  box.innerHTML = '';
  const cur = state.currentOrderId ? getOrder(state.currentOrderId) : null;
  addDeclarationCompanyRow(cur ? (normalizeCustomer(cur.customer).billing.company || '') : '');
  document.getElementById('declaration-date').value =
    new Date().toLocaleDateString('cs-CZ').replace(/\s/g, '');
  setOcrStatus('declaration-status', '');
  document.getElementById('declaration-modal').classList.remove('hidden');
}
function closeDeclarationModal() {
  document.getElementById('declaration-modal').classList.add('hidden');
}

document.getElementById('open-declaration').addEventListener('click', openDeclarationModal);
document.getElementById('declaration-modal-close').addEventListener('click', closeDeclarationModal);
document.getElementById('declaration-modal').addEventListener('click', (e) => {
  if (e.target.id === 'declaration-modal') closeDeclarationModal();
});
document.getElementById('declaration-add').addEventListener('click', () => addDeclarationCompanyRow());

document.getElementById('declaration-generate').addEventListener('click', async () => {
  const names = [...document.querySelectorAll('.decl-company')]
    .map(i => i.value.trim()).filter(Boolean);
  if (!names.length) { setOcrStatus('declaration-status', 'Vyber aspoň jednu firmu.', 'error'); return; }
  const today = new Date().toLocaleDateString('cs-CZ').replace(/\s/g, '');
  const dateStr = (document.getElementById('declaration-date').value || today).trim();
  setOcrStatus('declaration-status', 'Generuji…', 'active');
  try {
    const bytes = await generateDeclarationPdf(null, { flagsText: joinCompaniesPl(names), dateStr });
    const safe = names.map(n => n.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')).filter(Boolean).join('-');
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `prohlaseni_${safe}.pdf`);
    setOcrStatus('declaration-status', 'Hotovo ✓', 'done');
    setTimeout(closeDeclarationModal, 600);
  } catch (e) {
    setOcrStatus('declaration-status', 'Chyba: ' + e.message, 'error'); console.error(e);
  }
});

// =====================================================================
// E-MAIL — send invoice / visualization via local server (nodemailer)
// =====================================================================

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// E-mail logo = dark logo baked onto a WHITE card (with padding). Images aren't
// recolored by dark-mode clients, so it always shows dark-on-white like the
// visualization, regardless of the recipient's dark/light mode.
let _emailLogoB64 = undefined;
async function getLogoAttachment() {
  if (_emailLogoB64 === undefined) {
    try {
      const darkUrl = await makeDarkLogoDataUrl();       // transparent dark logo
      if (!darkUrl) { _emailLogoB64 = null; }
      else {
        const img = await loadImageFromUrl(darkUrl);
        const padX = Math.round(img.height * 0.35), padY = Math.round(img.height * 0.3);
        const c = document.createElement('canvas');
        c.width = img.width + padX * 2; c.height = img.height + padY * 2;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, padX, padY);
        _emailLogoB64 = c.toDataURL('image/png').split(',')[1];
      }
    } catch { _emailLogoB64 = null; }
  }
  if (!_emailLogoB64) return null;
  return { filename: 'logo.png', contentBase64: _emailLogoB64, contentType: 'image/png', cid: 'provlajkylogo' };
}

// Wrap a template body into a full branded HTML e-mail (dark header + logo).
function wrapEmailHtml(bodyHtml) {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1f2329;border-radius:12px;overflow:hidden;max-width:600px">
        <tr><td style="background:#ffffff;padding:22px 28px 16px;text-align:center">
          <img src="cid:provlajkylogo" alt="PROVLAJKY.CZ" width="300" style="display:block;margin:0 auto;max-width:80%;height:auto;border-radius:8px">
        </td></tr>
        <tr><td style="height:3px;background:#f4d03f"></td></tr>
        <tr><td style="background:#ffffff;padding:28px;font-size:15px;line-height:1.6;color:#1f2937">
          ${bodyHtml}
        </td></tr>
        <tr><td style="background:#1f2329;padding:18px 28px;text-align:center;color:#d1d5db;font-size:12px;line-height:1.8">
          <strong style="color:#ffffff">${escapeHtml((state.settings.mail && state.settings.mail.signName) || '')}</strong><br>
          <span style="color:#9ca3af">🌐 PROVLAJKY.CZ</span><br>
          ${(state.settings.mail && state.settings.mail.signPhone) ? '<span style="color:#9ca3af">📞 ' + escapeHtml(state.settings.mail.signPhone) + '</span><br>' : ''}
          <span style="color:#9ca3af">✉️ info@provlajky.cz</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function fillTemplate(tpl, order, totalStr, extra = {}) {
  const cust = customerLabel(order);
  return (tpl || '')
    .replace(/\{\{customer\}\}/g, escapeHtml(cust))
    .replace(/\{\{order\}\}/g, escapeHtml(order.orderNumber || ''))
    .replace(/\{\{total\}\}/g, escapeHtml(totalStr || ''))
    .replace(/\{\{date\}\}/g, escapeHtml(extra.date || new Date().toLocaleDateString('cs-CZ')))
    .replace(/\{\{invoice\}\}/g, escapeHtml(extra.invoice || ''));
}

function customerEmail(order) {
  const c = normalizeCustomer(order.customer).billing;
  return c.email || '';
}

async function sendEmailViaServer({ to, cc, subject, html, attachments }) {
  const res = await fetch('/api/send-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smtp: mailSmtpPayload(), to, cc, subject, html, attachments }),
  });
  let j;
  try { j = await res.json(); } catch { throw new Error('Server nevrátil platnou odpověď.'); }
  if (!j.ok) throw new Error(j.error || 'Neznámá chyba serveru.');
  return j;
}

function ensureMailReady(order) {
  const m = state.settings.mail || {};
  if (!m.host || !m.user) {
    alert('Nejdřív nastav SMTP v ⚙ Nastavení → Maily.');
    return null;
  }
  const to = customerEmail(order);
  if (!to) {
    alert('Objednávka nemá e-mail zákazníka (fakturační adresa → E-mail).');
    return null;
  }
  return { m, to };
}

document.getElementById('send-invoice').addEventListener('click', async () => {
  const order = getOrder(state.currentOrderId);
  if (!order) return;
  const ready = ensureMailReady(order);
  if (!ready) return;
  if (!order.items?.length) { alert('Objednávka nemá položky.'); return; }
  if (!checkCompanyIco(order)) return;

  showLoading('Generuji fakturu a odesílám…');
  try {
    // Reuse existing invoice for this order, else create one.
    let inv = state.invoices.find(i => i.orderId === order.id);
    if (!inv) { inv = buildInvoiceFromOrder(order); state.invoices.push(inv); saveInvoices(); }
    const bytes = await generateInvoicePdf(inv);
    const b64 = bytesToBase64(bytes);
    const total = fmtMoney(inv.totals.grand, inv.currency);
    const today = new Date().toLocaleDateString('cs-CZ');
    const logoAtt = await getLogoAttachment();
    const att = [
      ...(logoAtt ? [logoAtt] : []),
      { filename: `faktura_${inv.number}.pdf`, contentBase64: b64 },
    ];

    // 1) Zákazník
    const subject = `Objednávka č. ${order.orderNumber || inv.number} - Faktura`;
    const html = wrapEmailHtml(fillTemplate(state.settings.mail.tplInvoice || DEFAULT_MAIL_TPL_INVOICE, order, total,
      { date: today, invoice: inv.number }));
    await sendEmailViaServer({ to: ready.to, subject, html, attachments: att });

    // 2) Účetní – samostatný mail s vlastním předmětem a textem
    const acc = state.settings.mail.accountant;
    if (acc) {
      const accSubject = `provlajky - ${inv.number}`;
      const accHtml = wrapEmailHtml(fillTemplate(
        state.settings.mail.tplAccountant || DEFAULT_MAIL_TPL_ACCOUNTANT,
        order, total, { date: today, invoice: inv.number }));
      await sendEmailViaServer({ to: acc, subject: accSubject, html: accHtml, attachments: att });
    }

    alert(`✅ Faktura odeslána na ${ready.to}` +
      (acc ? `\n✅ Kopie účetní odeslána na ${acc}` : '') + '.');
  } catch (e) {
    alert('Odeslání selhalo: ' + e.message + '\n\nBěží server? Spusť „Spustit PROVLAJKY.command".');
  } finally { hideLoading(); }
});

document.getElementById('send-visual').addEventListener('click', async () => {
  const order = getOrder(state.currentOrderId);
  if (!order) return;
  const ready = ensureMailReady(order);
  if (!ready) return;
  const designed = order.items.filter(i => i.design && i.design.thumb);
  if (!designed.length) { alert('Žádný uložený návrh k odeslání.'); return; }

  showLoading('Generuji vizualizaci a odesílám…');
  try {
    const bytes = await buildClientPdfBytes(order);
    const t = computeOrderTotals(order);
    const total = fmtMoney(t.grand, order.currency);
    const subject = `Objednávka č. ${order.orderNumber || ''} - Cenová nabídka`;
    const html = wrapEmailHtml(fillTemplate(state.settings.mail.tplVisual || DEFAULT_MAIL_TPL_VISUAL, order, total));
    const logoAtt = await getLogoAttachment();
    await sendEmailViaServer({
      to: ready.to,
      subject, html,
      attachments: [
        ...(logoAtt ? [logoAtt] : []),
        { filename: `vizualizace.pdf`, contentBase64: bytesToBase64(bytes) },
      ],
    });
    alert(`✅ Vizualizace odeslána na ${ready.to}.`);
  } catch (e) {
    alert('Odeslání selhalo: ' + e.message + '\n\nBěží server? Spusť „Spustit PROVLAJKY.command".');
  } finally { hideLoading(); }
});

// =====================================================================
// SUPPLIER ORDER — English email to manufacturer + drag&drop attachments
// =====================================================================
let _supplierAtts = [];   // [{ filename, contentBase64, contentType }]
// Server caps the whole e-mail request at 60MB (server.js); base64 adds ~33%
// overhead, so keep total attachment size safely under that limit.
const SUPPLIER_MAX_TOTAL_MB = 40;

function buildSupplierBodyText(order) {
  // English inquiry-style email for the manufacturer (editable in the textarea).
  const rows = (order.items || []).map((it, idx) => {
    if (isBanner(it)) {
      return `• PVC banner — ${(it.widthCm||0)}×${(it.heightCm||0)} cm — quantity: ${it.qty} pcs`;
    }
    const bg = (it.design && it.design.bgColor)
      ? 'background colour: ' + it.design.bgColor.toUpperCase()
      : 'background: as per the attached graphic';
    const sleeve = (it.design && it.design.sleeveColor === 'black') ? 'BLACK' : 'WHITE';
    return `• HS beach flag — shape ${it.shape}, size ${it.size} — ${bg} — pole sleeve colour: ${sleeve} — quantity: ${it.qty} pcs`;
  }).join('\n');
  const items = order.items || [];
  const hasFlags = items.some(it => !isBanner(it));
  const hasBanners = items.some(isBanner);
  const intro = (hasFlags && hasBanners) ? 'please prepare the following items:'
    : hasBanners ? 'please prepare the following PVC banners:'
    : 'please prepare the following HS beach flags:';
  const sign = state.settings.mail?.signName || 'Dominik Špaček';
  const phone = state.settings.mail?.signPhone || '+420 605 981 155';
  return `Hello,

${intro}

${rows}

Please send us your visualization for approval and issue the invoice according to our agreed price list. Could you also let me know the estimated delivery date to Cieszyn?

Thank you.

Best regards,
${sign}
${phone}

ACTUAL PRO s.r.o.
IČO: 25882201
DIČ: CZ25882201`;
}

function supplierAttachmentsTotalBytes() {
  return _supplierAtts.reduce((sum, a) => sum + (a.contentBase64.length * 3 / 4), 0);
}

function renderSupplierAttachments() {
  const box = document.getElementById('supplier-attachments');
  box.innerHTML = '';
  _supplierAtts.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'attach-row';
    const kb = Math.round((a.contentBase64.length * 3 / 4) / 1024);
    row.innerHTML = `<span>📎 ${escapeHtml(a.filename)} <span class="muted">(${kb} kB)</span></span>
      <button class="rm" data-i="${i}" title="Odebrat">×</button>`;
    row.querySelector('.rm').addEventListener('click', () => {
      _supplierAtts.splice(i, 1); renderSupplierAttachments();
    });
    box.appendChild(row);
  });

  const note = document.getElementById('supplier-size-note');
  if (note) {
    const totalMb = supplierAttachmentsTotalBytes() / (1024 * 1024);
    const over = totalMb > SUPPLIER_MAX_TOTAL_MB;
    note.textContent = `Přílohy celkem: ${totalMb.toFixed(1)} MB / max. ${SUPPLIER_MAX_TOTAL_MB} MB na e-mail.`;
    note.style.color = over ? '#dc2626' : '';
  }
}

function addSupplierFiles(fileList) {
  const files = Array.from(fileList || []);
  let pending = files.length;
  if (!pending) return;
  files.forEach(file => {
    const r = new FileReader();
    r.onload = (ev) => {
      const b64 = String(ev.target.result).split(',')[1];
      _supplierAtts.push({ filename: file.name, contentBase64: b64, contentType: file.type || 'application/octet-stream' });
      if (--pending === 0) renderSupplierAttachments();
      else renderSupplierAttachments();
    };
    r.readAsDataURL(file);
  });
}

async function openSupplierModal() {
  const order = getOrder(state.currentOrderId);
  if (!order) return;
  if (!order.items?.length) { alert('Objednávka nemá žádné položky.'); return; }
  _supplierAtts = [];
  renderSupplierAttachments();
  document.getElementById('supplier-to').value = state.settings.mail?.supplier || '';
  document.getElementById('supplier-subject').value =
    `order - ${customerLabel(order)}`;
  document.getElementById('supplier-body').value = buildSupplierBodyText(order);
  setOcrStatus('supplier-status', '');
  document.getElementById('supplier-modal').classList.remove('hidden');

  // Auto-attach our design preview (návrh) for each item + any uploaded artwork.
  for (const it of order.items) {
    // 1) Our návrh = the design thumbnail cropped to the flag area, wrapped as SVG.
    if (it.design?.thumb) {
      try {
        const svg = await cropThumbToFlagSvg(it.design.thumb, it.design.flagBounds);
        _supplierAtts.push({
          filename: `navrh_${it.shape}${it.size}.svg`,
          contentBase64: btoa(unescape(encodeURIComponent(svg))),
          contentType: 'image/svg+xml',
        });
      } catch {}
    }
    // 2) Uploaded full artwork (hotová grafika) – attach the ORIGINAL file
    //    (keeps PDFs as PDF, not the rendered PNG preview).
    const src = it.design?.fullArtwork?.origSrc || it.design?.fullArtwork?.src;
    if (src && src.startsWith('data:')) {
      const isPdf = src.startsWith('data:application/pdf');
      const mime = (src.match(/^data:([^;]+)/) || [])[1] || 'image/png';
      const ext = isPdf ? 'pdf'
        : mime === 'image/jpeg' ? 'jpg'
        : mime === 'image/svg+xml' ? 'svg'
        : (mime.split('/')[1] || 'png');
      _supplierAtts.push({
        filename: `grafika_${it.shape}${it.size}.${ext}`,
        contentBase64: src.split(',')[1],
        contentType: mime,
      });
    }
  }
  renderSupplierAttachments();
}

// Crop a design thumbnail data URL to just the flag area (returns PNG data URL).
async function cropThumbToFlag(thumb, fb) {
  if (!fb || !(fb.w > 0) || !(fb.h > 0)) return thumb;
  const img = await loadImageFromUrl(thumb);
  const pr = fb.pr || 2;
  const cc = document.createElement('canvas');
  cc.width = Math.round(fb.w * pr);
  cc.height = Math.round(fb.h * pr);
  cc.getContext('2d').drawImage(
    img,
    Math.round(fb.x * pr), Math.round(fb.y * pr),
    Math.round(fb.w * pr), Math.round(fb.h * pr),
    0, 0, cc.width, cc.height
  );
  return cc.toDataURL('image/png');
}

// Same crop, but returned as an SVG document wrapping the PNG (vector container).
async function cropThumbToFlagSvg(thumb, fb) {
  const png = await cropThumbToFlag(thumb, fb);
  const img = await loadImageFromUrl(png);
  const w = img.naturalWidth, h = img.naturalHeight;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image x="0" y="0" width="${w}" height="${h}" xlink:href="${png}"/>
</svg>`;
}
function closeSupplierModal() {
  document.getElementById('supplier-modal').classList.add('hidden');
}

document.getElementById('send-supplier').addEventListener('click', openSupplierModal);
document.getElementById('supplier-modal-close').addEventListener('click', closeSupplierModal);
document.getElementById('supplier-modal').addEventListener('click', (e) => {
  if (e.target.id === 'supplier-modal') closeSupplierModal();
});

// Dropzone
const _dz = document.getElementById('supplier-drop');
const _dzInput = document.getElementById('supplier-files');
_dz.addEventListener('click', () => _dzInput.click());
_dzInput.addEventListener('change', (e) => { addSupplierFiles(e.target.files); e.target.value = ''; });
['dragenter','dragover'].forEach(ev => _dz.addEventListener(ev, (e) => {
  e.preventDefault(); e.stopPropagation(); _dz.classList.add('drag');
}));
['dragleave','drop'].forEach(ev => _dz.addEventListener(ev, (e) => {
  e.preventDefault(); e.stopPropagation(); _dz.classList.remove('drag');
}));
_dz.addEventListener('drop', (e) => { addSupplierFiles(e.dataTransfer.files); });

document.getElementById('supplier-send').addEventListener('click', async () => {
  const order = getOrder(state.currentOrderId);
  if (!order) return;
  const to = document.getElementById('supplier-to').value.trim();
  if (!to) { setOcrStatus('supplier-status', 'Vyplň e-mail dodavatele.', 'error'); return; }
  if (supplierAttachmentsTotalBytes() > SUPPLIER_MAX_TOTAL_MB * 1024 * 1024) {
    setOcrStatus('supplier-status', `Přílohy jsou moc velké (max. ${SUPPLIER_MAX_TOTAL_MB} MB celkem). Odeber nějaký soubor.`, 'error');
    return;
  }
  const subject = document.getElementById('supplier-subject').value.trim() || 'Flag production order';
  const bodyText = document.getElementById('supplier-body').value;
  // Plain, unbranded email (no PROVLAJKY logo / header) – this is a B2B order
  // to the manufacturer, not a customer-facing mail.
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5">` +
    bodyText.split('\n').map(l => l.trim() === '' ? '<br>' : `<div>${escapeHtml(l)}</div>`).join('') +
    `</div>`;

  setOcrStatus('supplier-status', 'Odesílám…', 'active');
  try {
    await sendEmailViaServer({
      to, subject, html: bodyHtml,
      attachments: [..._supplierAtts],
    });
    setOcrStatus('supplier-status', 'Odesláno ✓', 'done');
    setTimeout(closeSupplierModal, 800);
    alert(`✅ Objednávka odeslána dodavateli na ${to}.`);
  } catch (e) {
    setOcrStatus('supplier-status', 'Chyba: ' + e.message, 'error');
  }
});

// =====================================================================
// INVOICES — generate from order, list, paid toggle, stats
// =====================================================================

function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = String(year);
  let max = 0;
  for (const inv of state.invoices) {
    if (inv.number && inv.number.startsWith(prefix)) {
      const seq = parseInt(inv.number.slice(prefix.length), 10);
      if (seq > max) max = seq;
    }
  }
  return prefix + String(max + 1).padStart(4, '0'); // e.g. 20260001
}

// ---------- QR Platba (Czech SPD standard) ----------
function mod97(s) { let r = 0; for (const ch of s) r = (r * 10 + (ch.charCodeAt(0) - 48)) % 97; return r; }

// Convert a Czech account number ("[prefix-]number/bankcode") to IBAN.
function accountToIban(acc) {
  if (!acc) return null;
  const m = String(acc).replace(/\s/g, '').match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
  if (!m) return null;
  const prefix = (m[1] || '').padStart(6, '0');
  const number = m[2].padStart(10, '0');
  const bank   = m[3];
  const bban = bank + prefix + number;          // 20 digits
  const check = 98 - mod97(bban + '1235' + '00'); // CZ → 12,35
  return 'CZ' + String(check).padStart(2, '0') + bban;
}

// Build a SPD (Short Payment Descriptor) string for the Czech QR payment.
function buildSpdString({ iban, amount, vs, msg, currency = 'CZK' }) {
  const parts = ['SPD', '1.0', 'ACC:' + iban];
  if (amount != null) parts.push('AM:' + Number(amount).toFixed(2));
  parts.push('CC:' + currency);
  if (vs) parts.push('X-VS:' + String(vs).replace(/\D/g, '').slice(0, 10));
  if (msg) parts.push('MSG:' + msg.replace(/\*/g, ' ').slice(0, 60));
  return parts.join('*');
}

// Render a QR code (qrcode-generator) to a crisp PNG data URL via canvas.
function qrToPngDataUrl(text, targetPx = 360) {
  if (typeof qrcode === 'undefined') return null;
  const qr = qrcode(0, 'M');       // type 0 = auto size, error correction M
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = Math.max(2, Math.floor(targetPx / (n + 2)));
  const margin = cell * 2;
  const size = cell * n + margin * 2;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#111111';
  for (let r = 0; r < n; r++)
    for (let col = 0; col < n; col++)
      if (qr.isDark(r, col)) ctx.fillRect(margin + col * cell, margin + r * cell, cell, cell);
  return c.toDataURL('image/png');
}

// Generate a QR-payment PNG data URL for an invoice (or null if not possible).
async function makePaymentQrDataUrl(inv) {
  const iban = accountToIban(SUPPLIER.bank);
  if (!iban) return null;
  const amount = inv.kind === 'payout' ? inv.amount : inv.totals.grand;
  const spd = buildSpdString({
    iban,
    amount,
    vs: inv.number,
    msg: 'Faktura ' + inv.number,
    currency: inv.currency || 'CZK',
  });
  try {
    return qrToPngDataUrl(spd, 360);
  } catch (e) { console.warn('QR gen failed', e); return null; }
}

function buildInvoiceFromOrder(order) {
  const norm = normalizeCustomer(order.customer);
  const cust = norm.billing;
  const ship = norm.shipping;
  const t = computeOrderTotals(order);
  const now = Date.now();
  const due = now + 7 * 24 * 3600 * 1000;
  return {
    id: uid(),
    number: nextInvoiceNumber(),
    orderId: order.id,
    orderNumber: order.orderNumber || '',
    issued: now,
    taxDate: now,   // datum zdanitelného plnění (DUZP) – default = datum vystavení
    due,
    paid: false,
    currency: order.currency || 'CZK',
    foreign: !!order.foreign,
    customer: cust,
    shipping_customer: {
      ship_company: ship.company, ship_name: ship.name,
      ship_street: ship.street, ship_psc: ship.psc,
      ship_city: ship.city, ship_phone: ship.phone,
    },
    items: (order.items || []).map(it => ({
      desc: isBanner(it)
        ? `PVC banner – ${(it.widthCm||0)}×${(it.heightCm||0)} cm`
        : `Plážová vlajka – tvar ${it.shape}, velikost ${it.size}`,
      qty: it.qty, unitPrice: it.unitPrice || 0,
      vatRate: it.vatRate != null ? it.vatRate : 0.21,
      thumb: it.design?.thumb || null,
      thumbBounds: it.design?.flagBounds || null,
    })),
    discountPct: order.discountPct || 0,
    shipping: order.shipping || 0,
    shipVatRate: order.shipVatRate != null ? order.shipVatRate : 0.21,
    totals: t,
  };
}

async function generateInvoicePdf(inv) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  let font, fontB, sanitize = (s) => String(s == null ? '' : s);
  try {
    const bytes = await loadCzechFontBytes();
    pdfDoc.registerFontkit(window.fontkit);
    font  = await pdfDoc.embedFont(bytes.reg,  { subset: true });
    fontB = await pdfDoc.embedFont(bytes.bold, { subset: true });
  } catch {
    font  = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    sanitize = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  const T = (s) => sanitize(s);
  const W = 595.28, H = 841.89, M = 52;
  const page = pdfDoc.addPage([W, H]);
  const ink = rgb(0.1, 0.1, 0.1), grey = rgb(0.52, 0.54, 0.57), light = rgb(0.68, 0.70, 0.73), line = rgb(0.87, 0.88, 0.90);
  const cur = inv.currency || 'CZK';
  const money = (n) => T(fmtMoney(n, cur));
  const rightText = (txt, xRight, yy, f = font, size = 9, col = ink) => {
    const w = f.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x: xRight - w, y: yy, size, font: f, color: col });
  };
  const drawLabel = (txt, x, yy) =>
    page.drawText(T(txt), { x, y: yy, size: 7.5, font: fontB, color: light });
  const contentR = W - M;
  let y = H - M;

  // ===== PAYOUT INVOICE (partner → ACTUAL PRO, "Administrativa") =====
  if (inv.kind === 'payout') {
    const sup = inv.supplier, cuz = inv.customer;
    page.drawText(T('Faktura'), { x: M, y: y - 14, size: 24, font: fontB, color: ink });
    page.drawText(T('č. ' + inv.number), { x: M, y: y - 30, size: 9, font, color: grey });
    rightText(T(sup.name || sup.person || ''), contentR, y, fontB, 11, ink);
    const supLines = [sup.street, sup.city,
      (sup.ico ? 'IČO ' + sup.ico : '') + (sup.dic ? '  ·  DIČ ' + sup.dic : ''),
      sup.dic || sup.ico ? '' : 'Neplátce DPH'].filter(Boolean);
    supLines.forEach((l, i) => rightText(T(l), contentR, y - 16 - i * 11, font, 8.5, grey));
    y -= 56;
    page.drawLine({ start:{x:M,y}, end:{x:contentR,y}, thickness:0.6, color:line }); y -= 22;

    // Odběratel = ACTUAL PRO
    drawLabel('ODBĚRATEL', M, y);
    const cl = [cuz.company, cuz.street, [cuz.psc, cuz.city].filter(Boolean).join(' '),
      'IČO ' + cuz.ico + '   DIČ ' + cuz.dic].filter(Boolean);
    cl.forEach((l, i) => page.drawText(T(l), { x: M, y: y-14-i*12, size: i===0?9:8.5, font: i===0?fontB:font, color: i===0?ink:grey }));
    // Platební údaje
    const fmtD = ts => new Date(ts).toLocaleDateString('cs-CZ');
    const meta = [['Datum vystavení', fmtD(inv.issued)], ['Datum splatnosti', fmtD(inv.due)],
      ['Variabilní symbol', inv.number]];
    if (sup.bank) meta.push(['Číslo účtu', sup.bank]);
    drawLabel('PLATEBNÍ ÚDAJE', M + 316, y);
    meta.forEach((m, i) => {
      page.drawText(T(m[0]), { x: M+316, y: y-14-i*14, size: 8.5, font, color: grey });
      rightText(T(m[1]), contentR, y-14-i*14, fontB, 8.5, ink);
    });
    y -= 14 + Math.max(cl.length, meta.length) * 13 + 30;

    // Single line item
    page.drawText(T('Popis'), { x: M, y, size: 8, font: fontB, color: grey });
    rightText(T('Částka'), contentR, y, fontB, 8, grey);
    y -= 8; page.drawLine({ start:{x:M,y}, end:{x:contentR,y}, thickness:0.7, color:ink }); y -= 20;
    page.drawText(T(inv.subject || 'Administrativa'), { x: M, y, size: 11, font, color: ink });
    rightText(money(inv.amount), contentR, y, font, 11, ink);
    y -= 14; page.drawLine({ start:{x:M,y}, end:{x:contentR,y}, thickness:0.4, color:line }); y -= 26;
    page.drawText(T('Celkem k úhradě'), { x: 318, y, size: 12, font: fontB, color: ink });
    rightText(money(inv.amount), contentR, y - 1, fontB, 15, ink);
    if (!sup.dic) {
      y -= 22;
      page.drawText(T('Dodavatel není plátcem DPH.'), { x: M, y, size: 8.5, font, color: grey });
    }
    // Footer
    const fy = M + 14;
    page.drawLine({ start:{x:M,y:fy+18}, end:{x:contentR,y:fy+18}, thickness:0.4, color:line });
    page.drawText(T('Vystaveno za administrativní činnost.'), { x: M, y: fy, size: 8, font, color: grey });
    const bytes = await pdfDoc.save();
    return bytes;
  }

  // ---- Header (product invoice) ----
  page.drawText(T('Faktura'), { x: M, y: y - 14, size: 24, font: fontB, color: ink });
  page.drawText(T('č. ' + inv.number), { x: M, y: y - 30, size: 9, font, color: grey });
  rightText(T(SUPPLIER.name), contentR, y, fontB, 11, ink);
  [SUPPLIER.street, SUPPLIER.city, 'IČO ' + SUPPLIER.ico + '  ·  DIČ ' + SUPPLIER.dic]
    .forEach((l, i) => rightText(T(l), contentR, y - 16 - i * 11, font, 8.5, grey));
  y -= 52;
  page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.6, color: line });
  y -= 22;

  // ---- Three columns: Odběratel | Doručovací adresa | Platební údaje ----
  const col1 = M, col2 = M + 158, col3 = M + 316;
  const lineH = 12, bodySize = 8.5, boldSize = 9;

  // Odběratel (billing)
  drawLabel('ODBĚRATEL (FAKTURAČNÍ)', col1, y);
  const c = inv.customer;
  const billLines = [
    c.company, c.name, c.street,
    [c.psc, c.city].filter(Boolean).join(' '),
    c.ico ? 'IČO: ' + c.ico : '',
    c.dic ? 'DIČ: ' + c.dic : '',
    c.email ? 'E-mail: ' + c.email : '',
    c.phone ? 'Tel: ' + c.phone : '',
  ].filter(Boolean);
  billLines.forEach((l, i) => page.drawText(T(l), {
    x: col1, y: y - 14 - i * lineH,
    size: i === 0 ? boldSize : (l.startsWith('E-mail') ? 7.5 : bodySize),
    font: i === 0 ? fontB : font, color: i === 0 ? ink : grey }));

  // Doručovací adresa (shipping) – z invoice data pokud je, jinak billing
  const ship = inv.shipping_customer || c;
  drawLabel('DORUČOVACÍ ADRESA', col2, y);
  const shipPhone = ship.ship_phone || ship.phone;
  const shipLines = [
    ship.ship_company || ship.company, ship.ship_name || ship.name,
    ship.ship_street || ship.street,
    [(ship.ship_psc || ship.psc), (ship.ship_city || ship.city)].filter(Boolean).join(' '),
    shipPhone ? 'Tel: ' + shipPhone : '',
  ].filter(Boolean);
  shipLines.forEach((l, i) => page.drawText(T(l), {
    x: col2, y: y - 14 - i * lineH, size: i === 0 ? boldSize : bodySize,
    font: i === 0 ? fontB : font, color: i === 0 ? ink : grey }));

  // Platební údaje — tuzemská faktura: číslo účtu; zahraniční: IBAN + BIC/SWIFT.
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('cs-CZ');
  const meta = [
    ['Datum vystavení', fmtDate(inv.issued)],
    ['Datum zdan. plnění', fmtDate(inv.taxDate || inv.issued)],
    ['Datum splatnosti', fmtDate(inv.due)],
    ['Variabilní symbol', inv.number],
    ['Forma úhrady', 'Převodem'],
  ];
  if (inv.foreign) {
    const iban = accountToIban(SUPPLIER.bank);
    if (iban) meta.push(['IBAN', iban.replace(/(.{4})/g, '$1 ').trim()]);
    if (SUPPLIER.bic) meta.push(['BIC/SWIFT', SUPPLIER.bic]);
  } else if (SUPPLIER.bank) {
    meta.push(['Číslo účtu', SUPPLIER.bank]);
  }
  drawLabel('PLATEBNÍ ÚDAJE', col3, y);
  meta.forEach((m, i) => {
    page.drawText(T(m[0]), { x: col3, y: y - 14 - i * lineH, size: bodySize, font, color: grey });
    rightText(T(m[1]), contentR, y - 14 - i * lineH, fontB, bodySize, ink);
  });

  const infoRows = Math.max(billLines.length, shipLines.length, meta.length);
  y -= 14 + infoRows * lineH + 22;

  // ---- Items table (column breakdown: bez DPH | DPH | s DPH) ----
  // Right-edge X positions for the numeric columns.
  const cX = { qty: 286, unit: 348, vat: 392, ex: 450, dph: 498, total: contentR };
  const head = (txt, x, rightAlign = true) => {
    if (rightAlign) rightText(T(txt), x, y, fontB, 7, grey);
    else page.drawText(T(txt), { x, y, size: 7, font: fontB, color: grey });
  };
  head('Položka', M, false);
  head('Ks', cX.qty);
  head('Cena/ks', cX.unit);
  head('DPH %', cX.vat);
  head('Cena bez DPH', cX.ex);
  head('DPH', cX.dph);
  head('Cena s DPH', cX.total);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.8, color: ink });
  y -= 16;

  // Pre-embed design thumbnails (async) so we can draw them in the row.
  // Crop each thumbnail to its flag bounds so the flag fills the box (the raw
  // thumbnail has a lot of empty canvas around the flag).
  const thumbCache = new Map();
  for (const it of inv.items) {
    if (it.thumb && !thumbCache.has(it.thumb)) {
      try {
        let bytes;
        const fb = it.thumbBounds;
        if (fb && fb.w > 0 && fb.h > 0) {
          const img = await loadImageFromUrl(it.thumb);
          const pr = fb.pr || 2;
          const cc = document.createElement('canvas');
          cc.width = Math.round(fb.w * pr);
          cc.height = Math.round(fb.h * pr);
          cc.getContext('2d').drawImage(
            img,
            Math.round(fb.x * pr), Math.round(fb.y * pr),
            Math.round(fb.w * pr), Math.round(fb.h * pr),
            0, 0, cc.width, cc.height
          );
          bytes = await fetch(cc.toDataURL('image/png')).then(r => r.arrayBuffer());
        } else {
          bytes = await fetch(it.thumb).then(r => r.arrayBuffer());
        }
        thumbCache.set(it.thumb, await pdfDoc.embedPng(bytes));
      } catch { thumbCache.set(it.thumb, null); }
    }
  }

  const rowH = 30, thW = 18, thH = 24, descX = M + thW + 8;
  let sumEx = 0, sumVat = 0, sumGross = 0;
  let zebra = false;
  for (const it of inv.items) {
    const lineEx = it.unitPrice * it.qty;
    const lineVat = lineEx * (it.vatRate || 0);
    const lineGross = lineEx + lineVat;
    sumEx += lineEx; sumVat += lineVat; sumGross += lineGross;

    if (zebra) page.drawRectangle({ x: M - 4, y: y - 9, width: contentR - M + 8, height: rowH - 4, color: rgb(0.975, 0.978, 0.983) });
    zebra = !zebra;

    // Thumbnail (design preview) at the left
    const timg = it.thumb && thumbCache.get(it.thumb);
    if (timg) {
      const r = Math.min(thW / timg.width, thH / timg.height);
      const iw = timg.width * r, ih = timg.height * r;
      const cy = y + 3; // visual center of the row
      page.drawImage(timg, { x: M + (thW - iw) / 2, y: cy - ih / 2, width: iw, height: ih });
    }
    // Description (truncate if very long)
    let desc = it.desc;
    while (font.widthOfTextAtSize(T(desc), 8.5) > cX.qty - descX - 8 && desc.length > 8) desc = desc.slice(0, -2);
    page.drawText(T(desc + (desc !== it.desc ? '…' : '')), { x: descX, y, size: 8.5, font, color: ink });
    rightText(T(String(it.qty)), cX.qty, y, font, 8.5, ink);
    rightText(money(it.unitPrice), cX.unit, y, font, 8.5, ink);
    rightText(T(Math.round((it.vatRate || 0) * 100) + ' %'), cX.vat, y, font, 8.5, grey);
    rightText(money(lineEx), cX.ex, y, font, 8.5, ink);
    rightText(money(lineVat), cX.dph, y, font, 8.5, grey);
    rightText(money(lineGross), cX.total, y, fontB, 8.5, ink);
    y -= rowH;
  }

  const tt = inv.totals;

  // Shipping as a regular line item (Ks 1, Cena/ks, DPH %, ...).
  if (tt.shipEx > 0) {
    if (zebra) page.drawRectangle({ x: M - 4, y: y - 9, width: contentR - M + 8, height: rowH - 4, color: rgb(0.975, 0.978, 0.983) });
    zebra = !zebra;
    const shVat = inv.shipVatRate != null ? inv.shipVatRate : 0.21;
    page.drawText(T('Doprava'), { x: descX, y, size: 8.5, font, color: ink });
    rightText(T('1'), cX.qty, y, font, 8.5, ink);
    rightText(money(tt.shipEx), cX.unit, y, font, 8.5, ink);
    rightText(T(Math.round(shVat * 100) + ' %'), cX.vat, y, font, 8.5, grey);
    rightText(money(tt.shipEx), cX.ex, y, font, 8.5, ink);
    rightText(money(tt.shipVat), cX.dph, y, font, 8.5, grey);
    rightText(money(tt.shipEx + tt.shipVat), cX.total, y, fontB, 8.5, ink);
    y -= rowH;
  }

  // Discount row (span the table, right side)
  y -= 2;
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: contentR, y: y + 6 }, thickness: 0.6, color: ink });
  y -= 8;
  if (inv.discountPct) {
    // Discount reduces the taxable base → show its VAT effect too, so columns add up.
    const discVat = sumVat * inv.discountPct / 100;
    page.drawText(T('Sleva ' + inv.discountPct + ' %'), { x: M, y, size: 8.5, font, color: grey });
    rightText('- ' + money(tt.discountEx), cX.ex, y, font, 8.5, grey);
    rightText('- ' + money(discVat), cX.dph, y, font, 8.5, grey);
    rightText('- ' + money(tt.discountEx + discVat), cX.total, y, font, 8.5, grey);
    y -= 15;
  }

  // Součet row (column sums)
  page.drawText(T('Součet'), { x: M, y, size: 9, font: fontB, color: ink });
  rightText(money(tt.totalEx), cX.ex, y, fontB, 9, ink);
  rightText(money(tt.totalVat), cX.dph, y, fontB, 9, ink);
  rightText(money(tt.grand), cX.total, y, fontB, 9, ink);
  y -= 16;

  // Celkem k úhradě – jemný světle šedý pruh (jako zebra u produktů)
  const barH = 28;
  page.drawRectangle({ x: M - 4, y: y - barH + 9, width: contentR - M + 8, height: barH, color: rgb(0.95, 0.96, 0.97) });
  page.drawText(T('Celkem k úhradě'), { x: M + 4, y: y - 5, size: 11, font: fontB, color: ink });
  rightText(money(tt.grand) + ' ' + (inv.currency || 'CZK'), contentR - 2, y - 6, fontB, 13, ink);
  y -= barH + 10;

  // ---- QR Platba – v jemném platebním panelu ----
  const qrUrl = await makePaymentQrDataUrl(inv);
  if (qrUrl) {
    try {
      const qrBytes = await fetch(qrUrl).then(r => r.arrayBuffer());
      const qrImg = await pdfDoc.embedPng(qrBytes);
      y -= 14;
      const panelH = 104, pad = 14, qs = panelH - pad * 2;
      const panelTop = y, panelBottom = y - panelH;
      // panel background + jemný rámeček
      page.drawRectangle({ x: M, y: panelBottom, width: contentR - M, height: panelH, color: rgb(0.97, 0.975, 0.98) });
      page.drawRectangle({ x: M, y: panelBottom, width: contentR - M, height: panelH,
        borderColor: rgb(0.88, 0.89, 0.91), borderWidth: 0.8, color: undefined });
      // QR vlevo
      const qx = M + pad, qy = panelBottom + pad;
      page.drawImage(qrImg, { x: qx, y: qy, width: qs, height: qs });
      // text vpravo, svisle vystředěné vůči QR
      const tx = qx + qs + 18;
      let ty2 = panelTop - pad - 6;
      page.drawText(T('Zaplaťte mobilem'), { x: tx, y: ty2, size: 11, font: fontB, color: ink }); ty2 -= 16;
      page.drawText(T('Naskenujte QR kód v bankovní aplikaci.'), { x: tx, y: ty2, size: 8.5, font, color: grey }); ty2 -= 13;
      page.drawText(T('Částka, účet i variabilní symbol jsou předvyplněné.'), { x: tx, y: ty2, size: 8.5, font, color: grey }); ty2 -= 18;
      // shrnutí platby
      const accLbl = inv.foreign ? 'IBAN' : 'Účet';
      const accVal = inv.foreign ? (accountToIban(SUPPLIER.bank) || '').replace(/(.{4})/g,'$1 ').trim() : SUPPLIER.bank;
      page.drawText(T(`${accLbl}: ${accVal}`), { x: tx, y: ty2, size: 9, font: fontB, color: ink }); ty2 -= 13;
      page.drawText(T(`VS: ${inv.number}   ·   ${money(tt.grand)} ${inv.currency || 'CZK'}`), { x: tx, y: ty2, size: 9, font: fontB, color: ink });
      y = panelBottom;
    } catch (e) { console.warn('QR embed failed', e); }
  }

  // ---- Footer ----
  const fY = M + 14;
  page.drawLine({ start: { x: M, y: fY + 18 }, end: { x: contentR, y: fY + 18 }, thickness: 0.4, color: line });
  page.drawText(T('Děkujeme za Vaši objednávku.'), { x: M, y: fY, size: 8.5, font, color: grey });
  rightText(T(SUPPLIER.name + '  ·  IČO ' + SUPPLIER.ico + '  ·  DIČ ' + SUPPLIER.dic), contentR, fY, font, 8, grey);

  const bytes = await pdfDoc.save();
  return bytes;
}

async function downloadInvoicePdf(inv) {
  const bytes = await generateInvoicePdf(inv);
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `faktura_${inv.number}.pdf`);
}

// Když je nákup na firmu, musí být vyplněné aspoň IČO.
function checkCompanyIco(order) {
  const b = normalizeCustomer(order.customer).billing;
  if (b.isCompany && !(b.ico || '').trim()) {
    alert('Nákup je označen „na firmu" – vyplň prosím IČO ve fakturační adrese.');
    return false;
  }
  return true;
}

document.getElementById('generate-invoice').addEventListener('click', async () => {
  const order = getOrder(state.currentOrderId);
  if (!order) return;
  if (!order.items || !order.items.length) { alert('Objednávka nemá žádné položky.'); return; }
  if (!checkCompanyIco(order)) return;
  // Reuse existing invoice for this order if present.
  let inv = state.invoices.find(i => i.orderId === order.id);
  if (inv) {
    if (!confirm('Pro tuto objednávku už faktura existuje (č. ' + inv.number + '). Vygenerovat PDF znovu?')) return;
    // refresh totals/customer from current order
    Object.assign(inv, buildInvoiceFromOrder(order), { id: inv.id, number: inv.number, paid: inv.paid });
  } else {
    inv = buildInvoiceFromOrder(order);
    state.invoices.push(inv);
  }
  saveInvoices();
  try {
    await downloadInvoicePdf(inv);
    alert('✅ Faktura č. ' + inv.number + ' vygenerována a uložena do Stažených.');
  } catch (e) { alert('Generování faktury selhalo: ' + e.message); }
});

function renderInvoices() {
  const list = document.getElementById('invoices-list');
  list.innerHTML = '';
  document.getElementById('invoices-empty').style.display =
    state.invoices.length ? 'none' : 'block';
  const sorted = state.invoices.slice().sort((a, b) => b.issued - a.issued);
  for (const inv of sorted) {
    const card = document.createElement('div');
    card.className = 'order-card invoice-card';
    const isPayout = inv.kind === 'payout';
    const cust = isPayout
      ? (inv.supplier?.name || inv.supplier?.person || '') + ' → ' + (inv.customer?.company || '')
      : (inv.customer.company || inv.customer.name || '(bez jména)');
    const amount = isPayout ? inv.amount : inv.totals.grand;
    const titleTxt = isPayout
      ? `Faktura č. ${inv.number} · Administrativa`
      : `Faktura č. ${inv.number}`;
    card.innerHTML = `
      <div>
        <div class="title">${escapeHtml(titleTxt)}</div>
        <div class="meta">${escapeHtml(cust)} · ${new Date(inv.issued).toLocaleDateString('cs-CZ')}
          · ${escapeHtml(fmtMoney(amount, inv.currency))}</div>
      </div>
      <div class="right-col">
        <span class="paid-toggle ${inv.paid ? 'on' : ''}">
          <span class="toggle-switch"></span>${inv.paid ? 'Zaplaceno' : 'Nezaplaceno'}
        </span>
        <button class="btn inv-download">⬇ PDF</button>
        <button class="btn danger inv-delete">×</button>
      </div>
    `;
    card.querySelector('.paid-toggle').addEventListener('click', () => {
      inv.paid = !inv.paid;
      saveInvoices();
      renderInvoices();
    });
    card.querySelector('.inv-download').addEventListener('click', () => downloadInvoicePdf(inv));
    card.querySelector('.inv-delete').addEventListener('click', () => {
      if (!confirm('Smazat fakturu č. ' + inv.number + '?')) return;
      // If it's a payout invoice, also remove the linked payout record.
      if (inv.payoutId) {
        state.payouts = state.payouts.filter(p => p.id !== inv.payoutId);
        savePayouts();
      }
      state.invoices = state.invoices.filter(i => i.id !== inv.id);
      saveInvoices();
      renderInvoices();
      renderEarnings();
    });
    list.appendChild(card);
  }
}

// ---------- Statistics ----------
function renderStats() {
  const box = document.getElementById('stats-content');
  const completed = state.orders.filter(isRealizedOrder);

  // Aggregate by month (YYYY-MM) using order createdAt.
  const months = {};
  let totalEx = 0, totalGrand = 0, totalVat = 0, totalProfit = 0, totalCost = 0;
  for (const o of completed) {
    const t = computeOrderTotals(o);
    const cost = computeOrderCost(o);
    const profit = computeOrderProfit(o);
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[key]) months[key] = { ex: 0, vat: 0, grand: 0, profit: 0, count: 0 };
    months[key].ex += t.totalEx;
    months[key].vat += t.totalVat;
    months[key].grand += t.grand;
    months[key].profit += profit;
    months[key].count += 1;
    totalEx += t.totalEx; totalVat += t.totalVat; totalGrand += t.grand;
    totalProfit += profit; totalCost += cost;
  }
  const cur = completed[0]?.currency || 'CZK';
  const keys = Object.keys(months).sort().reverse();

  const card = (label, val, accent) =>
    `<div class="stat-card"><div class="label">${label}</div><div class="value" ${accent?'style="color:#16a34a"':''}>${escapeHtml(fmtMoney(val, cur))}</div></div>`;

  let html = `
    <div class="stats-cards">
      ${card('Obrat celkem (bez DPH)', totalEx)}
      ${card('Náklady celkem', totalCost)}
      ${card('Zisk celkem', totalProfit, true)}
      ${card('Obrat celkem (s DPH)', totalGrand)}
      <div class="stat-card"><div class="label">Dokončených objednávek</div><div class="value">${completed.length}</div></div>
    </div>`;

  if (keys.length) {
    html += `<table class="stats-table">
      <thead><tr><th>Měsíc</th><th>Obj.</th><th>Obrat bez DPH</th><th>DPH</th><th>Obrat s DPH</th><th>Zisk</th></tr></thead>
      <tbody>`;
    const monthName = (k) => {
      const [y, m] = k.split('-');
      return new Date(y, m - 1, 1).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
    };
    for (const k of keys) {
      const m = months[k];
      html += `<tr><td>${escapeHtml(monthName(k))}</td><td>${m.count}</td>
        <td>${escapeHtml(fmtMoney(m.ex, cur))}</td>
        <td>${escapeHtml(fmtMoney(m.vat, cur))}</td>
        <td>${escapeHtml(fmtMoney(m.grand, cur))}</td>
        <td style="font-weight:600;color:#16a34a">${escapeHtml(fmtMoney(m.profit, cur))}</td></tr>`;
    }
    html += `</tbody></table>`;
    html += `<p class="muted" style="margin-top:10px">Zisk = základ daně celkem (produkty po slevě + doprava, bez DPH) − náklad. Náklad = faktury dodavatele (přesný), jinak odhad dle nastavení velikostí.</p>`;
  } else {
    html += `<p class="muted">Žádné zaplacené objednávky. Statistika se počítá ze zaplacených objednávek (stav „Dokončena" nebo „Zaplaceno…").</p>`;
  }
  box.innerHTML = html;
}

// ---------- Earnings (výdělky) ----------
function totalCompanyProfit() {
  return state.orders.filter(isRealizedOrder)
    .reduce((s, o) => s + computeOrderProfit(o), 0);
}
function partnerPaidOut(partnerId) {
  return state.payouts.filter(p => p.partnerId === partnerId)
    .reduce((s, p) => s + p.amount, 0);
}

function renderEarnings() {
  const box = document.getElementById('earnings-content');
  const profit = totalCompanyProfit();
  const cur = 'CZK';
  const totalPaid = state.payouts.reduce((s, p) => s + p.amount, 0);

  let html = `
    <div class="stats-cards">
      <div class="stat-card"><div class="label">Zisk celkem</div><div class="value" style="color:#16a34a">${escapeHtml(fmtMoney(profit, cur))}</div></div>
      <div class="stat-card"><div class="label">Vyplaceno</div><div class="value">${escapeHtml(fmtMoney(totalPaid, cur))}</div></div>
      <div class="stat-card"><div class="label">K vyplacení</div><div class="value">${escapeHtml(fmtMoney(profit - totalPaid, cur))}</div></div>
    </div>`;

  for (const p of state.settings.partners) {
    const share = (p.share || 0) / 100;
    const earned = profit * share;
    const paid = partnerPaidOut(p.id);
    const remaining = earned - paid;
    html += `
      <div class="earnings-partner">
        <div>
          <div class="ep-name">${escapeHtml(p.name)} <span class="muted" style="font-weight:400">· ${p.share||0} %</span></div>
          <div class="ep-meta">Nárok ${escapeHtml(fmtMoney(earned, cur))} · vyplaceno ${escapeHtml(fmtMoney(paid, cur))}</div>
        </div>
        <div style="text-align:right">
          <div class="ep-amount">${escapeHtml(fmtMoney(remaining, cur))}</div>
          <button class="btn primary payout-btn" data-pid="${p.id}" ${remaining <= 0 ? 'disabled' : ''}>Vyplatit</button>
        </div>
      </div>`;
  }
  html += `<p class="muted" style="margin-top:8px">Vyplacení vytvoří fakturu od společníka na ACTUAL PRO s.r.o. (předmět „Administrativa") a uloží ji do Faktur.</p>`;
  box.innerHTML = html;

  box.querySelectorAll('.payout-btn').forEach(btn => {
    btn.addEventListener('click', () => payoutPartner(btn.dataset.pid));
  });
}

async function payoutPartner(partnerId) {
  const p = state.settings.partners.find(x => x.id === partnerId);
  if (!p) return;
  const b = p.billing || {};
  if (!b.name && !b.company) {
    alert('U společníka ' + p.name + ' nejsou vyplněné fakturační údaje. Doplň je v Nastavení → Společníci.');
    return;
  }
  const profit = totalCompanyProfit();
  const earned = profit * (p.share || 0) / 100;
  const remaining = earned - partnerPaidOut(partnerId);
  if (remaining <= 0) { alert('Není co vyplatit.'); return; }

  if (!confirm(`Vyplatit ${p.name}: ${fmtMoney(remaining, 'CZK')}?\n\nVytvoří se faktura od ${p.name} na ACTUAL PRO s.r.o. (předmět „Administrativa").`)) return;

  // Record payout
  const payout = {
    id: uid(), partnerId, partnerName: p.name,
    amount: Math.round(remaining * 100) / 100,
    date: Date.now(),
  };
  state.payouts.push(payout);
  savePayouts();

  // Build payout invoice (partner → ACTUAL PRO, subject Administrativa)
  const inv = {
    id: uid(),
    number: nextInvoiceNumber(),
    payoutId: payout.id,
    kind: 'payout',
    issued: Date.now(),
    due: Date.now() + 14 * 24 * 3600 * 1000,
    paid: false,
    currency: 'CZK',
    // supplier = partner; customer = ACTUAL PRO
    supplier: {
      name: b.company || b.name, ico: b.ico || '', dic: b.dic || '',
      street: b.street || '', city: [b.psc, b.city].filter(Boolean).join(' '),
      bank: b.bank || '', person: b.name || '',
    },
    customer: {
      company: SUPPLIER.name, name: '', ico: SUPPLIER.ico, dic: SUPPLIER.dic,
      street: SUPPLIER.street, psc: '', city: SUPPLIER.city,
    },
    subject: 'Administrativa',
    amount: payout.amount,
  };
  state.invoices.push(inv);
  saveInvoices();

  try {
    await downloadInvoicePdf(inv);
  } catch (e) { console.warn('payout pdf', e); }

  renderEarnings();
  renderInvoices();
  alert(`✅ Vyplaceno ${fmtMoney(payout.amount, 'CZK')} pro ${p.name}.\nFaktura č. ${inv.number} vygenerována a uložena do Faktur i do Stažených.`);
}

// =====================================================================
// Boot
// =====================================================================
console.log('[BOOT] dosažena boot sekce – listenery navázány');
// Defensive: make sure no overlay is left covering the UI.
document.getElementById('loading-overlay').classList.add('hidden');
document.getElementById('wc-modal').classList.add('hidden');

fillWcConfigForm();

// Load persisted data from IndexedDB, then render.
(async () => {
  try {
    await loadPersisted();
  } catch (e) {
    console.error('Načtení dat selhalo:', e);
  }
  rebuildStatusFilter();
  renderOrdersList();
  renderHome();
  navTo('home');
  console.log('%c[BOOT] hotovo ✓', 'color:green;font-weight:bold');
  if (!state.wcConfig) {
    document.getElementById('sync-info').textContent =
      'Tip: klikni na „⚙ Napojení webu" a zadej údaje, pak „⟳ Synchronizovat z webu".';
  } else {
    document.getElementById('sync-info').textContent =
      'Napojení uloženo ✓ — klikni „⟳ Synchronizovat z webu".';
  }
})();
