const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('OK');
});

app.get('/callback', (req, res) => {
  res.send('Discord OAuth Success');
});

app.listen(3000, () => console.log('Server running'));
