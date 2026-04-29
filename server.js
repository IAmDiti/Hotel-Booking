require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const { configureWebPush } = require('./lib/push');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Web Push setup ────────────────────────────────────────
configureWebPush();

// ── Middleware ────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ── Static files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

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

// Home → reservations list
app.get('/', (req, res) => res.redirect('/reservations'));

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).redirect('/reservations');
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🏨 Pocket Reception running on http://localhost:${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  if (!process.env.SUPABASE_URL) console.warn('   ⚠️  SUPABASE_URL not set');
  if (!process.env.VAPID_PUBLIC_KEY) console.warn('   ⚠️  VAPID keys not set — push disabled');
});

module.exports = app;
