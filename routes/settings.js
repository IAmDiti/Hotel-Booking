const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAdmin } = require('../middleware/auth');
const { renderLayout } = require('./layout');

// GET /settings
router.get('/', requireAdmin, async (req, res) => {
  const { data: rooms } = await supabase.from('rooms').select('*').order('number');
  const { data: reservations } = await supabase.from('reservations').select('id').not('status', 'eq', 'cancelled');

  const html = `
    <div class="page-header">
      <h2 class="page-title">Settings</h2>
    </div>

    ${req.query.msg ? `<div class="toast-banner">${req.query.msg}</div>` : ''}

    <div class="section-label">Hotel info</div>
    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Total rooms</span>
        <span class="detail-value">${rooms ? rooms.length : 0}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Active reservations</span>
        <span class="detail-value">${reservations ? reservations.length : 0}</span>
      </div>
    </div>

    <div class="section-label">Manage rooms</div>
    <div class="detail-card">
      ${rooms ? rooms.map(r => `
        <div class="detail-row">
          <span class="detail-label">Room ${r.number} (Floor ${r.floor})</span>
          <span class="badge badge-${r.status}">${r.status}</span>
        </div>
      `).join('') : ''}
    </div>

    <div class="section-label">Add room</div>
    <form method="POST" action="/settings/rooms" class="quick-form" style="background:var(--surface);border:0.5px solid var(--border);border-radius:10px;padding:14px;">
      <div class="field-row-2">
        <div class="field-group">
          <label>Room number</label>
          <input type="text" name="number" placeholder="e.g. 105" required />
        </div>
        <div class="field-group">
          <label>Floor</label>
          <input type="number" name="floor" placeholder="1" min="1" max="20" required />
        </div>
      </div>
      <button type="submit" class="btn-primary btn-full" style="margin-top:8px">Add room</button>
    </form>

    <div class="section-label" style="margin-top:20px">PINs</div>
    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Admin PIN</span>
        <span class="detail-value">Set via ADMIN_PIN env var</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Cleaner PIN</span>
        <span class="detail-value">Set via CLEANER_PIN env var</span>
      </div>
    </div>

    <div class="section-label">App</div>
    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Version</span>
        <span class="detail-value">1.0.0</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Built with</span>
        <span class="detail-value">Node.js + Supabase</span>
      </div>
    </div>

    <script>
      const toast = document.querySelector('.toast-banner');
      if (toast) setTimeout(() => toast.remove(), 3000);
    </script>
  `;

  res.send(renderLayout('Settings', html, 'settings', req.session.role));
});

// POST /settings/rooms — Add a room
router.post('/rooms', requireAdmin, async (req, res) => {
  const { number, floor } = req.body;
  if (!number || !floor) return res.redirect('/settings?msg=Missing+fields');

  const { error } = await supabase.from('rooms').insert({
    number: number.trim(),
    floor: parseInt(floor),
    status: 'free'
  });

  if (error) return res.redirect('/settings?msg=' + encodeURIComponent(error.message));
  res.redirect('/settings?msg=Room+' + number + '+added+✓');
});

module.exports = router;
