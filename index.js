const { chromium } = require('playwright');
const { randomUUID } = require('crypto');

(async () => {
  const sessionSeed = randomUUID().slice(0,8);
  const browser = await chromium.launch({
    headless: (process.env.HEADLESS || 'true') === 'true',
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });

  const page = await context.newPage();

  // Test URL
  const target = 'https://giris.hepsiburada.com/';
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Basit screenshot
  await page.screenshot({ path: `hepsiburada_test_${sessionSeed}.png` });

  console.log('Sayfa açıldı, ekran görüntüsü kaydedildi:', `hepsiburada_test_${sessionSeed}.png`);

  await browser.close();
})();
