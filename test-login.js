const playwright = require('playwright');
const hepsiburadaLogin = require('./hepsiburada-login');

(async () => {
    const browser = await playwright.chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const log = {
        kaydet: async (profilId, mesaj) => console.log(`[${profilId}] ${mesaj}`)
    };

    const profilId = 'test-profil';
    const sifre = 'Sifre123';

    const sonuc = await hepsiburadaLogin({ sayfa: page, log, profilId, sifre });
    console.log('Giriş sonucu:', sonuc);

    await browser.close();
})();
