import http from 'http';
import { parse } from 'url';
import girisIslemleri from './index.js';
import { chromium } from 'playwright';

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true);

  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server çalışıyor');
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/login') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const data = JSON.parse(body);
        if (!data.email) throw new Error('Email gerekli');

        // Playwright tarayıcı başlat
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          const sonuc = await girisIslemleri({
            sayfa: page,
            log: console,
            profilId: data.email, // email kullanabiliriz ID olarak
            email: data.email,
            sifre: '' // sadece mail ile çalışacağı için boş
          });

          await browser.close();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(sonuc));
        } catch (error) {
          await browser.close();
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ hata: error.message }));
        }
      });
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hata: error.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));
