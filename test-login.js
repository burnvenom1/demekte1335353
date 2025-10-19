const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/login';
const testData = {
  email: 'test@example.com',
  sifre: 'password123',
  profilId: 'test123'
};

fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
