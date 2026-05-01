require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Health check first ────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

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

// ── Static files ──────────────────────────────────────────
app.use('/css', express.static(path.join(__dirname, 'public/css'), { maxAge: '1d' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────
const superAdminRouter = require('./routes/superAdmin');
const hotelRouter = require('./routes/hotel');
const pushRouter = require('./routes/push');

app.use('/admin', superAdminRouter);
app.use('/push', pushRouter);
app.use('/:hotelSlug', hotelRouter);

// Root — redirect to admin or show hotel list
app.get('/', (req, res) => res.redirect('/admin'));

app.listen(PORT, () => {
  console.log(`🏨 Pocket Reception SaaS running on http://localhost:${PORT}`);
  if (!process.env.SUPABASE_URL) console.warn('   ⚠️  SUPABASE_URL not set');

  try {
    const webpush = require('./lib/push');
    if (webpush.configureWebPush) webpush.configureWebPush();
    const { startCheckoutReminderCron } = require('./lib/cron');
    startCheckoutReminderCron();
  } catch (err) {
    console.warn('⚠️  Push/cron setup:', err.message);
  }
});

module.exports = app;
