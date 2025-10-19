// index.js
// ESM module for Playwright Hepsiburada automation.
// NOTE: This file includes the mail/temp/fakemail and Google Drive/GAS cookie helpers
// taken from the user's provided scripts and merged to run as a single module.
// Adjust environment variables as needed.

import { chromium } from 'playwright-core';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const __dirname = path.resolve();

// CONFIG (can be overridden via env)
const HEADLESS = (process.env.HEADLESS || 'true') === 'true';
const EMAIL = process.env.EMAIL || '';
const PASSWORD = process.env.PASSWORD || '';
const PROFILE_ID = process.env.PROFILE_ID || 'local-profile';

const API_KEY = process.env.DRIVE_API_KEY || 'AIzaSyCGUsg0BtH2SDyqnYr5eni5UKxjGe87jTU';
const KLASOR_ID = process.env.DRIVE_FOLDER_ID || '1-3sJmJe8DsNm1rOd1-FBR8BRxE5KtjKY';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwsWlQhQeuFt_KwmNhAUVf0fIUvN-snGaoNEG2Ol38W-MuQoxtOBDm-8pkjjiylF6xJ/exec';
const FAKEMAIL_BASE_URL = process.env.FAKEMAIL_BASE_URL || 'https://tr.emailfake.com';
const TEMPMAIL_BASE_URL = process.env.TEMPMAIL_BASE_URL || 'https://tempmail.plus';

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
    try { fs.appendFileSync(path.join(__dirname, 'run.log'), line + '\n'); } catch {}
  }
};

// Spoof placeholders (kept empty)
function getWebGLSpoofScript(seed){ return ''; }
function getCanvasSpoofScript(seed){ return ''; }
function getAudioContextSpoofScript(seed){ return ''; }
function getHardwareInfoSpoofScript(seed){ return ''; }
function getWebdriverSpoofScript(){ return ''; }
function getPluginAndPermissionsSpoofScript(){ return ''; }

// Helper lists
const yayginMailDomainleri = ['gmail.com','hotmail.com','yahoo.com','outlook.com','icloud.com'];
const geciciMailDomainleri = ['tempmail','mailinator','maildrop','10minutemail','mailto.plus'];
const EXTRA_GECICI = ["dropmail.me","10mail.org","yomail.info","emltmp.com","emlpro.com","emlhub.com","freeml.net","spymail.one","mailpwr.com","mimimail.me","10mail.xyz"];

function yayginMailMi(email){
  if(!email || !email.includes('@')) return false;
  return yayginMailDomainleri.some(d=>email.toLowerCase().endsWith(d));
}
function geciciMailMi(email){
  if(!email || !email.includes('@')) return false;
  const domain = email.split('@')[1].toLowerCase();
  return geciciMailDomainleri.some(s=>domain.includes(s)) || EXTRA_GECICI.some(d=>domain.includes(d));
}
function fakemailMi(email){
  if(!email || !email.includes('@')) return false;
  return !yayginMailMi(email) && !geciciMailMi(email);
}

// Google Drive helpers
export async function driveCookiesIndir(email){
  if(!API_KEY || !KLASOR_ID) {
    console.warn('driveCookiesIndir: API_KEY or KLASOR_ID missing — skipping');
    return null;
  }
  const DOSYA_ADI = `${email}.json`;
  const q = encodeURIComponent(`'${KLASOR_ID}' in parents and name='${DOSYA_ADI}' and trashed=false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&key=${API_KEY}`;
  const res = await fetch(searchUrl);
  if(!res.ok) throw new Error(`Drive search failed: ${res.status}`);
  const data = await res.json();
  if(!data.files || data.files.length===0) return null;
  data.files.sort((a,b)=>new Date(b.modifiedTime)-new Date(a.modifiedTime));
  const file = data.files[0];
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`;
  const fileRes = await fetch(downloadUrl);
  if(!fileRes.ok) throw new Error(`Drive file download failed: ${fileRes.status}`);
  return await fileRes.json();
}

export async function cerezleriGoogleDriveKaydet(email, cookies){
  if(!APPS_SCRIPT_URL) { console.warn('APPS_SCRIPT_URL missing — skipping save'); return false; }
  const res = await fetch(APPS_SCRIPT_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ action:'saveCookies', email, cookies })
  });
  if(!res.ok) throw new Error(`AppsScript error: ${res.status}`);
  const data = await res.json();
  if(!data.success) throw new Error(data.message || 'AppsScript save failed');
  return true;
}

// Temp mail API helpers
export async function mailListesiAl(email){
  const apiUrl = `${TEMPMAIL_BASE_URL}/api/mails?email=${encodeURIComponent(email)}&limit=10&epin=`;
  const res = await fetch(apiUrl);
  if(!res.ok) throw new Error(`mailListesiAl failed: ${res.status}`);
  const json = await res.json();
  return json.mail_list || [];
}
export async function mailDetayAl(mailId, email){
  const apiUrl = `${TEMPMAIL_BASE_URL}/api/mails/${encodeURIComponent(mailId)}?email=${encodeURIComponent(email)}&epin=`;
  const res = await fetch(apiUrl);
  if(!res.ok) throw new Error(`mailDetayAl failed: ${res.status}`);
  return await res.json();
}
export async function mailSil(mailId, email){
  const apiUrl = `${TEMPMAIL_BASE_URL}/api/mails/${encodeURIComponent(mailId)}?email=${encodeURIComponent(email)}&epin=`;
  const res = await fetch(apiUrl, { method:'DELETE' });
  if(!res.ok) throw new Error(`mailSil failed: ${res.status}`);
  return true;
}

export async function maildenGirisLinkiAlVeSil(email, timeoutMs=60000){
  const baslangic = Date.now();
  const kontrolEdilenler = new Set();
  let sonBasariliListeleme = 0;
  while(Date.now()-baslangic < timeoutMs){
    const simdi = Date.now();
    if(simdi - sonBasariliListeleme < 3000) await new Promise(r=>setTimeout(r, 3000 - (simdi - sonBasariliListeleme)));
    const mailler = await mailListesiAl(email).catch(()=>[]);
    sonBasariliListeleme = Date.now();
    for(const mail of mailler){
      if(kontrolEdilenler.has(mail.mail_id)) continue;
      kontrolEdilenler.add(mail.mail_id);
      await new Promise(r=>setTimeout(r,1500));
      const detay = await mailDetayAl(mail.mail_id, email).catch(()=>null);
      if(!detay) continue;
      let icerik = detay.text || '';
      if(!icerik.includes(email)) continue;
      if(detay.subject && detay.subject.includes('Tek seferlik giriş') && !icerik.includes('tek-seferlik-giris')){
        icerik = detay.html || icerik;
      }
      if(!/tek.?seferlik.?giri[sş]/i.test(icerik)) continue;
      const linkRegex = /https?:\/\/[^\s"]*hepsiburada[^\s"]*\/uyelik\/tek-seferlik-giri[sş]\/[A-Za-z0-9\-_]+/gi;
      const matches = icerik.match(linkRegex);
      if(matches && matches.length>0){
        const link = matches.reduce((a,b)=> a.length > b.length ? a : b);
        await mailSil(mail.mail_id, email).catch(()=>{});
        kontrolEdilenler.clear();
        return link;
      }
    }
  }
  kontrolEdilenler.clear();
  throw new Error("1 dakikada uygun mail bulunamadı");
}

// fakemail via UI navigation
export async function fakemaildenLinkAl(page, email){
  await page.goto(`${FAKEMAIL_BASE_URL}/${email}`, { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(1000);
  try{
    await page.getByText('Tek seferlik giriş bağlantını').first().waitFor({ timeout:60000 });
    await page.getByText('Tek seferlik giriş bağlantını').first().click();
  }catch(e){
    const mailItems = await page.locator('a, button, .mail-item').elementHandles().catch(()=>[]);
    if(mailItems && mailItems.length>0) await mailItems[0].click().catch(()=>{});
  }
  const linkByRole = await page.getByRole('link', { name:/Tek Seferlik Giriş/i }).first().catch(()=>null);
  if(linkByRole){
    const href = await linkByRole.getAttribute('href');
    if(href && href.includes('hepsiburada.com/uyelik/tek-seferlik-giris')) return href;
  }
  const anchors = await page.locator('a').elementHandles();
  for(const a of anchors){
    const href = await a.getAttribute('href').catch(()=>null);
    if(href && href.includes('hepsiburada.com/uyelik/tek-seferlik-giris')) return href;
  }
  throw new Error('Geçerli giriş linki bulunamadı (fakemaildenLinkAl)');
}

// site checks and oturum control (shortened but preserved logic)
export async function hepsiburadaGirisSayfasinaGit(page){
  const girisUrl = 'https://giris.hepsiburada.com/?ReturnUrl=https%3A%2F%2Foauth.hepsiburada.com%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3DSPA%26redirect_uri%3Dhttps%253A%252F%252Fwww.hepsiburada.com%252Fuyelik%252Fcallback%26response_type%3Dcode%26scope%3Dopenid%2520profile%26state%3Df883eaadc71d42c8bfe3aa90bc07585a%26code_challenge%3DI4Ihs_2x7BPCMgYoGd7YrazWUqIYgxTzIGMQVovpJfg%26code_challenge_method%3DS256%26response_mode%3Dquery%26customizeSegment%3DORDERS%26ActivePage%3DPURE_LOGIN%26oidcReturnUrl%3D%252Fsiparislerim';
  await page.goto(girisUrl, { waitUntil:'networkidle', timeout:30000 });
  try { await page.waitForSelector('text=Sipariş takibi', { timeout:15000 }); await log.kaydet('system','Giriş sayfası yüklendi: "Sipariş takibi" bulundu'); } catch(e){ throw new Error('"Sipariş takibi" bulunamadı veya sayfa yüklenemedi'); }
}

export async function oturumKontroluYap(page, email, logger, profilId){
  const result = { basarili:false, kullanilanYontem:'', hatalar:[] };
  await logger.kaydet(profilId, 'Oturum kontrolü başlatılıyor (hesap bilgileri sayfası)...');
  try {
    await page.goto('https://hesabim.hepsiburada.com/uyelik-bilgilerim', { waitUntil:'networkidle', timeout:10000 });
    await logger.kaydet(profilId, 'Hesap bilgileri sayfası açıldı');
  } catch(e) {
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
      result.basarili = true; result.kullanilanYontem='Email Input Değeri Kontrolü';
      await logger.kaydet(profilId, 'BAŞARILI: Oturum Email Input Değeri Kontrolü ile doğrulandı');
      return result;
    } else { throw new Error(`Maskeli email uyuşmuyor. Beklenen: ${beklenenMaskeli}, Bulunan: ${inputDegeri}`); }
  } catch(error){
    result.hatalar.push(`Email Input Değeri Kontrolü hatası: ${error.message}`);
    await logger.kaydet(profilId, `Yöntem başarısız: Email Input Değeri Kontrolü - ${error.message}`);
  }
  try {
    const sayfaMetni = await page.content();
    if (sayfaMetni.includes(beklenenMaskeli)) {
      result.basarili = true; result.kullanilanYontem='Sayfa Metni Taraması';
      await logger.kaydet(profilId,'BAŞARILI: Oturum Sayfa Metni Taraması ile doğrulandı');
      return result;
    } else { throw new Error('Maskeli email sayfa metninde bulunamadı'); }
  } catch(error){
    result.hatalar.push(`Sayfa Metni Taraması hatası: ${error.message}`);
    await logger.kaydet(profilId, `Yöntem başarısız: Sayfa Metni Taraması - ${error.message}`);
  }
  result.hatalar.push('Hiçbir yöntemle oturum doğrulanamadı');
  await logger.kaydet(profilId, 'Tüm yöntemler başarısız oldu');
  return result;
}

// Temp/fakemail login flow
export default async function({ sayfa, log: logger = log, profilId = PROFILE_ID, email = EMAIL, sifre = PASSWORD }){
  const sonuc = { basarili:false, hatalar:[], ekstraBilgiler:[] };
  try {
    await logger.kaydet(profilId, `İşlem başlatıldı: ${email}`);
    await hepsiburadaGirisSayfasinaGit(sayfa);

    // try cookies
    try {
      await logger.kaydet(profilId, 'Kayıtlı çerez ile giriş deneniyor...');
      const cookiesData = await driveCookiesIndir(email);
      if (cookiesData && Array.isArray(cookiesData)) {
        const duzenlenmisCookies = cookiesData.map(cookie=>({
          ...cookie,
          domain: cookie.domain || '.hepsiburada.com',
          path: cookie.path || '/',
          secure: cookie.secure !== undefined ? cookie.secure : true,
          httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : true,
          sameSite: cookie.sameSite || 'Lax'
        }));
        await sayfa.context().clearCookies();
        await sayfa.context().addCookies(duzenlenmisCookies);
        await sayfa.reload({ waitUntil:'networkidle' });
        await sayfa.waitForTimeout(2000);
        const oturum = await oturumKontroluYap(sayfa, email, logger, profilId);
        sonuc.basarili = oturum.basarili;
        if(sonuc.basarili){ await logger.kaydet(profilId,'Çerez ile oturum doğrulandı'); sonuc.ekstraBilgiler.push('Giriş yöntemi: Kayıtlı çerezler'); return sonuc; }
      }
    } catch(e){ await logger.kaydet(profilId, `Çerez yükleme sırasında hata: ${e.message}`); }

    // password login
    try {
      await logger.kaydet(profilId, 'Şifre ile giriş denemesi kontrol ediliyor...');
      let farkliHesap=null; try{ farkliHesap = await sayfa.getByText('Farklı hesap kullan').first(); }catch{ farkliHesap=null; }
      let maskeliInput=null; try{ maskeliInput = await sayfa.locator('input[name="EmailMasked"]').first(); }catch{ maskeliInput=null; }
      if(farkliHesap && maskeliInput){
        await logger.kaydet(profilId,'"Farklı hesap kullan" ve maskeli input bulundu, şifre ile giriş deneniyor');
        await sayfa.waitForSelector('#txtPassword',{ state:'visible', timeout:5000 });
        await sayfa.fill('#txtPassword', sifre || '');
        await logger.kaydet(profilId,'Şifre alanı ID ile bulundu ve dolduruldu');
        await sayfa.waitForTimeout(1000);
        await sayfa.locator('button:has-text("Giriş yap")').first().click();
        await sayfa.waitForTimeout(3000);
        await sayfa.waitForLoadState('networkidle',{ timeout:3000 });
        const oturum = await oturumKontroluYap(sayfa, email, logger, profilId);
        sonuc.basarili = oturum.basarili;
        if(sonuc.basarili){
          await logger.kaydet(profilId,'Şifre ile giriş başarılı, çerezler kaydediliyor');
          const cookies = await sayfa.context().cookies();
          await cerezleriGoogleDriveKaydet(email,cookies).catch(err=>logger.kaydet(profilId,`Çerez kaydetme uyarısı: ${err.message}`));
          sonuc.ekstraBilgiler.push('Giriş yöntemi: Şifre ile giriş');
          return sonuc;
        }
      }
    } catch(hata){ await logger.kaydet(profilId,`Şifre ile giriş denemesi başarısız: ${hata.message}`); sonuc.hatalar.push(`Şifre ile giriş hatası: ${hata.message}`); }

    // temp/fakemail
    if(geciciMailMi(email) || fakemailMi(email)){
      await logger.kaydet(profilId,'Geçici e-posta/fakemail domaini - tek seferlik link yöntemi deneniyor');
      await sayfa.context().clearCookies();
      await logger.kaydet(profilId,'Çerezler temizlendi');
      await hepsiburadaGirisSayfasinaGit(sayfa);
      try{
        const tekSeferlikLink = fakemailMi(email) ? await fakemaildenLinkAl(sayfa,email) : await maildenGirisLinkiAlVeSil(email);
        if(!tekSeferlikLink) throw new Error('Fakemail linki alınamadı');
        await logger.kaydet(profilId,`Tek seferlik giriş linki bulundu: ${tekSeferlikLink}`);
        await sayfa.goto(tekSeferlikLink,{ waitUntil:'networkidle', timeout:30000 });
        await sayfa.waitForTimeout(3000);
        const oturum = await oturumKontroluYap(sayfa,email,logger,profilId);
        sonuc.basarili = oturum.basarili;
        if(sonuc.basarili){
          await logger.kaydet(profilId,'Fakemail/tempmail ile giriş başarılı, çerezler kaydediliyor');
          const cookies = await sayfa.context().cookies();
          await cerezleriGoogleDriveKaydet(email,cookies).catch(err=>logger.kaydet(profilId,`Çerez kaydetme uyarısı: ${err.message}`));
          sonuc.ekstraBilgiler.push('Giriş yöntemi: Tek seferlik link (tempmail/fakemail)');
          return sonuc;
        } else { throw new Error('Tek seferlik link sonrası oturum doğrulanamadı'); }
      } catch(e){ await logger.kaydet(profilId,`Tek seferlik link yöntemi başarısız: ${e.message}`); sonuc.hatalar.push(`Fakemail/tempmail hatası: ${e.message}`); }
    } else if(yayginMailMi(email)){
      throw new Error('Yaygın mail domaini için çerezlerle giriş başarısız oldu - alternatif yok');
    }
    if(!sonuc.basarili) throw new Error('Hesap doğrulanamadı: Hiçbir yöntem başarılı olmadı');

  } catch(err){
    sonuc.hatalar.push(err.message || String(err));
    await logger.kaydet(profilId, `Genel hata: ${err.message || err}`);
    try {
      if(typeof sayfa?.screenshot === 'function'){
        const shotPath = path.join(HATA_DIR, `hata-${profilId}-${Date.now()}.png`);
        await sayfa.screenshot({ path: shotPath, fullPage:false });
        sonuc.ekstraBilgiler.push(`Hata screenshot: ${shotPath}`);
      }
    } catch(e){ await logger.kaydet(profilId, `Screenshot alınamadı: ${e.message}`); }
  }
  return sonuc;
}
