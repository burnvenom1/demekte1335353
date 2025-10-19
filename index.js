/*
  index.js
  Node 20+ (ESM) with Playwright-core + system Chrome.
  Includes cookie handling, tempmail flows, login attempts, detailed logging.
  Spoofing placeholders are intentionally EMPTY. Add your approved spoofing scripts to the addInitScript points.
*/

import { chromium } from 'playwright-core';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const __dirname = path.resolve();

// ---------- CONFIG (env or defaults) ----------
const HEADLESS = (process.env.HEADLESS || 'false') === 'true';
const EMAIL = process.env.EMAIL || 'deneme@example.com';
const PASSWORD = process.env.PASSWORD || '';
const PROFILE_ID = process.env.PROFILE_ID || 'local-profile';

// Drive / AppsScript / fakemail config
const API_KEY = process.env.DRIVE_API_KEY || '';
const KLASOR_ID = process.env.DRIVE_FOLDER_ID || '';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
const FAKEMAIL_BASE_URL = process.env.FAKEMAIL_BASE_URL || 'https://tempmail.plus';

// Output dirs
const OUTPUT_DIR = path.join(__dirname, 'ciktilar');
const HATA_DIR = path.join(__dirname, 'hata-screenshots');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(HATA_DIR)) fs.mkdirSync(HATA_DIR, { recursive: true });

// Simple logger
const log = {
  async kaydet(profilId, mesaj) {
    const t = new Date().toISOString();
    const line = `[${t}] [${profilId}] ${mesaj}`;
    console.log(line);
    try {
      fs.appendFileSync(path.join(__dirname, 'run.log'), line + '\n');
    } catch (e) {
      // ignore
    }
  }
};

// Spoofing placeholders (INTENTIONALLY EMPTY — add only approved scripts in your environment)
function getWebGLSpoofScript(seed) { return ''; }
function getCanvasSpoofScript(seed) { return ''; }
function getAudioContextSpoofScript(seed) { return ''; }
function getHardwareInfoSpoofScript(seed) { return ''; }
function getWebdriverSpoofScript() { return ''; }
function getPluginAndPermissionsSpoofScript() { return ''; }

// Helper lists
const yayginMailDomainleri = ['gmail.com','hotmail.com','yahoo.com','outlook.com','icloud.com'];
const geciciMailDomainleri = ['tempmail','mailinator','maildrop','10minutemail','mailto.plus'];

function yayginMailMi(email) {
  if (!email || !email.includes('@')) return false;
  return yayginMailDomainleri.some(d => email.toLowerCase().endsWith(d));
}
function geciciMailMi(email) {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1].toLowerCase();
  return geciciMailDomainleri.some(s => domain.includes(s));
}
function fakemailMi(email) {
  if (!email || !email.includes('@')) return false;
  return !yayginMailMi(email) && !geciciMailMi(email);
}

// Drive: download cookies JSON by email filename
async function driveCookiesIndir(email) {
  if (!API_KEY || !KLASOR_ID) {
    console.warn('driveCookiesIndir: API_KEY or KLASOR_ID missing — skipping');
    return null;
  }
  const DOSYA_ADI = `${email}.json`;
  const q = encodeURIComponent(`'${KLASOR_ID}' in parents and name='${DOSYA_ADI}' and trashed=false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&key=${API_KEY}`;

  const res = await fetch(searchUrl);
  if (!res.ok) throw new Error(`Drive search failed: ${res.status}`);
  const data = await res.json();
  if (!data.files || data.files.length === 0) return null;

  data.files.sort((a,b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
  const file = data.files[0];
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`;
  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) throw new Error(`Drive file download failed: ${fileRes.status}`);
  return await fileRes.json();
}

async function cerezleriGoogleDriveKaydet(email, cookies) {
  if (!APPS_SCRIPT_URL) {
    console.warn('cerezleriGoogleDriveKaydet: APPS_SCRIPT_URL missing — skipping save');
    return false;
  }
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'saveCookies', email, cookies })
  });
  if (!res.ok) throw new Error(`AppsScript error: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'AppsScript save failed');
  return true;
}

async function cerezleriYukleVeDogrula(page, email) {
  const cookiesData = await driveCookiesIndir(email);
  if (!cookiesData || !Array.isArray(cookiesData)) {
    throw new Error('driveCookiesIndir: no cookies found for email');
  }

  const duzenlenmisCookies = cookiesData.map(cookie => ({
    ...cookie,
    domain: cookie.domain || '.hepsiburada.com',
    path: cookie.path || '/',
    secure: cookie.secure !== undefined ? cookie.secure : true,
    httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : true,
    sameSite: cookie.sameSite || 'Lax'
  }));

  await page.context().clearCookies();
  await page.context().addCookies(duzenlenmisCookies);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  return true;
}

// tempmail.plus API helpers
async function mailListesiAl(email) {
  const apiUrl = `https://tempmail.plus/api/mails?email=${encodeURIComponent(email)}&limit=10&epin=`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`mailListesiAl failed: ${res.status}`);
  const json = await res.json();
  return json.mail_list || [];
}

async function mailDetayAl(mailId, email) {
  const apiUrl = `https://tempmail.plus/api/mails/${encodeURIComponent(mailId)}?email=${encodeURIComponent(email)}&epin=`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`mailDetayAl failed: ${res.status}`);
  return await res.json();
}

async function mailSil(mailId, email) {
  const apiUrl = `https://tempmail.plus/api/mails/${encodeURIComponent(mailId)}?email=${encodeURIComponent(email)}&epin=`;
  const res = await fetch(apiUrl, { method: 'DELETE' });
  if (!res.ok) throw new Error(`mailSil failed: ${res.status}`);
  return true;
}

async function maildenGirisLinkiAlVeSil(email, timeoutMs = 60000) {
  const baslangic = Date.now();
  const kontrolEdilenler = new Set();
  let sonBasariliListeleme = 0;

  while (Date.now() - baslangic < timeoutMs) {
    const simdi = Date.now();
    if (simdi - sonBasariliListeleme < 3000) {
      await new Promise(r => setTimeout(r, 3000 - (simdi - sonBasariliListeleme)));
    }

    const mailler = await mailListesiAl(email).catch(() => []);
    sonBasariliListeleme = Date.now();

    for (const mail of mailler) {
      if (kontrolEdilenler.has(mail.mail_id)) continue;
      kontrolEdilenler.add(mail.mail_id);

      await new Promise(r => setTimeout(r, 1500));
      const detay = await mailDetayAl(mail.mail_id, email).catch(() => null);
      if (!detay) continue;

      let icerik = detay.text || '';
      if (!icerik.includes(email)) continue;

      if (detay.subject && detay.subject.includes('Tek seferlik giriş') && !icerik.includes('tek-seferlik-giris')) {
        icerik = detay.html || icerik;
      }

      if (!/tek.?seferlik.?giri[sş]/i.test(icerik)) continue;

      const linkRegex = /https?:\/\/[^\s"]*hepsiburada[^\s"]*\/uyelik\/tek-seferlik-giri[sş]\/[A-Za-z0-9\-_]+/gi;
      const matches = icerik.match(linkRegex);
      if (matches && matches.length > 0) {
        const link = matches.reduce((a, b) => a.length > b.length ? a : b);
        await mailSil(mail.mail_id, email).catch(() => {});
        kontrolEdilenler.clear();
        return link;
      }
    }
  }

  kontrolEdilenler.clear();
  throw new Error("1 dakikada uygun mail bulunamadı");
}

// Page/site checks
async function hepsiburadaGirisSayfasinaGit(page) {
  const girisUrl = 'https://giris.hepsiburada.com/?ReturnUrl=https%3A%2F%2Foauth.hepsiburada.com%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3DSPA%26redirect_uri%3Dhttps%253A%252F%252Fwww.hepsiburada.com%252Fuyelik%252Fcallback%26response_type%3Dcode%26scope%3Dopenid%2520profile%26state%3Df883eaadc71d42c8bfe3aa90bc07585a%26code_challenge%3DI4Ihs_2x7BPCMgYoGd7YrazWUqIYgxTzIGMQVovpJfg%26code_challenge_method%3DS256%26response_mode%3Dquery%26customizeSegment%3DORDERS%26ActivePage%3DPURE_LOGIN%26oidcReturnUrl%3D%252Fsiparislerim';
  await page.goto(girisUrl, { waitUntil: 'networkidle', timeout: 30000 });
  try {
    await page.waitForSelector('text=Sipariş takibi', { timeout: 15000 });
    await log.kaydet('system', 'Giriş sayfası yüklendi: "Sipariş takibi" bulundu');
  } catch (e) {
    throw new Error('"Sipariş takibi" bulunamadı veya sayfa yüklenemedi');
  }
}

async function oturumKontroluYap(page, email, logger, profilId) {
  const result = { basarili: false, kullanilanYontem: '', hatalar: [] };
  await logger.kaydet(profilId, 'Oturum kontrolü başlatılıyor (hesap bilgileri sayfası)...');

  try {
    await page.goto('https://hesabim.hepsiburada.com/uyelik-bilgilerim', { waitUntil: 'networkidle', timeout: 10000 });
    await logger.kaydet(profilId, 'Hesap bilgileri sayfası açıldı');
  } catch (e) {
    result.hatalar.push(`Hesap sayfası açılamadı: ${e.message}`);
    await logger.kaydet(profilId, `HATA: Hesap sayfası açılamadı - ${e.message}`);
    return result;
  }

  const [prefix, domain] = (email || '').split('@');
  const beklenenMaskeli = prefix ? `${prefix[0]}***${prefix.slice(-1)}@${domain}` : null;
  await logger.kaydet(profilId, `Beklenen maskeli: ${beklenenMaskeli}`);

  try {
    const emailInput = await page.locator('input[name="EmailMasked"]');
    const inputDegeri = emailInput ? await emailInput.inputValue() : null;
    await logger.kaydet(profilId, `[Email Input] Bulunan değer: ${inputDegeri}`);
    if (inputDegeri === beklenenMaskeli) {
      result.basarili = true;
      result.kullanilanYontem = 'Email Input Değeri Kontrolü';
      await logger.kaydet(profilId, 'BAŞARILI: Oturum Email Input Değeri Kontrolü ile doğrulandı');
      return result;
    } else {
      throw new Error(`Maskeli email uyuşmuyor. Beklenen: ${beklenenMaskeli}, Bulunan: ${inputDegeri}`);
    }
  } catch (error) {
    result.hatalar.push(`Email Input Değeri Kontrolü hatası: ${error.message}`);
    await logger.kaydet(profilId, `Yöntem başarısız: Email Input Değeri Kontrolü - ${error.message}`);
  }

  try {
    const sayfaMetni = await page.content();
    if (sayfaMetni.includes(beklenenMaskeli)) {
      result.basarili = true;
      result.kullanilanYontem = 'Sayfa Metni Taraması';
      await logger.kaydet(profilId, 'BAŞARILI: Oturum Sayfa Metni Taraması ile doğrulandı');
      return result;
    } else {
      throw new Error('Maskeli email sayfa metninde bulunamadı');
    }
  } catch (error) {
    result.hatalar.push(`Sayfa Metni Taraması hatası: ${error.message}`);
    await logger.kaydet(profilId, `Yöntem başarısız: Sayfa Metni Taraması - ${error.message}`);
  }

  result.hatalar.push('Hiçbir yöntemle oturum doğrulanamadı');
  await logger.kaydet(profilId, 'Tüm yöntemler başarısız oldu');
  return result;
}

// Main exported module
export default async function({ sayfa, log: logger = log, profilId = PROFILE_ID, email = EMAIL, sifre = PASSWORD }) {
  const sonuc = { basarili: false, hatalar: [], ekstraBilgiler: [] };

  try {
    await logger.kaydet(profilId, `İşlem başlatıldı: ${email}`);

    // 1) Go to login page
    await hepsiburadaGirisSayfasinaGit(sayfa);

    // 2) Try cookies
    try {
      await logger.kaydet(profilId, 'Kayıtlı çerez ile giriş deneniyor...');
      if (await cerezleriYukleVeDogrula(sayfa, email)) {
        const oturum = await oturumKontroluYap(sayfa, email, logger, profilId);
        sonuc.basarili = oturum.basarili;
        if (sonuc.basarili) {
          await logger.kaydet(profilId, 'Çerez ile oturum doğrulandı');
          sonuc.ekstraBilgiler.push('Giriş yöntemi: Kayıtlı çerezler');
          return sonuc;
        }
      }
    } catch (e) {
      await logger.kaydet(profilId, `Çerez yükleme sırasında hata: ${e.message}`);
    }

    // 3) Password-based login (masked email flow)
    try {
      await logger.kaydet(profilId, 'Şifre ile giriş denemesi kontrol ediliyor...');
      const farkliHesap = await sayfa.getByText('Farklı hesap kullan').first().catch(()=>null);
      const maskeliInput = await sayfa.locator('input[name="EmailMasked"]').first().catch(()=>null);

      if (farkliHesap && maskeliInput) {
        await logger.kaydet(profilId, '"Farklı hesap kullan" ve maskeli input bulundu, şifre ile giriş deneniyor');
        await sayfa.waitForSelector('#txtPassword', { state: 'visible', timeout: 5000 });
        await sayfa.fill('#txtPassword', sifre || '');
        await logger.kaydet(profilId, 'Şifre alanı ID ile bulundu ve dolduruldu');
        await sayfa.waitForTimeout(1000);
        await sayfa.locator('button:has-text("Giriş yap")').click();
        await sayfa.waitForTimeout(3000);
        await sayfa.waitForLoadState('networkidle', { timeout: 3000 });

        const oturum = await oturumKontroluYap(sayfa, email, logger, profilId);
        sonuc.basarili = oturum.basarili;
        if (sonuc.basarili) {
          await logger.kaydet(profilId, 'Şifre ile giriş başarılı, çerezler kaydediliyor');
          const cookies = await sayfa.context().cookies();
          await cerezleriGoogleDriveKaydet(email, cookies).catch(err => logger.kaydet(profilId, `Çerez kaydetme uyarısı: ${err.message}`));
          sonuc.ekstraBilgiler.push('Giriş yöntemi: Şifre ile giriş');
          return sonuc;
        }
      }
    } catch (hata) {
      await logger.kaydet(profilId, `Şifre ile giriş denemesi başarısız: ${hata.message}`);
      sonuc.hatalar.push(`Şifre ile giriş hatası: ${hata.message}`);
    }

    // 4) Temp/fake mail -> one-time link
    if (geciciMailMi(email) || fakemailMi(email)) {
      await logger.kaydet(profilId, 'Geçici e-posta/fakemail domaini - tek seferlik link yöntemi deneniyor');
      await sayfa.context().clearCookies();
      await logger.kaydet(profilId, 'Çerezler temizlendi');
      await hepsiburadaGirisSayfasinaGit(sayfa);

      try {
        const tekSeferlikLink = await maildenGirisLinkiAlVeSil(email);
        if (!tekSeferlikLink) throw new Error('Fakemail linki alınamadı');

        await logger.kaydet(profilId, `Tek seferlik giriş linki bulundu: ${tekSeferlikLink}`);
        await sayfa.goto(tekSeferlikLink, { waitUntil: 'networkidle', timeout: 30000 });
        await sayfa.waitForTimeout(3000);

        const oturum = await oturumKontroluYap(sayfa, email, logger, profilId);
        sonuc.basarili = oturum.basarili;
        if (sonuc.basarili) {
          await logger.kaydet(profilId, 'Fakemail/tempmail ile giriş başarılı, çerezler kaydediliyor');
          const cookies = await sayfa.context().cookies();
          await cerezleriGoogleDriveKaydet(email, cookies).catch(err => logger.kaydet(profilId, `Çerez kaydetme uyarısı: ${err.message}`));
          sonuc.ekstraBilgiler.push('Giriş yöntemi: Tek seferlik link (tempmail/fakemail)');
          return sonuc;
        } else {
          throw new Error('Tek seferlik link sonrası oturum doğrulanamadı');
        }
      } catch (e) {
        await logger.kaydet(profilId, `Tek seferlik link yöntemi başarısız: ${e.message}`);
        sonuc.hatalar.push(`Fakemail/tempmail hatası: ${e.message}`);
      }
    } else if (yayginMailMi(email)) {
      throw new Error('Yaygın mail domaini için çerezlerle giriş başarısız oldu - alternatif yok');
    }

    if (!sonuc.basarili) {
      throw new Error('Hesap doğrulanamadı: Hiçbir yöntem başarılı olmadı');
    }

  } catch (err) {
    sonuc.hatalar.push(err.message || String(err));
    await logger.kaydet(profilId, `Genel hata: ${err.message || err}`);
    try {
      if (typeof sayfa?.screenshot === 'function') {
        const shotPath = path.join(HATA_DIR, `hata-${profilId}-${Date.now()}.png`);
        await sayfa.screenshot({ path: shotPath, fullPage: false });
        sonuc.ekstraBilgiler.push(`Hata screenshot: ${shotPath}`);
      }
    } catch (e) {
      await logger.kaydet(profilId, `Screenshot alınamadı: ${e.message}`);
    }
  }

  return sonuc;
}

// Direct CLI run
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  (async () => {
    const chromePathCandidates = [
      process.env.CHROME_PATH,
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ].filter(Boolean);

    const execPath = chromePathCandidates.find(p => fs.existsSync(p));
    if (!execPath) {
      console.error('Chrome/Chromium not found. Set CHROME_PATH or install it.');
      process.exit(1);
    }

    const browser = await chromium.launch({
      headless: HEADLESS,
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=tr-TR',
        '--disable-web-security'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'tr-TR',
      timezoneId: 'Europe/Istanbul',
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // Add approved spoofing scripts here if you have them and permission (currently empty)
    const seed = randomUUID().slice(0,8);
    const webglScript = getWebGLSpoofScript(seed);
    const canvasScript = getCanvasSpoofScript(seed);
    const audioScript = getAudioContextSpoofScript(seed);
    const hardwareScript = getHardwareInfoSpoofScript(seed);
    const webdriverScript = getWebdriverSpoofScript();
    const pluginsScript = getPluginAndPermissionsSpoofScript();

    if (webglScript) await page.addInitScript(webglScript);
    if (canvasScript) await page.addInitScript(canvasScript);
    if (audioScript) await page.addInitScript(audioScript);
    if (hardwareScript) await page.addInitScript(hardwareScript);
    if (webdriverScript) await page.addInitScript(webdriverScript);
    if (pluginsScript) await page.addInitScript(pluginsScript);

    try {
      const result = await module.exports?.default
        ? await (await import('./index.js')).default({ sayfa: page, log, profilId: PROFILE_ID, email: EMAIL, sifre: PASSWORD })
        : await (await import('./index.js')).default?.({ sayfa: page, log, profilId: PROFILE_ID, email: EMAIL, sifre: PASSWORD })
        ;
      // If module import style fails, call main directly
      // But our file exports default main; we call main above via import path to allow ESM invocation.
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (e) {
      // Fallback: call the function declared above
      try {
        const result2 = await (await import('file://' + path.join(process.cwd(), 'index.js'))).default({ sayfa: page, log, profilId: PROFILE_ID, email: EMAIL, sifre: PASSWORD });
        console.log('Result2:', JSON.stringify(result2, null, 2));
      } catch (e2) {
        console.error('Runtime error:', e2);
      }
    } finally {
      await browser.close();
    }
  })();
}
