const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { saveSubscription, removeSubscription } = require('../lib/push');

// POST /push/subscribe — save subscription for current session role
router.post('/subscribe', requireAuth, async (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ ok: false, error: 'Invalid subscription' });
  }

  const role = req.session.role; // 'admin' or 'cleaner'
  const ok = await saveSubscription(role, subscription);
  res.json({ ok });
});

// POST /push/unsubscribe — remove subscription
router.post('/unsubscribe', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) await removeSubscription(endpoint);
  res.json({ ok: true });
});

// GET /push/vapid-public-key — client needs this to subscribe
router.get('/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

module.exports = router;
