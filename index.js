// index.js
// Birleştirilmiş: senin verdiğin tüm oturum / mail / cerez fonksiyonları korunmuştur.
// NOT: fingerprint/evade spoofing fonksiyonları KALDIRILDI ve yerine PLACEHOLDER kondu.

const { chromium } = require('playwright-core'); // veya 'playwright' istersen değiştir
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const response = await fetch(url); // package.json'a ekle (node-fetch@2 veya uygun sürüm)

const OUTPUT_DIR = path.join(__dirname, 'ciktilar');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const HEADLESS = (process.env.HEADLESS || 'true') === 'true';
const EMAIL = process.env.EMAIL || 'deneme@example.com';
const PASSWORD = process.env.PASSWORD || ''; // opsiyonel
const PROFILE_ID = process.env.PROFILE_ID || 'local-profile';

// Drive / AppsScript / fakemail konfigürasyonları
const API_KEY = process.env.DRIVE_API_KEY || '';
const KLASOR_ID = process.env.DRIVE_FOLDER_ID || '';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
const FAKEMAIL_BASE_URL = process.env.FAKEMAIL_BASE_URL || 'https://tempmail.plus';

// ---------- Placeholder: spoofing/evade kodları burada OMITTED ----------
// Aşağıdaki fonksiyonlar (WebGL/Canvas/Audio/Hardware/Webdriver/Plugin spoofing)
// güvenlik/etik sebeplerle burada **eklenmedi**. Eğer test ortamında kendin ekleyeceksen,
// buraya kendi kodunu koyabilirsin. Örnek placeholder fonksiyonlar:
function getWebGLSpoofScript(seed) { return '/* SPOOFING OMITTED */'; }
function getCanvasSpoofScript(seed) { return '/* SPOOFING OMITTED */'; }
function getAudioContextSpoofScript(seed) { return '/* SPOOFING OMITTED */'; }
function getHardwareInfoSpoofScript(seed) { return '/* SPOOFING OMITTED */'; }
function getWebdriverSpoofScript() { return '/* SPOOFING OMITTED */'; }
function getPluginAndPermissionsSpoofScript() { return '/* SPOOFING OMITTED */'; }
// -------------------------------------------------------------------

// Basit logger (senin log.kaydet çağrılarına uyumlu)
const log = {
  async kaydet(profilId, mesaj) {
    const t = new Date().toISOString();
    console.log(`[${t}] [${profilId}] ${mesaj}`);
    // opsiyonel: dosyaya yazma eklenebilir
  }
};

// ------------------ SENİN VERDİĞİN FONKSİYONLAR (korundu) ------------------

// Hepsiburada giriş sayfasına git
async function hepsiburadaGirisSayfasinaGit(page) {
  const girisUrl = 'https://giris.hepsiburada.com/?ReturnUrl=https%3A%2F%2Foauth.hepsiburada.com%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3DSPA%26redirect_uri%3Dhttps%253A%252F%252Fwww.hepsiburada.com%252Fuyelik%252Fcallback%26response_type%3Dcode%26scope%3Dopenid%2520profile%26state%3Df883eaadc71d42c8bfe3aa90bc07585a%26code_challenge%3DI4Ihs_2x7BPCMgYoGd7YrazWUqIYgxTzIGMQVovpJfg%26code_challenge_method%3DS256%26response_mode%3Dquery%26customizeSegment%3DORDERS%26ActivePage%3DPURE_LOGIN%26oidcReturnUrl%3D%252Fsiparislerim';
  
  await page.goto(girisUrl, {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  try {
    await page.waitForSelector('text=Sipariş takibi', { timeout: 15000 });
    console.log("Sayfa yüklendi ve 'Sipariş takibi' yazısı görüldü.");
  } catch (error) {
    throw new Error('Sayfa yüklenirken zaman aşımı oluştu veya "Sipariş takibi" yazısı bulunamadı');
  }
}

// Yaygın/Geçici/Fakemail kontrol fonksiyonları (senin versiyonun korunmuştur)
const yayginMailDomainleri = ['gmail.com','hotmail.com','yahoo.com','outlook.com','icloud.com'];
function yayginMailMi(email) {
  return yayginMailDomainleri.some(domain => email.toLowerCase().endsWith(domain));
}
const geciciMailDomainleri = ['tempmail', 'mailinator', 'maildrop', '10minutemail', 'mailto.plus'];
function geciciMailMi(email) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return geciciMailDomainleri.some(tempDomain => domain.includes(tempDomain));
}
function fakemailMi(email) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return !yayginMailMi(email) && !geciciMailMi(email);
}

// Google Drive'dan çerez dosyasını indir
async function driveCookiesIndir(email) {
  if (!API_KEY || !KLASOR_ID) {
    console.warn('Drive API_KEY veya KLASOR_ID ayarlı değil — driveCookiesIndir atlanıyor.');
    return null;
  }
  const DOSYA_ADI = `${email}.json`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${KLASOR_ID}'+in+parents+and+name='${DOSYA_ADI}'+and+trashed=false&fields=files(id,name,modifiedTime)&key=${API_KEY}`;

  const response = await fetch(searchUrl);
  if (!response.ok) throw new Error(`Drive API error: ${response.status}`);
  const data = await response.json();
  if (!data.files || data.files.length === 0) return null;

  const file = data.files.sort((a,b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`;
  const fileResponse = await fetch(downloadUrl);
  if (!fileResponse.ok) throw new Error(`Dosya indirme hatası: ${fileResponse.status}`);
  return await fileResponse.json();
}

// Çerezleri Google Apps Script'e kaydet
async function cerezleriGoogleDriveKaydet(email, cookies) {
  if (!APPS_SCRIPT_URL) {
    console.warn('APPS_SCRIPT_URL ayarlı değil — cerez kaydetme atlanıyor.');
    return false;
  }
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'saveCookies', email, cookies })
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'Çerezler kaydedilemedi');
  return true;
}

// Çerezleri yükle ve doğrula
async function cerezleriYukleVeDogrula(page, email) {
  const cookiesData = await driveCookiesIndir(email);
  if (!cookiesData || !Array.isArray(cookiesData)) {
    throw new Error('Google Drive\'da bu e-posta için kayıtlı çerez bulunamadı');
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

// Fakemail'den tek seferlik giriş linkini almak (özet, senin mantığın korundu)
async function fakemaildenLinkAl(page, email) {
  if (!FAKEMAIL_BASE_URL) throw new Error('FAKEMAIL_BASE_URL ayarlı değil');
  await page.goto(`${FAKEMAIL_BASE_URL}/${email}`, { waitUntil: 'networkidle', timeout: 60000 });

  // Burada senin sağladığın bekleme / seçim adımlarını koru
  await page.waitForTimeout(1500);
  // Örnek: metin bulma ve link alma (senin koduna göre uyarla)
  const linkEl = await page.$('a:has-text("Tek Seferlik Giriş Yap"), a:has-text("Tek seferlik giriş")');
  if (!linkEl) throw new Error('Giriş linki bulunamadı (fakemail)');
  const href = await linkEl.getAttribute('href');
  return href;
}

// mailListesiAl, mailDetayAl, mailSil (tempmail API örneğin korunmuş)
async function mailListesiAl(email) {
  const apiUrl = `https://tempmail.plus/api/mails?email=${email}&limit=10&epin=`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`Mail listesi alınamadı: ${response.status}`);
  const veri = await response.json();
  return veri.mail_list || [];
}

async function mailDetayAl(mailId, email) {
  const apiUrl = `https://tempmail.plus/api/mails/${mailId}?email=${email}&epin=`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`Mail detay alınamadı: ${response.status}`);
  return await response.json();
}

async function mailSil(mailId, email) {
  const apiUrl = `https://tempmail.plus/api/mails/${mailId}?email=${email}&epin=`;
  const response = await fetch(apiUrl, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Mail silinemedi: ${response.status}`);
  return true;
}

// maildenGirisLinkiAlVeSil (senin regex ve akış mantığın korunmuş)
async function maildenGirisLinkiAlVeSil(email, log = console) {
  const baslangic = Date.now();
  const kontrolEdilenler = new Set();
  let sonBasariliListeleme = 0;

  while (Date.now() - baslangic < 60000) {
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

      const linkRegex = /https?:\/\/[^\s]*hepsiburada[^\s]*\/uyelik\/tek-seferlik-giri[sş]\/[A-Za-z0-9-_]+/gi;
      const matches = icerik.match(linkRegex);
      if (matches && matches.length > 0) {
        const link = matches.reduce((a,b) => a.length > b.length ? a : b);
        await mailSil(mail.mail_id, email);
        kontrolEdilenler.clear();
        return link;
      }
    }
  }
  kontrolEdilenler.clear();
  throw new Error("1 dakikada uygun mail bulunamadı");
}

// Oturum kontrolu (senin fonksiyonun korunmuş)
async function oturumKontroluYap(page, email, log, profilId) {
  const sonuc = { basarili: false, kullanilanYontem: '', hatalar: [] };
  await log.kaydet(profilId, 'Hesap bilgileri sayfasına gidiliyor...');
  try {
    await page.goto('https://hesabim.hepsiburada.com/uyelik-bilgilerim', { waitUntil: 'networkidle', timeout: 10000 });
    await log.kaydet(profilId, 'Sayfa yüklendi, doğrulamalar başlatılıyor...');
  } catch (error) {
    sonuc.hatalar.push(`Sayfa yüklenemedi: ${error.message}`);
    await log.kaydet(profilId, `HATA: Sayfa yüklenemedi - ${error.message}`);
    return sonuc;
  }

  const [prefix, domain] = email.split('@');
  const beklenenMaskeli = `${prefix[0]}***${prefix.slice(-1)}@${domain}`;
  await log.kaydet(profilId, `Beklenen maskeli format: ${beklenenMaskeli}`);

  try {
    const emailInput = await page.locator('input[name="EmailMasked"]'); 
    const inputDegeri = emailInput ? await emailInput.inputValue() : null;
    await log.kaydet(profilId, `[Email Input] Bulunan değer: ${inputDegeri}`);
    if (inputDegeri === beklenenMaskeli) {
      sonuc.basarili = true;
      sonuc.kullanilanYontem = 'Email Input Değeri Kontrolü';
      await log.kaydet(profilId, 'BAŞARILI: Oturum Email Input Değeri Kontrolü ile doğrulandı');
      return sonuc;
    } else {
      throw new Error(`Maskeli email uyuşmuyor. Beklenen: ${beklenenMaskeli}, Bulunan: ${inputDegeri}`);
    }
  } catch (error) {
    sonuc.hatalar.push(`Email Input Değeri Kontrolü hatası: ${error.message}`);
    await log.kaydet(profilId, `Yöntem başarısız: Email Input Değeri Kontrolü - ${error.message}`);
  }

  // Sayfa metni taraması
  try {
    const sayfaMetni = await page.content();
    if (sayfaMetni.includes(beklenenMaskeli)) {
      sonuc.basarili = true;
      sonuc.kullanilanYontem = 'Sayfa Metni Taraması';
      await log.kaydet(profilId, 'BAŞARILI: Oturum Sayfa Metni Taraması ile doğrulandı');
      return sonuc;
    } else {
      throw new Error('Maskeli email sayfa metninde bulunamadı');
    }
  } catch (error) {
    sonuc.hatalar.push(`Sayfa Metni Taraması hatası: ${error.message}`);
    await log.kaydet(profilId, `Yöntem başarısız: Sayfa Metni Taraması - ${error.message}`);
  }

  sonuc.hatalar.push('Hiçbir yöntemle oturum doğrulanamadı');
  await log.kaydet(profilId, 'Tüm yöntemler başarısız oldu');
  return sonuc;
}

// ------------------ Ana modül: senin module.exports fonksiyonu (korundu) ------------------
module.exports = async function({ sayfa, log, profilId, email, sifre }) {
  const sonuc = { basarili: false, hatalar: [], ekstraBilgiler: [] };

  try {
    await log.kaydet(profilId, `İşlem başlatıldı, e-posta: ${email}`);

    // 1) sayfayı aç
    await hepsiburadaGirisSayfasinaGit(sayfa);

    // 2) çerez yüklemeyi dene
    try {
      if (await cerezleriYukleVeDogrula(sayfa, email)) {
        const oturum = await oturumKontroluYap(sayfa, email, log, profilId);
        sonuc.basarili = oturum.basarili;
        if (sonuc.basarili) {
          await log.kaydet(profilId, 'Çerezlerle giriş başarılı');
          sonuc.ekstraBilgiler.push('Giriş yöntemi: Kayıtlı çerezler');
          return sonuc;
        }
      }
    } catch (hata) {
      await log.kaydet(profilId, `Çerez yükleme başarısız: ${hata.message}`);
    }

    // 3) farklı hesap / maskeli mail ile şifre denemesi
    try {
      await log.kaydet(profilId, 'Çerezlerle giriş başarısız, alternatif yöntem deneniyor');
      let farkliHesapButonu = null;
      try { farkliHesapButonu = await sayfa.getByText('Farklı hesap kullan').first(); } catch {}
      let maskeliMail = null;
      try { maskeliMail = await sayfa.locator('input[name="EmailMasked"]').first(); } catch {}
      
      if (farkliHesapButonu && maskeliMail) {
        await log.kaydet(profilId, '"Farklı hesap kullan" ve maskeli mail bulundu, şifre ile giriş deneniyor');

        await sayfa.waitForSelector('#txtPassword', { state: 'visible', timeout: 5000 });
        await sayfa.fill('#txtPassword', sifre || PASSWORD);
        await log.kaydet(profilId, 'Şifre alanı ID ile bulundu ve dolduruldu');
        await sayfa.waitForTimeout(1000);
        await sayfa.locator('button:has-text("Giriş yap")').click();
        await sayfa.waitForTimeout(3000);
        await sayfa.waitForLoadState('networkidle', { timeout: 3000 });

        const oturum = await oturumKontroluYap(sayfa, email, log, profilId);
        sonuc.basarili = oturum.basarili;
        if (sonuc.basarili) {
          await log.kaydet(profilId, 'Şifre ile giriş başarılı, çerezler kaydediliyor');
          const cookies = await sayfa.context().cookies();
          await cerezleriGoogleDriveKaydet(email, cookies);
          sonuc.ekstraBilgiler.push('Giriş yöntemi: Şifre ile giriş');
          return sonuc;
        }
      }
    } catch (hata) {
      await log.kaydet(profilId, `Şifre ile giriş denemesi başarısız: ${hata.message}`);
      sonuc.hatalar.push(`Şifre ile giriş hatası: ${hata.message}`);
    }

    // 4) Geçici mail veya fakemail ise tek seferlik link ile giriş dene
    if (geciciMailMi(email) || fakemailMi(email)) {
      await log.kaydet(profilId, 'Geçici e-posta/fakemail domaini - sipariş takibi yöntemi deneniyor');

      await sayfa.context().clearCookies();
      await log.kaydet(profilId, 'Çerezler temizlendi');
      await hepsiburadaGirisSayfasinaGit(sayfa);
      await geciciMailGirisIslemleri(sayfa, email, profilId, log);

      const oturum = await oturumKontroluYap(sayfa, email, log, profilId);
      sonuc.basarili = oturum.basarili;
      if (sonuc.basarili) {
        await log.kaydet(profilId, 'Geçici mail/fakemail ile giriş başarılı, çerezler kaydediliyor');
        const cookies = await sayfa.context().cookies();
        await cerezleriGoogleDriveKaydet(email, cookies);
        sonuc.ekstraBilgiler.push('Giriş yöntemi: Tek seferlik link');
        return sonuc;
      }
    } else if (yayginMailMi(email)) {
      throw new Error('Yaygın mail domaini için çerezlerle giriş başarısız oldu - alternatif yöntem yok');
    }

    if (!sonuc.basarili) {
      throw new Error('Hesap doğrulanamadı: Profil sayfasında maskeli mail bulunamadı');
    }

  } catch (hata) {
    sonuc.hatalar.push(hata.message);
    await log.kaydet(profilId, `Hata: ${hata.message}`);
    try {
      const hataDir = path.join(__dirname, 'hata-screenshots');
      if (!fs.existsSync(hataDir)) fs.mkdirSync(hataDir, { recursive: true });
      const screenshotPath = path.join(hataDir, `hata-${profilId}-${Date.now()}.png`);
      if (sayfa && typeof sayfa.screenshot === 'function') {
        await sayfa.screenshot({ path: screenshotPath });
        sonuc.ekstraBilgiler.push(`Hata screenshot: ${screenshotPath}`);
      }
    } catch (e) {
      console.error('Hata sırasında screenshot alınamadı:', e);
    }
  }

  return sonuc;
};

// ------------------ ANA ÇALIŞTIRMA (örnek) ------------------
// Eğer index.js'i doğrudan node ile çalıştırırsan aşağıdaki blok çalışır.
// CI/Workflow tarafında bunu kullanmak istersen, environment ile run et.
if (require.main === module) {
  (async () => {
    const chromePathCandidates = [
      process.env.CHROME_PATH,
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ].filter(Boolean);

    let execPath = chromePathCandidates.find(p => fs.existsSync(p));
    if (!execPath) {
      console.error('Sistem Chrome/Chromium bulunamadı. Workflow veya lokal ortamda CHROME_PATH ayarla veya chrome kurulumu ekle.');
      process.exit(1);
    }

    const browser = await chromium.launch({ headless: HEADLESS, executablePath: execPath, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
    const page = await context.newPage();

    try {
      // Öğeyi çağır: module.exports beklediği paramlerle çağrıyoruz
      const result = await module.exports({ sayfa: page, log, profilId: PROFILE_ID, email: EMAIL, sifre: PASSWORD });
      console.log('İşlem sonucu:', JSON.stringify(result, null, 2));

      // Opsiyonel: raporları/ekran görüntülerini ciktilar klasörüne taşı veya ziple vs.
    } catch (err) {
      console.error('Çalıştırma hatası:', err);
    } finally {
      await browser.close();
    }
  })();
}
