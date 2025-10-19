const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

let mailList = [
    "deneme1@tempmail.plus",
    "deneme2@tempmail.plus"
];
let index = 0;

app.get('/getMail', (req, res) => {
    if (index >= mailList.length) index = 0;
    const mail = mailList[index++];
    res.json({ email: mail });
});

app.listen(port, () => {
    console.log(`Mail serveri çalışıyor: http://localhost:${port}`);
});
