const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const hepsiburadaLogin = require('./hepsiburada-login');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/login', async (req, res) => {
  const { email, sifre, profilId } = req.body;

  const log = {
    kaydet: async (id, mesaj) => console.log(`[${id}] ${mesaj}`)
  };

  try {
    const sonuc = await hepsiburadaLogin({ sayfa: null, log, profilId, email, sifre });
    res.json(sonuc);
  } catch (hata) {
    res.status(500).json({ basarili: false, hata: hata.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});
