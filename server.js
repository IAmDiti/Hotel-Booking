require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const { configureWebPush } = require('./lib/push');
const { ICON_192, ICON_512 } = require('./lib/icons');

const app = express();
const PORT = process.env.PORT || 3000;

configureWebPush();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// ── Public static assets (no auth) ───────────────────────
app.use('/css', express.static(path.join(__dirname, 'public/css')));

// ── Icon routes — served from embedded buffers ────────────
app.get('/icons/icon-192.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(ICON_192);
});
app.get('/icons/icon-512.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(ICON_512);
});
app.get('/icons/apple-touch-icon.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.send(ICON_192);
});

// ── Manifest & SW ─────────────────────────────────────────
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(__dirname, 'public/manifest.json'));
});
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public/sw.js'));
});

// ── Routes ────────────────────────────────────────────────
const authRouter = require('./routes/auth');
const reservationsRouter = require('./routes/reservations');
const roomsRouter = require('./routes/rooms');
const cleanerRouter = require('./routes/cleaner');
const settingsRouter = require('./routes/settings');
const pushRouter = require('./routes/push');

app.use('/', authRouter);
app.use('/reservations', reservationsRouter);
app.use('/rooms', roomsRouter);
app.use('/cleaner', cleanerRouter);
app.use('/settings', settingsRouter);
app.use('/push', pushRouter);

app.get('/', (req, res) => res.redirect('/reservations'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => {
  if (req.path.match(/\.(png|svg|jpg|ico|webp|css|js|json|woff|ttf)$/)) {
    return res.status(404).send('Not found');
  }
  res.status(404).redirect('/reservations');
});

app.listen(PORT, () => {
  console.log(`🏨 Pocket Reception running on http://localhost:${PORT}`);
  if (!process.env.SUPABASE_URL) console.warn('   ⚠️  SUPABASE_URL not set');
  if (!process.env.VAPID_PUBLIC_KEY) console.warn('   ⚠️  VAPID keys not set');
});

module.exports = app;
