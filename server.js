require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const { configureWebPush } = require('./lib/push');
const { startCheckoutReminderCron } = require('./lib/cron');

const app = express();
const PORT = process.env.PORT || 3000;

configureWebPush();
startCheckoutReminderCron();

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

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

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
app.use((req, res) => res.status(404).redirect('/reservations'));

app.listen(PORT, () => {
  console.log(`🏨 Pocket Reception running on http://localhost:${PORT}`);
  if (!process.env.SUPABASE_URL) console.warn('   ⚠️  SUPABASE_URL not set');
  if (!process.env.TWILIO_AUTH_TOKEN) console.warn('   ⚠️  Twilio not set — WhatsApp disabled');
});

module.exports = app;
