// index.js
// Playwright-core + system Chromium: ziyaret et, screenshot al, basit rapor kaydet.

const { chromium } = require('playwright-core');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

// CONFIG
const headlessMode = (process.env.HEADLESS || 'true') === 'true';
const emailToSend = process.env.EMAIL_TO_SEND || 'deneme@example.com';
const outputDir = path.join(__dirname, 'ciktilar');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Session seed ve User-Agent
const sessionSeed = randomUUID().slice(0, 8);
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// --- Spoofing placeholders (izinli testte ekleyebilirsin) ---
function getWebGLSpoofScript(seed) { return `/* WebGL spoof placeholder */`; }
function getCanvasSpoofScript(seed) { return `/* Canvas spoof placeholder */`; }
function getAudioContextSpoofScript(seed) { return `/* Audio spoof placeholder */`; }
function getHardwareInfoSpoofScript(seed) { return `/* Hardware spoof placeholder */`; }
function getWebdriverSpoofScript() { return `/* Webdriver spoof placeholder */`; }
function getPluginAndPermissionsSpoofScript() { return `/* Plugin/Permissions spoof placeholder */`; }

// helper: find system chrome
function findSystemChrome() {
  const possible = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium'
  ].filter(Boolean);
  for (const p of possible) {
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return null;
}

(async () => {
  let browser;
  try {
    const executablePath = findSystemChrome();
    if (!executablePath) {
      console.error('Sistem Chrome/Chromium bulunamadı. Workflow içinde Chrome kurulum adımını kontrol et veya CHROME_PATH env ayarla.');
      process.exit(1);
    }
    console.log('Using Chrome executable:', executablePath);

    browser = await chromium.launch({
      headless: headlessMode,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
    });

    const context = await browser.newContext({
      userAgent,
      viewport: { width: 1280, height: 720 },
      locale: 'tr-TR',
      timezoneId: 'Europe/Istanbul'
    });

    const page = await context.newPage();

    // init scripts (placeholders) — izinliyse gerçek kodu buraya ekleyebilirsin
    await page.addInitScript(getWebGLSpoofScript(sessionSeed));
    await page.addInitScript(getHardwareInfoSpoofScript(sessionSeed));
    await page.addInitScript(getWebdriverSpoofScript());
    await page.addInitScript(getCanvasSpoofScript(sessionSeed));
    await page.addInitScript(getAudioContextSpoofScript(sessionSeed));
    await page.addInitScript(getPluginAndPermissionsSpoofScript());

    // Test hedefi
    const target = 'https://giris.hepsiburada.com/';
    console.log('Navigating to', target);
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Form test: e-posta doldur ve submit (selector'lar siteye göre uyarlanmalı)
    try {
      await page.fill('input[type="email"], input[name="email"], input[id*="email"]', emailToSend);
      await page.click('button[type="submit"], button[id*="login"], button[class*="submit"]');
    } catch (e) {
      console.log('Form alanı bulunamadı veya gönderme başarısız:', e.message);
    }

    // Screenshot
    const screenshotPath = path.join(outputDir, `hepsiburada_${sessionSeed}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('Screenshot kaydedildi:', screenshotPath);

    // Basit rapor: sayfadan bazı özellikleri oku (diagnostic)
    const diag = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        webdriver: typeof navigator.webdriver !== 'undefined' ? navigator.webdriver : null,
        languages: navigator.languages,
        pluginsLength: (navigator.plugins && navigator.plugins.length) ? navigator.plugins.length : 0
      };
    });
    fs.writeFileSync(path.join(outputDir, `report_${sessionSeed}.json`), JSON.stringify({ diag, sessionSeed, timestamp: new Date().toISOString() }, null, 2));

    console.log('Rapor kaydedildi:', path.join(outputDir, `report_${sessionSeed}.json`));

    await browser.close();
    console.log('Tamamlandı!');
  } catch (err) {
    console.error('Hata:', err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
