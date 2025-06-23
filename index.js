const express = require('express');
const path = require('path');
const app = express();
require('dotenv').config(); // ✅ Load your .env variables

app.use(express.static(path.join(__dirname, 'public')));

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Add the /verify route
app.get('/verify', (req, res) => {
  const { ROBLOX_CLIENT_ID, ROBLOX_REDIRECT_URI } = process.env;

  if (!ROBLOX_CLIENT_ID || !ROBLOX_REDIRECT_URI) {
    return res.status(500).send('Missing Roblox OAuth credentials');
  }

  const authURL = `https://apis.roblox.com/oauth/v1/authorize` +
    `?client_id=${ROBLOX_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(ROBLOX_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=openid`;

  res.redirect(authURL);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Verification site running on port ${PORT}`);
});