// index.js
import { chromium } from 'playwright-core';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const __dirname = path.resolve();

const OUTPUT_DIR = path.join(__dirname, 'ciktilar');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const HEADLESS = (process.env.HEADLESS || 'true') === 'true';
const EMAIL = process.env.EMAIL || 'deneme@example.com';
const PASSWORD = process.env.PASSWORD || '';
const PROFILE_ID = process.env.PROFILE_ID || 'local-profile';

const API_KEY = process.env.DRIVE_API_KEY || '';
const KLASOR_ID = process.env.DRIVE_FOLDER_ID || '';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
const FAKEMAIL_BASE_URL = process.env.FAKEMAIL_BASE_URL || 'https://tempmail.plus';

// Basit logger
const log = {
  async kaydet(profilId, mesaj) {
    const t = new Date().toISOString();
    console.log(`[${t}] [${profilId}] ${mesaj}`);
  }
};

// ------------------------ PLACEHOLDER SPOOFING ------------------------
function getWebGLSpoofScript(seed) { return '/* SPOOFING OMITTED */'; }
function getCanvasSpoofScript(seed) { return '/* SPOOFING OMITTED */'; }
function getAudioContextSpoofScript(seed) { return '/* SPOOFING OMITTED */'; }
function getHardwareInfoSpoofScript(seed) { return '/* SPOOFING OMITTED */'; }
function getWebdriverSpoofScript() { return '/* SPOOFING OMITTED */'; }
function getPluginAndPermissionsSpoofScript() { return '/* SPOOFING OMITTED */'; }

// ------------------------ MAIL & ÇEREZ FONKSİYONLARI ------------------------

// Hepsiburada giriş sayfası
async function hepsiburadaGirisSayfasinaGit(page) {
  const girisUrl = 'https://giris.hepsiburada.com/?ReturnUrl=https%3A%2F%2Foauth.hepsiburada.com%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3DSPA%26redirect_uri%3Dhttps%253A%252F%252Fwww.hepsiburada.com%252Fuyelik%252Fcallback%26response_type%3Dcode%26scope%3Dopenid%2520profile%26state%3Df883eaadc71d42c8bfe3aa90bc07585a%26code_challenge%3DI4Ihs_2x7BPCMgYoGd7YrazWUqIYgxTzIGMQVovpJfg%26code_challenge_method%3DS256%26response_mode%3Dquery%26customizeSegment%3DORDERS%26ActivePage%3DPURE_LOGIN%26oidcReturnUrl%3D%252Fsiparislerim';
  await page.goto(girisUrl, { waitUntil: 'networkidle', timeout: 30000 });
  try { await page.waitForSelector('text=Sipariş takibi', { timeout: 15000 }); console.log("Sayfa yüklendi ve 'Sipariş takibi' görüldü."); }
  catch { throw new Error('Sayfa yüklenemedi veya "Sipariş takibi" bulunamadı'); }
}

// Mail domain kontrolü
const yayginMailDomainleri = ['gmail.com','hotmail.com','yahoo.com','outlook.com','icloud.com'];
function yayginMailMi(email) { return yayginMailDomainleri.some(d => email.toLowerCase().endsWith(d)); }
const geciciMailDomainleri = ['tempmail', 'mailinator', 'maildrop', '10minutemail', 'mailto.plus'];
function geciciMailMi(email) { const d = email.split('@')[1]?.toLowerCase()||''; return geciciMailDomainleri.some(t => d.includes(t)); }
function fakemailMi(email) { const d = email.split('@')[1]?.toLowerCase()||''; return !yayginMailMi(email) && !geciciMailMi(email); }

// Google Drive çerez indir
async function driveCookiesIndir(email) {
  if (!API_KEY||!KLASOR_ID) { console.warn('Drive API ayarlı değil.'); return null; }
  const DOSYA_ADI = `${email}.json`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${KLASOR_ID}'+in+parents+and+name='${DOSYA_ADI}'+and+trashed=false&fields=files(id,name,modifiedTime)&key=${API_KEY}`;
  const response = await fetch(searchUrl);
  if (!response.ok) throw new Error(`Drive API error: ${response.status}`);
  const data = await response.json();
  if (!data.files||!data.files.length) return null;
  const file = data.files.sort((a,b)=>new Date(b.modifiedTime)-new Date(a.modifiedTime))[0];
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`;
  const fileResponse = await fetch(downloadUrl);
  if (!fileResponse.ok) throw new Error(`Dosya indirme hatası: ${fileResponse.status}`);
  return await fileResponse.json();
}

// Çerezleri kaydet
async function cerezleriGoogleDriveKaydet(email, cookies) {
  if (!APPS_SCRIPT_URL) { console.warn('AppsScript URL ayarlı değil'); return false; }
  const response = await fetch(APPS_SCRIPT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'saveCookies', email, cookies}) });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.message||'Çerezler kaydedilemedi');
  return true;
}

// Çerez yükle ve doğrula
async function cerezleriYukleVeDogrula(page, email) {
  const cookiesData = await driveCookiesIndir(email);
  if (!cookiesData || !Array.isArray(cookiesData)) throw new Error('Çerez bulunamadı');
  const duzenlenmis = cookiesData.map(c=>({...c, domain:c.domain||'.hepsiburada.com', path:c.path||'/', secure:c.secure!==undefined?c.secure:true, httpOnly:c.httpOnly!==undefined?c.httpOnly:true, sameSite:c.sameSite||'Lax'}));
  await page.context().clearCookies();
  await page.context().addCookies(duzenlenmis);
  await page.reload({ waitUntil:'networkidle' });
  await page.waitForTimeout(2000);
  return true;
}

// Fakemail link alma
async function fakemaildenLinkAl(page, email) {
  await page.goto(`${FAKEMAIL_BASE_URL}/${email}`, { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(1500);
  const linkEl = await page.$('a:has-text("Tek Seferlik Giriş Yap"), a:has-text("Tek seferlik giriş")');
  if (!linkEl) throw new Error('Giriş linki bulunamadı');
  return await linkEl.getAttribute('href');
}

// Mail API örnek
async function mailListesiAl(email) {
  const res = await fetch(`https://tempmail.plus/api/mails?email=${email}&limit=10&epin=`);
  if (!res.ok) throw new Error(`Mail listesi alınamadı: ${res.status}`);
  const data = await res.json();
  return data.mail_list||[];
}
async function mailDetayAl(mailId,email){ const res=await fetch(`https://tempmail.plus/api/mails/${mailId}?email=${email}&epin=`); if(!res.ok) throw new Error(`Mail detay alınamadı: ${res.status}`); return await res.json();}
async function mailSil(mailId,email){ const res=await fetch(`https://tempmail.plus/api/mails/${mailId}?email=${email}&epin=`,{method:'DELETE'}); if(!res.ok) throw new Error(`Mail silinemedi: ${res.status}`); return true;}

// Mailden giriş linki al ve sil
async function maildenGirisLinkiAlVeSil(email, log=console) {
  const baslangic=Date.now(), kontrolEdilenler=new Set(); let sonBasariliListeleme=0;
  while(Date.now()-baslangic<60000){
    const simdi=Date.now(); if(simdi-sonBasariliListeleme<3000) await new Promise(r=>setTimeout(r,3000-(simdi-sonBasariliListeleme)));
    const mailler=await mailListesiAl(email).catch(()=>[]); sonBasariliListeleme=Date.now();
    for(const mail of mailler){
      if(kontrolEdilenler.has(mail.mail_id)) continue; kontrolEdilenler.add(mail.mail_id);
      await new Promise(r=>setTimeout(r,1500));
      const detay=await mailDetayAl(mail.mail_id,email).catch(()=>null); if(!detay) continue;
      let icerik=detay.text||''; if(!icerik.includes(email)) continue;
      if(detay.subject && detay.subject.includes('Tek seferlik giriş') && !icerik.includes('tek-seferlik-giris')) icerik=detay.html||icerik;
      if(!/tek.?seferlik.?giri[sş]/i.test(icerik)) continue;
      const linkRegex=/https?:\/\/[^\s]*hepsiburada[^\s]*\/uyelik\/tek-seferlik-giri[sş]\/[A-Za-z0-9-_]+/gi;
      const matches=icerik.match(linkRegex);
      if(matches && matches.length>0){
        const link=matches.reduce((a,b)=>a.length>b.length?a:b);
        await mailSil(mail.mail_id,email);
        kontrolEdilenler.clear(); return link;
      }
    }
  }
  kontrolEdilenler.clear();
  throw new Error("1 dakikada uygun mail bulunamadı");
}

// Oturum kontrol
async function oturumKontroluYap(page,email,log,profilId){
  const sonuc={basarili:false,kullanilanYontem:'',hatalar:[]};
  await log.kaydet(profilId,'Hesap bilgileri sayfasına gidiliyor...');
  try{ await page.goto('https://hesabim.hepsiburada.com/uyelik-bilgilerim',{waitUntil:'networkidle',timeout:10000}); await log.kaydet(profilId,'Sayfa yüklendi, doğrulamalar başlatılıyor...'); }
  catch(error){ sonuc.hatalar.push(`Sayfa yüklenemedi: ${error.message}`); await log.kaydet(profilId,`HATA: Sayfa yüklenemedi - ${error.message}`); return sonuc;}
  const [prefix,domain]=email.split('@'); const beklenenMaskeli=`${prefix[0]}***${prefix.slice(-1)}@${domain}`;
  await log.kaydet(profilId,`Beklenen maskeli format: ${beklenenMaskeli}`);
  try{
    const emailInput=await page.locator('input[name="EmailMasked"]'); 
    const inputDegeri=emailInput?await emailInput.inputValue():null;
    await log.kaydet(profilId,`[Email Input] Bulunan değer: ${inputDegeri}`);
    if(inputDegeri===beklenenMaskeli){ sonuc.basarili=true; sonuc.kullanilanYontem='Email Input Değeri Kontrolü'; await log.kaydet(profilId,'BAŞARILI: Oturum Email Input Değeri Kontrolü ile doğrulandı'); return sonuc; }
    else throw new Error(`Maskeli email uyuşmuyor. Beklenen: ${beklenenMaskeli}, Bulunan: ${inputDegeri}`);
  } catch(error){ sonuc.hatalar.push(`Email Input Değeri Kontrolü hatası: ${error.message}`); await log.kaydet(profilId,`Yöntem başarısız: Email Input Değeri Kontrolü - ${error.message}`);}
  try{ const sayfaMetni=await page.content(); if(sayfaMetni.includes(beklenenMaskeli)){ sonuc.basarili=true; sonuc.kullanilanYontem='Sayfa Metni Taraması'; await log.kaydet(profilId,'BAŞARILI: Oturum Sayfa Metni Taraması ile doğrulandı'); return sonuc; } else throw new Error('Maskeli email sayfa metninde bulunamadı'); }
  catch(error){ sonuc.hatalar.push(`Sayfa Metni Taraması hatası: ${error.message}`); await log.kaydet(profilId,`Yöntem başarısız: Sayfa Metni Taraması - ${error.message}`);}
  sonuc.hatalar.push('Hiçbir yöntemle oturum doğrulanamadı'); await log.kaydet(profilId,'Tüm yöntemler başarısız oldu'); return sonuc;
}

// PLACEHOLDER: fakemail giriş işlemleri
async function geciciMailGirisIslemleri(page,email,profilId,log){
  await log.kaydet(profilId,`Fakemail ile giriş denemesi başlatıldı: ${email}`);
  // buraya kendi fakemail link alma ve tek seferlik giriş kodunu ekle
}

// ------------------ Ana modül ------------------
export default async function({sayfa,log,profilId,email,sifre}){
  const sonuc={basarili:false,hatalar:[],ekstraBilgiler:[]};
  try{
    await log.kaydet(profilId,`İşlem başlatıldı: ${email}`);
    await hepsiburadaGirisSayfasinaGit(sayfa);
    try{
      if(await cerezleriYukleVeDogrula(sayfa,email)){
        const oturum=await oturumKontroluYap(sayfa,email,log,profilId);
        sonuc.basarili=oturum.basarili;
        if(sonuc.basarili){ await log.kaydet(profilId,'Çerezlerle giriş başarılı'); sonuc.ekstraBilgiler.push('Giriş yöntemi: Kayıtlı çerezler'); return sonuc; }
      }
    }catch(hata){ await log.kaydet(profilId,`Çerez yükleme başarısız: ${hata.message}`);}
    if(geciciMailMi(email)||fakemailMi(email)){
      await log.kaydet(profilId,'Geçici mail/fakemail yöntemi deneniyor');
      await sayfa.context().clearCookies();
      await hepsiburadaGirisSayfasinaGit(sayfa);
      await geciciMailGirisIslemleri(sayfa,email,profilId,log);
      const oturum=await oturumKontroluYap(sayfa,email,log,profilId);
      sonuc.basarili=oturum.basarili;
      if(sonuc.basarili){ await log.kaydet(profilId,'Fakemail ile giriş başarılı'); const cookies=await sayfa.context().cookies(); await cerezleriGoogleDriveKaydet(email,cookies); sonuc.ekstraBilgiler.push('Giriş yöntemi: Tek seferlik link'); return sonuc; }
    }else if(yayginMailMi(email)) throw new Error('Yaygın mail domaini için çerezlerle giriş başarısız oldu - alternatif yok');
    if(!sonuc.basarili) throw new Error('Hesap doğrulanamadı: Profil sayfasında maskeli mail bulunamadı');
  }catch(hata){ sonuc.hatalar.push(hata.message); await log.kaydet(profilId,`Hata: ${hata.message}`);}
  return sonuc;
}

// ------------------ Ana çalıştırma ------------------
if (process.argv[1].endsWith('index.js')){
  (async()=>{
    const chromePathCandidates=[process.env.CHROME_PATH,'/usr/bin/google-chrome-stable','/usr/bin/google-chrome','/usr/bin/chromium-browser','/usr/bin/chromium'].filter(Boolean);
    const execPath=chromePathCandidates.find(p=>fs.existsSync(p));
    if(!execPath){ console.error('Chrome/Chromium bulunamadı. CHROME_PATH ayarla.'); process.exit(1); }
    const browser=await chromium.launch({headless:HEADLESS,executablePath:execPath,args:['--no-sandbox','--disable-setuid-sandbox']});
    const context=await browser.newContext({viewport:{width:1280,height:720},locale:'tr-TR',timezoneId:'Europe/Istanbul'});
    const page=await context.newPage();
    try{
      const result=(await import('./index.js')).default({sayfa:page,log,profilId:PROFILE_ID,email:EMAIL,sifre:PASSWORD});
      console.log('İşlem sonucu:',JSON.stringify(await result,null,2));
    }catch(err){ console.error('Çalıştırma hatası:',err);}
    finally{ await browser.close();}
  })();
}
