const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();

const app = express();

/* ---------- SESSION SETUP -------- */
app.use(session({
  secret: 'ErlcMajor',
  resave: false,
  saveUninitialized: true,
}));

/* ---------- STATIC FILES ---------- */
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- ROOT PAGE ------------ */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ---------- DISCORD LOGIN -------- */
app.get('/discord-login', (req, res) => {
  const { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI } = process.env;

  if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
    return res.status(500).send('Discord OAuth environment variables missing.');
  }

  const discordAuthURL = `https://discord.com/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${DISCORD_CLIENT_ID}` +
    `&scope=identify` +
    `&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}`;

  res.redirect(discordAuthURL);
});

/* ---------- DISCORD CALLBACK ------ */
app.get('/discord-callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing Discord code.');

  try {
    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } = process.env;

    // Exchange code for token
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Get user info
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const discordUser = userRes.data;

    // Store Discord user in session
    req.session.discordUser = discordUser;

    // Redirect to Roblox verify now that Discord is done
    res.redirect('/verify');
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send('Discord OAuth failed.');
  }
});

/* ---------- ROBLOX VERIFY -------- */
app.get('/verify', (req, res) => {
  if (!req.session.discordUser) {
    // Force Discord verification first
    return res.redirect('/discord-login');
  }

  const { ROBLOX_CLIENT_ID, ROBLOX_REDIRECT_URI } = process.env;

  if (!ROBLOX_CLIENT_ID || !ROBLOX_REDIRECT_URI) {
    return res.status(500).send('Roblox OAuth environment variables missing.');
  }

  const authURL = `https://apis.roblox.com/oauth/v1/authorize` +
    `?client_id=${ROBLOX_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(ROBLOX_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=openid profile`;

  res.redirect(authURL);
});

/* ---------- ROBLOX CALLBACK ------ */
app.get('/roblox-callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing Roblox code.');

  if (!req.session.discordUser) {
    // Somehow Roblox callback hit without Discord verified? Redirect back.
    return res.redirect('/discord-login');
  }

  try {
    const {
      ROBLOX_CLIENT_ID,
      ROBLOX_CLIENT_SECRET,
      ROBLOX_REDIRECT_URI
    } = process.env;

    // Exchange code for access token
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

    // Get Roblox user info
    const userRes = await axios.get(
      'https://apis.roblox.com/oauth/v1/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const { sub: robloxId, name: robloxUsername } = userRes.data;

    // You now have both Discord and Roblox user info
    // For example, respond with JSON or redirect to verified page
    res.send({
      message: 'Verification complete!',
      discordUser: req.session.discordUser,
      robloxUser: { id: robloxId, username: robloxUsername }
    });

  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send('Roblox OAuth failed.');
  }
});

/* ---------- START SERVER --------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
