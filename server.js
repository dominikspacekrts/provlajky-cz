// =====================================================================
// PROVLAJKY – local server: serves the static app + sends e-mails (SMTP)
//   Run:  npm install   then   npm start   (or: node server.js)
//   Open: http://localhost:8000
// =====================================================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

let nodemailer = null;
try { nodemailer = require('nodemailer'); }
catch { console.warn('⚠️  nodemailer není nainstalován – spusť `npm install`. Odesílání mailů nebude fungovat.'); }

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml', '.gif': 'image/gif', '.pdf': 'application/pdf',
  '.ico':  'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf':  'font/ttf', '.otf': 'font/otf',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

// ---- e-mail endpoint ----
async function handleSendEmail(req, res) {
  if (!nodemailer) return sendJson(res, 500, { ok: false, error: 'nodemailer není nainstalován (spusť npm install)' });

  let raw = '';
  req.on('data', chunk => { raw += chunk; if (raw.length > 60 * 1024 * 1024) req.destroy(); }); // 60MB cap
  req.on('end', async () => {
    let data;
    try { data = JSON.parse(raw); } catch { return sendJson(res, 400, { ok: false, error: 'Neplatné JSON' }); }

    const { smtp, to, cc, bcc, subject, html, attachments } = data;
    if (!smtp || !smtp.host || !smtp.user) return sendJson(res, 400, { ok: false, error: 'Chybí SMTP nastavení.' });
    if (!to) return sendJson(res, 400, { ok: false, error: 'Chybí příjemce (to).' });

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port) || 587,
        secure: !!smtp.secure,            // true = 465/SSL, false = 587/STARTTLS
        auth: { user: smtp.user, pass: smtp.pass },
      });

      // Attachments: [{ filename, contentBase64, contentType, cid }]
      const atts = (attachments || []).map(a => {
        const o = {
          filename: a.filename,
          content: Buffer.from(a.contentBase64, 'base64'),
          contentType: a.contentType || 'application/pdf',
        };
        if (a.cid) o.cid = a.cid;   // inline image referenced via cid:
        return o;
      });

      // Logo je vždy posíláno z aplikace (tmavé na bílém) jako inline příloha.
      // Server už žádné vlastní logo nepřilepuje, aby v mailu nebyla dvě.

      const fromName = smtp.fromName || 'PROVLAJKY';
      const fromAddr = smtp.from || smtp.user;

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromAddr}>`,
        to, cc: cc || undefined, bcc: bcc || undefined,
        subject: subject || '(bez předmětu)',
        html: html || '',
        attachments: atts,
      });
      console.log('✉️  Odesláno:', info.messageId, '→', to, cc ? '(cc ' + cc + ')' : '');
      sendJson(res, 200, { ok: true, messageId: info.messageId });
    } catch (e) {
      console.error('✉️  Chyba odeslání:', e.message);
      sendJson(res, 500, { ok: false, error: e.message });
    }
  });
}

// ---- SMTP connection test ----
async function handleTestSmtp(req, res) {
  if (!nodemailer) return sendJson(res, 500, { ok: false, error: 'nodemailer není nainstalován' });
  let raw = '';
  req.on('data', c => raw += c);
  req.on('end', async () => {
    let smtp;
    try { smtp = JSON.parse(raw).smtp; } catch { return sendJson(res, 400, { ok: false, error: 'Neplatné JSON' }); }
    try {
      const t = nodemailer.createTransport({
        host: smtp.host, port: Number(smtp.port) || 587,
        secure: !!smtp.secure, auth: { user: smtp.user, pass: smtp.pass },
      });
      await t.verify();
      sendJson(res, 200, { ok: true });
    } catch (e) { sendJson(res, 500, { ok: false, error: e.message }); }
  });
}

// ---- static file serving ----
function serveStatic(req, res, pathname) {
  let filePath = path.join(ROOT, decodeURIComponent(pathname));
  if (pathname === '/' || pathname === '') filePath = path.join(ROOT, 'index.html');
  // prevent path traversal
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---- Exchange rate (ČNB official daily fixing) -------------------------
// GET /api/exchange-rate?date=YYYY-MM-DD&currency=EUR
// Returns { ok, rate, amount, currency, date, source }. The ČNB daily rate is
// the official rate used for converting foreign invoices in CZ accounting.
function handleExchangeRate(req, res, query) {
  const q = require('querystring').parse(query || '');
  const currency = (q.currency || 'EUR').toUpperCase();
  // date YYYY-MM-DD → DD.MM.YYYY for ČNB
  let cnbDate = '';
  if (q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date)) {
    const [y, m, d] = q.date.split('-');
    cnbDate = `${d}.${m}.${y}`;
  }
  const cnbUrl = 'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/'
    + 'kurzy-devizoveho-trhu/denni_kurz.txt' + (cnbDate ? ('?date=' + encodeURIComponent(cnbDate)) : '');
  https.get(cnbUrl, (r) => {
    let data = '';
    r.on('data', c => data += c);
    r.on('end', () => {
      try {
        const lines = data.trim().split('\n');
        const header = lines[0] || '';                 // "17.06.2026 #115"
        const effDate = (header.split(' ')[0] || '').trim();
        let found = null;
        for (const line of lines) {
          const parts = line.split('|');               // země|měna|množství|kód|kurz
          if (parts.length === 5 && parts[3].trim() === currency) {
            const amount = parseInt(parts[2], 10) || 1;
            const rate = parseFloat(parts[4].replace(',', '.'));
            found = { amount, rate };
            break;
          }
        }
        if (!found) throw new Error('Měna ' + currency + ' nenalezena.');
        sendJson(res, 200, {
          ok: true, currency, amount: found.amount, rate: found.rate,
          // rate per 1 unit of currency
          perUnit: found.rate / found.amount,
          date: effDate, source: 'ČNB',
        });
      } catch (e) {
        sendJson(res, 502, { ok: false, error: e.message });
      }
    });
  }).on('error', (e) => sendJson(res, 502, { ok: false, error: e.message }));
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;
  if (req.method === 'POST' && pathname === '/api/send-email') return handleSendEmail(req, res);
  if (req.method === 'POST' && pathname === '/api/test-smtp')  return handleTestSmtp(req, res);
  if (req.method === 'GET'  && pathname === '/api/exchange-rate') return handleExchangeRate(req, res, parsed.query);
  serveStatic(req, res, pathname);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} je obsazený jiným serverem (nejspíš starý python/node).`);
    console.error(`   Ukonči ho a spusť launcher znovu, nebo v Terminálu:`);
    console.error(`   lsof -ti tcp:${PORT} | xargs kill -9\n`);
  } else {
    console.error('Chyba serveru:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\n  PROVLAJKY běží na  http://localhost:${PORT}\n`);
  if (!nodemailer) console.log('  (Pro odesílání mailů spusť: npm install)\n');
});
