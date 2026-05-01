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

// Root — landing page with hotel selection
app.get('/', async (req, res) => {
  const supabase = require('./lib/supabase');
  const { data: hotels } = await supabase
    .from('hotels')
    .select('name, slug')
    .eq('active', true)
    .order('name');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta name="theme-color" content="#1a1a2e">
  <title>Pocket Reception</title>
  <link rel="stylesheet" href="/css/app.css?v=3">
  <style>
    .landing-body { background: #1a1a2e; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .landing-box { background: white; border-radius: 24px; padding: 32px 24px; width: 100%; max-width: 400px; }
    .landing-logo { text-align: center; margin-bottom: 28px; }
    .landing-icon { font-size: 52px; display: block; margin-bottom: 12px; }
    .landing-title { font-size: 22px; font-weight: 800; color: #1a1a2e; margin-bottom: 6px; }
    .landing-sub { font-size: 14px; color: #888; }
    .hotel-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
    .hotel-btn { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: #f6f6f4; border: 1.5px solid #e5e7eb; border-radius: 12px; text-decoration: none; cursor: pointer; transition: all 0.15s; }
    .hotel-btn:active { background: #e5e7eb; transform: scale(0.98); }
    .hotel-btn-icon { width: 44px; height: 44px; background: #1a1a2e; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .hotel-btn-name { font-size: 15px; font-weight: 700; color: #1a1a2e; }
    .hotel-btn-sub { font-size: 12px; color: #888; margin-top: 2px; }
    .admin-link { text-align: center; margin-top: 8px; }
    .admin-link a { font-size: 13px; color: #888; text-decoration: none; padding: 8px 16px; border-radius: 8px; border: 0.5px solid #e5e7eb; display: inline-block; }
    .admin-link a:hover { background: #f6f6f4; }
    .divider { display: flex; align-items: center; gap: 10px; margin: 16px 0; }
    .divider-line { flex: 1; height: 1px; background: #e5e7eb; }
    .divider-text { font-size: 12px; color: #aaa; }
  </style>
</head>
<body class="landing-body">
  <div class="landing-box">
    <div class="landing-logo">
      <span class="landing-icon">🏨</span>
      <h1 class="landing-title">Pocket Reception</h1>
      <p class="landing-sub">Select your hotel to continue</p>
    </div>

    <div class="hotel-list">
      ${(hotels || []).map(h => `
        <a href="/${h.slug}/login" class="hotel-btn">
          <div class="hotel-btn-icon">🏨</div>
          <div>
            <div class="hotel-btn-name">${h.name}</div>
            <div class="hotel-btn-sub">Tap to sign in</div>
          </div>
          <span style="margin-left:auto;color:#aaa;font-size:18px">›</span>
        </a>
      `).join('')}
    </div>

    <div class="divider">
      <div class="divider-line"></div>
      <div class="divider-text">or</div>
      <div class="divider-line"></div>
    </div>

    <div class="admin-link">
      <a href="/admin">⚙️ Super Admin Panel</a>
    </div>
  </div>
</body>
</html>`);
});

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
