// server.js
// Node 20+ (CommonJS)
// Başlat: node server.js
// POST /login  -> body: { "email": "x", "sifre": "y", "profilId": "z" }

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const { chromium } = require('playwright-core'); // use system Chrome/Chromium
const hepsiburadaLogin = require('./hepsiburada-login'); // senin module.exports fonksiyonun

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Basit logger (senin log.kaydet ile benzer API)
const makeLogger = () => ({
  kaydet: async (profilId, mesaj) => {
    const t = new Date().toISOString();
    const line = `[${t}] [${profilId}] ${mesaj}`;
    console.log(line);
    try {
      fs.appendFileSync(path.join(process.cwd(), 'run.log'), line + '\n');
    } catch (e) { /* ignore */ }
  }
});

// Bulunabilecek Chrome/Chromium yolları (sıralı denenecek)
const DEFAULT_CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);

async function findExecutablePath() {
  for (const p of DEFAULT_CHROME_PATHS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) { /* ignore */ }
  }
  // son çare: let Playwright use bundled (but playwright-core won't have one).
  return null;
}

app.post('/login', async (req, res) => {
  const { email, sifre, profilId } = req.body || {};
  if (!email || !profilId) {
    return res.status(400).json({ basarili: false, hata: 'email ve profilId zorunlu' });
  }

  const log = makeLogger();
  await log.kaydet(profilId, `API isteği alındı. Email: ${email}`);

  const execPath = await findExecutablePath();
  if (!execPath) {
    const msg = 'Sistem Chrome/Chromium bulunamadı. CHROME_PATH ayarlayın veya Chrome yükleyin.';
    console.error(msg);
    await log.kaydet(profilId, msg);
    return res.status(500).json({ basarili: false, hata: msg });
  }

  let browser;
  try {
    await log.kaydet(profilId, `Chrome path: ${execPath} ile tarayıcı başlatılıyor...`);

    browser = await chromium.launch({
      headless: true, // CI ortamı için headless true. Lokal debug için false yapabilirsin.
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=tr-TR'
      ],
      env: {
        ...process.env
      }
    });

    const context = await browser.newContext({
      userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'tr-TR',
      timezoneId: 'Europe/Istanbul'
    });

    const page = await context.newPage();

    // call your module (it expects: { sayfa, log, profilId, email, sifre })
    // ensure we pass the Playwright page object
    const result = await hepsiburadaLogin({ sayfa: page, log, profilId, email, sifre });

    // cleanup
    try { await context.close(); } catch(e){/*ignore*/ }
    try { await browser.close(); } catch(e){/*ignore*/ }

    await log.kaydet(profilId, `İşlem tamamlandı. Sonuç: ${JSON.stringify(result).slice(0,200)}`);
    return res.json(result);
  } catch (err) {
    console.error('Login işleminde hata:', err);
    await log.kaydet(profilId, `Genel hata: ${err.message || String(err)}`);

    // ekran görüntüsü alma (eğer page mevcut ise)
    try {
      // if page exists in closure, attempt to screenshot
      // but we can't always access 'page' here if failure before creation
      // so we catch and ignore
      if (typeof page !== 'undefined' && page && page.screenshot) {
        const shotDir = path.join(process.cwd(), 'hata-screenshots');
        if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });
        const shotPath = path.join(shotDir, `hata-${profilId}-${Date.now()}.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
        await log.kaydet(profilId, `Hata screenshot: ${shotPath}`);
      }
    } catch (e) {
      console.error('Screenshot alınamadı:', e);
    }

    try { if (browser) await browser.close(); } catch(e){}

    return res.status(500).json({ basarili: false, hata: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server çalışıyor, POST /login (port ${PORT})`);
});
