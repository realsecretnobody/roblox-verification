// index.js — your Express server
const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config(); // ✅ Load env variables

const app = express();

/* ---------- STATIC FILES ---------- */
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- ROOT PAGE ------------ */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ---------- /verify ROUTE -------- */
app.get('/verify', (req, res) => {
  const { ROBLOX_CLIENT_ID, ROBLOX_REDIRECT_URI } = process.env;

  if (!ROBLOX_CLIENT_ID || !ROBLOX_REDIRECT_URI) {
    return res.status(500).send('OAuth2 environment variables are missing.');
  }

  const authURL = `https://apis.roblox.com/oauth/v1/authorize` +
    `?client_id=${ROBLOX_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(ROBLOX_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=openid`;

  res.redirect(authURL);
});

/* ---------- /roblox-callback ----- */
app.get('/roblox-callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing ?code from Roblox');

  try {
    const {
      ROBLOX_CLIENT_ID,
      ROBLOX_CLIENT_SECRET,
      ROBLOX_REDIRECT_URI
    } = process.env;

    // 1. Exchange code for access token
    const tokenRes = await axios.post(
      'https://apis.roblox.com/oauth/v1/token',
      new URLSearchParams({
        client_id: ROBLOX_CLIENT_ID,
        client_secret: ROBLOX_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: ROBLOX_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // 2. Get user info
    const userRes = await axios.get(
      'https://apis.roblox.com/oauth/v1/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const { sub: robloxId, name: robloxUsername } = userRes.data;

    res.send(`<h2>✅ Verified as ${robloxUsername} (ID: ${robloxId})</h2>`);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send('OAuth2 flow failed.');
  }
});

/* ---------- START SERVER --------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Verification site running on port ${PORT}`);
});