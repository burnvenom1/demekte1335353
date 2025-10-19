import { expect } from '@playwright/test';
import fetch from 'node-fetch';

// E-posta domain kontrol listeleri
const yayginMailDomainleri = ["@gmail.com", "@outlook.com", "@hotmail.com", "@yahoo.com"];
const geciciMailDomainleri = [
  "dropmail.me", "10mail.org", "yomail.info", "emltmp.com", "emlpro.com",
  "emlhub.com", "freeml.net", "spymail.one", "mailpwr.com", "mimimail.me", "10mail.xyz"
];

const FAKEMAIL_BASE_URL = "https://tr.emailfake.com";
const API_KEY = "AIzaSyCGUsg0BtH2SDyqnYr5eni5UKxjGe87jTU";
const KLASOR_ID = "1-3sJmJe8DsNm1rOd1-FBR8BRxE5KtjKY";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwsWlQhQeuFt_KwmNhAUVf0fIUvN-snGaoNEG2Ol38W-MuQoxtOBDm-8pkjjiylF6xJ/exec";

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

// Yaygın mail kontrolü
function yayginMailMi(email) {
  return yayginMailDomainleri.some(domain => email.toLowerCase().endsWith(domain));
}

// Geçici mail kontrolü
function geciciMailMi(email) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return geciciMailDomainleri.some(tempDomain => domain.includes(tempDomain));
}

// Fakemail kontrolü (GÜNCELLENDİ - SADECE KONUŞULAN DEĞİŞİKLİK)
function fakemailMi(email) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return !yayginMailMi(email) && !geciciMailMi(email); // Artık TANIMSIZ domainler fakemail sayılacak
}
// Google Drive'dan çerez dosyasını indir
async function driveCookiesIndir(email) {
  const DOSYA_ADI = `${email}.json`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${KLASOR_ID}'+in+parents+and+name='${DOSYA_ADI}'+and+trashed=false&fields=files(id,name,modifiedTime)&key=${API_KEY}`;

  try {
    const response = await fetch(searchUrl);
    if (!response.ok) throw new Error(`Drive API error: ${response.status}`);
    
    const data = await response.json();
    if (!data.files || data.files.length === 0) {
      return null;
    }

    // En güncel dosyayı al
    const file = data.files.sort((a,b) => 
      new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];
    
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`;
    const fileResponse = await fetch(downloadUrl);
    
    if (!fileResponse.ok) {
      throw new Error(`Dosya indirme hatası: ${fileResponse.status}`);
    }
    
    return await fileResponse.json();
  } catch (error) {
    console.error('Google Drive işlem hatası:', error);
    throw error;
  }
}

// Çerezleri Google Apps Script'e kaydet
async function cerezleriGoogleDriveKaydet(email, cookies) {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'saveCookies',
        email: email,
        cookies: cookies
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      console.log('Çerezler başarıyla kaydedildi:', result.message);
      return true;
    } else {
      throw new Error(result.message || 'Çerezler kaydedilemedi');
    }
  } catch (error) {
    console.error('Çerez kaydetme hatası:', error);
    throw error;
  }
}

// Çerezleri yükle ve doğrula
async function cerezleriYukleVeDogrula(page, email) {
  try {
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
    
    // Önce mevcut çerezleri temizle
    await page.context().clearCookies();
    
    // Yeni çerezleri ekle
    await page.context().addCookies(duzenlenmisCookies);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    return true;
  } catch (hata) {
    console.error('Çerez yükleme hatası:', hata);
    throw new Error(`Çerez yükleme başarısız: ${hata.message}`);
  }
}

// Fakemail'den tek seferlik giriş linkini almak için güncellenmiş fonksiyon
async function fakemaildenLinkAl(page, email) {
  // 1. FakeMail sayfasına git (email doğrudan URL'ye ekleniyor)
  await page.goto(`${FAKEMAIL_BASE_URL}/${email}`, {
    waitUntil: 'networkidle',
    timeout: 60000 // Sayfa yüklemesi için 1 dakika bekle
  });

  // 2. Mail içeriğini kontrol et (1 dakika bekle)
  await expect(page.getByText('Tek seferlik giriş bağlantını').first()).toBeVisible({
    timeout: 60000 // 1 dakika bekleme süresi
  });
  
  // 3. Maili aç
  await page.getByText('Tek seferlik giriş bağlantını').first().click();
  
  // 4. Linki bul
  const linkElement = page.getByRole('link', { name: 'Tek Seferlik Giriş Yap' });
  await expect(linkElement).toBeVisible();
  
  // 5. Linki çek
  const link = await linkElement.getAttribute('href');
  
  if (!link || !link.includes('hepsiburada.com/uyelik/tek-seferlik-giris')) {
    throw new Error('Geçerli giriş linki bulunamadı');
  }

  return link;
}


// Geçici mail ile giriş işlemleri (GÜNCELLENMİŞ)
async function geciciMailGirisIslemleri(page, email, profilId, log) {
  try {
    await log.kaydet(profilId, `Giriş yapılacak e-posta: ${email}`);
    await log.kaydet(profilId, 'Geçici mail işlemleri başlatılıyor...');
    
    await page.locator('text=Sipariş takibi').first().click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('textbox', { name: 'E-posta adresi' }).click();
    await page.getByRole('textbox', { name: 'E-posta adresi' }).fill(email);
    await page.locator('button:has-text("Giriş yap")').click();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=E-posta adresinize gönderilen')).toBeVisible();
    await log.kaydet(profilId, 'Doğrulama maili gönderildi');
    
    // Fakemail veya standart geçici mail kontrolü
    const girisLinki = fakemailMi(email) 
      ? await fakemaildenLinkAl(page, email)
      : await maildenGirisLinkiAlVeSil(email);
    
    if (!girisLinki) {
      throw new Error('Mailden giriş linki alınamadı');
    }
    
    await page.goto(girisLinki, { waitUntil: 'networkidle' });
    await log.kaydet(profilId, 'Tek seferlik giriş linki kullanıldı');
    
    return true;
    
  } catch (hata) {
    await log.kaydet(profilId, `Geçici mail işlemlerinde hata: ${hata.message}`);
    throw hata;
  }
}

// Mailden giriş linkini al ve maili sil
async function maildenGirisLinkiAlVeSil(email, log = console) {
  const baslangic = Date.now();
  const kontrolEdilenler = new Set();
  let sonBasariliListeleme = 0;

  try {
    while (Date.now() - baslangic < 60000) {
      // API limiti için: En az 3 saniye bekleyerek listeleme yap
      const simdi = Date.now();
      if (simdi - sonBasariliListeleme < 3000) {
        await new Promise(r => setTimeout(r, 3000 - (simdi - sonBasariliListeleme)));
      }

      const mailler = await mailListesiAl(email).catch(() => []);
      sonBasariliListeleme = Date.now();

      for (const mail of mailler) {
        if (kontrolEdilenler.has(mail.mail_id)) continue;
        kontrolEdilenler.add(mail.mail_id);

        // API limiti için: Mail detayları arasında 1.5 sn bekle
        await new Promise(r => setTimeout(r, 1500));
        
        const detay = await mailDetayAl(mail.mail_id, email).catch(() => null);
        if (!detay) continue;

        // Mail içeriği
        let icerik = detay.text || '';
        
        // 1. Mailde sizin e-posta adresinizi kontrol et
        if (!icerik.includes(email)) {
          console.log(`Mail adresi (${email}) içerikte bulunamadı`);
          continue;  // E-posta adresinizi içermeyen mailleri geç
        }

        // 2. Eğer konu doğruysa ama link bulunamadıysa, HTML içeriğine bak
        if (detay.subject.includes('Tek seferlik giriş') && !icerik.includes('tek-seferlik-giris')) {
          icerik = detay.html || icerik;
        }

        // 3. Hızlı Filtreleme: Tek seferlik giriş linkini kontrol et
        if (!/tek.?seferlik.?giri[sş]/i.test(icerik)) {
          continue; // Eğer "tek-seferlik giriş" ifadesi yoksa, geç
        }

        // 4. Kesin Kontrol - Linki bulmak için regex kullan
        const linkRegex = /https?:\/\/[^\s]*hepsiburada[^\s]*\/uyelik\/tek-seferlik-giri[sş]\/[A-Za-z0-9]+/gi;
        const matches = icerik.match(linkRegex);
        
        if (matches && matches.length > 0) {
          // En uzun linki seç (genellikle doğru olan bu)
          const link = matches.reduce((a, b) => a.length > b.length ? a : b);
          
          // Maili silmek için DELETE isteği gönder
          await mailSil(mail.mail_id);
          return link;
        }
      }
    }
    throw new Error("1 dakikada uygun mail bulunamadı");
  } finally {
    kontrolEdilenler.clear();
  }
}

// Mail listesi alma
async function mailListesiAl(email) {
    const apiUrl = `https://tempmail.plus/api/mails?email=evodecw@mailto.plus&limit=10&epin=`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
        throw new Error(`Mail listesi alınamadı: ${response.status} ${response.statusText}`);
    }
    
    const veri = await response.json();
    return veri.mail_list || [];
}

// Mail detayını alma
async function mailDetayAl(mailId, email) {
    const apiUrl = `https://tempmail.plus/api/mails/${mailId}?email=evodecw@mailto.plus&epin=`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
        throw new Error(`Mail detay alınamadı: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
}

// Maili sil
async function mailSil(mailId, email) {
  const apiUrl = `https://tempmail.plus/api/mails/${mailId}?email=evodecw@mailto.plus&epin=`;

  try {
    const response = await fetch(apiUrl, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Mail silinemedi: ${response.status} ${response.statusText}`);
    }

    console.log(`Mail (${mailId}) başarıyla silindi.`);
    return true;
  } catch (error) {
    console.error('Mail silme hatası:', error);
    throw new Error(`Mail silme başarısız: ${error.message}`);
  }
}

// Oturum Kontrol Fonksiyonu
async function oturumKontroluYap(page, email, log, profilId) {
    const sonuc = {
        basarili: false,
        kullanilanYontem: '',
        hatalar: []
    };

    // 1. Hesap bilgileri sayfasına git
    await log.kaydet(profilId, 'Hesap bilgileri sayfasına gidiliyor...');
    try {
        await page.goto('https://hesabim.hepsiburada.com/uyelik-bilgilerim', {
            waitUntil: 'networkidle',
            timeout: 10000
        });
        await log.kaydet(profilId, 'Sayfa yüklendi, doğrulamalar başlatılıyor...');
    } catch (error) {
        sonuc.hatalar.push(`Sayfa yüklenemedi: ${error.message}`);
        await log.kaydet(profilId, `HATA: Sayfa yüklenemedi - ${error.message}`);
        return sonuc;
    }

    // 2. Maskeli email formatını hazırla
    const [prefix, domain] = email.split('@');
    const beklenenMaskeli = `${prefix[0]}***${prefix.slice(-1)}@${domain}`;
    await log.kaydet(profilId, `Beklenen maskeli format: ${beklenenMaskeli}`);

    // 3. Email Input Değeri Kontrolü Yöntemi
    try {
        const emailInput = await page.locator('input[name="EmailMasked"]');  // Maskelenmiş e-posta
        if (!emailInput) throw new Error('Email inputu bulunamadı');

        const inputDegeri = await emailInput.inputValue();
        await log.kaydet(profilId, `[Email Input] Bulunan değer: ${inputDegeri}`);

        if (inputDegeri === beklenenMaskeli) {
            sonuc.basarili = true;
            sonuc.kullanilanYontem = 'Email Input Değeri Kontrolü';
            await log.kaydet(profilId, 'BAŞARILI: Oturum Email Input Değeri Kontrolü ile doğrulandı');
        } else {
            throw new Error(`Maskeli email uyuşmuyor. Beklenen: ${beklenenMaskeli}, Bulunan: ${inputDegeri}`);
        }
    } catch (error) {
        sonuc.hatalar.push(`Email Input Değeri Kontrolü hatası: ${error.message}`);
        await log.kaydet(profilId, `Yöntem başarısız: Email Input Değeri Kontrolü - ${error.message}`);
    }

    // 4. Eğer Email Input Değeri Kontrolü başarısızsa, Sayfa Metni Taraması ile tekrar dene
    if (!sonuc.basarili) {
        await log.kaydet(profilId, 'Email Input Kontrolü başarısız, Sayfa Metni Taraması ile tekrar denenecek...');

        try {
            const sayfaMetni = await page.content();
            if (sayfaMetni.includes(beklenenMaskeli)) {
                sonuc.basarili = true;
                sonuc.kullanilanYontem = 'Sayfa Metni Taraması';
                await log.kaydet(profilId, 'BAŞARILI: Oturum Sayfa Metni Taraması ile doğrulandı');
            } else {
                throw new Error('Maskeli email sayfa metninde bulunamadı');
            }
        } catch (error) {
            sonuc.hatalar.push(`Sayfa Metni Taraması hatası: ${error.message}`);
            await log.kaydet(profilId, `Yöntem başarısız: Sayfa Metni Taraması - ${error.message}`);
        }
    }

    // 5. Sonuçları döndür
    if (!sonuc.basarili) {
        await log.kaydet(profilId, 'Tüm yöntemler başarısız oldu');
        sonuc.hatalar.push('Hiçbir yöntemle oturum doğrulanamadı');
    }
    
    return sonuc;
}

// Ana işlev (GÜNCELLENMİŞ)
export default async function({sayfa, log, profilId, email, sifre}) {
  const sonuc = {
    basarili: false,
    hatalar: [],
    ekstraBilgiler: []
  };

  try {
    await log.kaydet(profilId, `İşlem başlatıldı, e-posta: ${email}`);
    
    // 1. ADIM: Hepsiburada giriş sayfasına git
    await hepsiburadaGirisSayfasinaGit(sayfa);
    
    // 2. ADIM: Önce çerez yükleme denenir (tüm mail tipleri için)
    try {
      if (await cerezleriYukleVeDogrula(sayfa, email)) {
        sonuc.basarili = (await oturumKontroluYap(sayfa, email, log, profilId)).basarili;
        if (sonuc.basarili) {
          await log.kaydet(profilId, 'Çerezlerle giriş başarılı');
          sonuc.ekstraBilgiler.push('Giriş yöntemi: Kayıtlı çerezler');
          return sonuc;
        }
      }
    } catch (hata) {
      await log.kaydet(profilId, `Çerez yükleme başarısız: ${hata.message}`);
    }

    // 3. ADIM: Çerezlerle giriş başarısızsa ve "Farklı hesap kullan" ile maskeli mail varsa
     try {
    await log.kaydet(profilId, 'Çerezlerle giriş başarısız, alternatif yöntem deneniyor');
    
    let farkliHesapButonu;
    try {
      farkliHesapButonu = await sayfa.getByText('Farklı hesap kullan').first();
    } catch {
      farkliHesapButonu = null;
    }

    let maskeliMail;
    try {
      maskeliMail = await sayfa.locator('input[name="EmailMasked"]').first();
    } catch {
      maskeliMail = null;
    }
    
    if (farkliHesapButonu && maskeliMail) {
      await log.kaydet(profilId, '"Farklı hesap kullan" ve maskeli mail bulundu, şifre ile giriş deneniyor');


        
    // 1. Şifre alanını ID ile bul ve şifreyi doldur
    await sayfa.waitForSelector('#txtPassword', { state: 'visible', timeout: 5000 });
    await sayfa.fill('#txtPassword', sifre);  // Şifreyi doldur
    await log.kaydet(profilId, 'Şifre alanı ID ile bulundu ve dolduruldu');

    // 2. Şifreyi doldurduktan sonra 1 saniye bekle
    await sayfa.waitForTimeout(1000);  // 1 saniye bekle (şifreyi doldurduktan sonra)

    // 3. Giriş butonunu bul ve tıkla
    await sayfa.locator('button:has-text("Giriş yap")').click();

    // 4. Giriş butonuna tıklanmasının ardından 3 saniye bekle
    await sayfa.waitForTimeout(3000);  // 3 saniye bekle

    // 5. Sayfa tam olarak yüklendiğini bekle
    await sayfa.waitForLoadState('networkidle', { timeout: 3000 });  // Sayfa tamamen yüklendiğinde işlem tamamlanır
        
        // Oturum kontrolü yap
        sonuc.basarili = (await oturumKontroluYap(sayfa, email, log, profilId)).basarili;
        
        if (sonuc.basarili) {
          await log.kaydet(profilId, 'Şifre ile giriş başarılı, çerezler kaydediliyor');
          
          // Çerezleri kaydet
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

    // 4. ADIM: Yukarıdakiler başarısızsa ve geçici mail/fakemail ise
    if (geciciMailMi(email) || fakemailMi(email)) {
      await log.kaydet(profilId, 'Geçici e-posta/fakemail domaini - sipariş takibi yöntemi deneniyor');
	  
	      // 1. Önce çerezleri temizle
    await sayfa.context().clearCookies();
    await log.kaydet(profilId, 'Çerezler temizlendi');
    
// 2. Hepsiburada giriş sayfasına git
const girisUrl = 'https://giris.hepsiburada.com/?ReturnUrl=https%3A%2F%2Foauth.hepsiburada.com%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3DSPA%26redirect_uri%3Dhttps%253A%252F%252Fwww.hepsiburada.com%252Fuyelik%252Fcallback%26response_type%3Dcode%26scope%3Dopenid%2520profile%26state%3Df883eaadc71d42c8bfe3aa90bc07585a%26code_challenge%3DI4Ihs_2x7BPCMgYoGd7YrazWUqIYgxTzIGMQVovpJfg%26code_challenge_method%3DS256%26response_mode%3Dquery%26customizeSegment%3DORDERS%26ActivePage%3DPURE_LOGIN%26oidcReturnUrl%3D%252Fsiparislerim';

await sayfa.goto(girisUrl, {
    waitUntil: 'networkidle',
    timeout: 30000 // 30 saniye
});
    await log.kaydet(profilId, 'Giriş sayfası yüklendi');
      
      // Giriş işlemlerini yap
      await geciciMailGirisIslemleri(sayfa, email, profilId, log);
      
      // Önce oturum kontrolü yapıyoruz
      sonuc.basarili = (await oturumKontroluYap(sayfa, email, log, profilId)).basarili;
      
      if (sonuc.basarili) {
        await log.kaydet(profilId, 'Geçici mail/fakemail ile giriş başarılı, çerezler kaydediliyor');
        
        // SADECE burada çerezleri kaydediyoruz
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
    
    const screenshotPath = `hata-screenshots/hata-${profilId}-${Date.now()}.png`;
    await sayfa.screenshot({ path: screenshotPath });
    sonuc.ekstraBilgiler.push(`Hata screenshot: ${screenshotPath}`);
  }

  return sonuc;
};
