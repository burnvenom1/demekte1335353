// index.js
const { chromium } = require('playwright-core');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

(async () => {
  const sessionSeed = randomUUID().slice(0, 8);
  const headless = (process.env.HEADLESS || 'true') === 'true';
  const screenshotName = `screenshot_${sessionSeed}.png`;

  // try common Chrome/Chromium paths on ubuntu runners
  const possiblePaths = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium'
  ].filter(Boolean);

  let executablePath = null;
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    } catch (e) {}
  }

  if (!executablePath) {
    console.warn('Sistem Chrome/Chromium bulunamadı. index.js içinde executablePath belirtin veya workflow\'da Chrome kurulum adımını kontrol edin.');
    process.exit(1);
  }

  console.log('Using Chrome executable:', executablePath);

  const browser = await chromium.launch({
    headless,
    executablePath,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,720'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul'
  });

  const page = await context.newPage();

  const target = 'https://giris.hepsiburada.com/'; // test URL
  console.log('Navigating to', target);
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.screenshot({ path: screenshotName, fullPage: false });
  console.log('Screenshot saved as', screenshotName);

  await browser.close();
})();
