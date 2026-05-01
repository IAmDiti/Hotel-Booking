const express = require('express');
const router = express.Router({ mergeParams: true });
const supabase = require('../lib/supabase');
const { requireAdmin } = require('../middleware/auth');
const { renderLayout } = require('./layout');

// GET /settings — super admin only
router.get('/', requireAdmin, async (req, res) => {
  if (!req.session.superAdmin) {
    return res.redirect(`/${req.hotel.slug}/reservations`);
  }
  const hotel = req.hotel;
  const { data: rooms } = await supabase.from('rooms').select('*').eq('hotel_id', hotel.id).order('number');

  const msg = req.query.msg || null;
  const err = req.query.error || null;

  const html = `
    ${msg ? `<div class="toast-banner">${msg}</div>` : ''}
    ${err ? `<div class="toast-banner toast-error">${err}</div>` : ''}

    <div class="page-header">
      <h2 class="page-title">Settings</h2>
    </div>

    <!-- Hotel info -->
    <div class="section-label">Hotel information</div>
    <form method="POST" action="/${hotel.slug}/settings/info">
      <div class="detail-card" style="padding:14px">
        <div class="field-group">
          <label>Hotel name</label>
          <input type="text" name="name" value="${hotel.name}" required />
        </div>
        <div class="field-row-2">
          <div class="field-group">
            <label>WiFi name</label>
            <input type="text" name="wifi_name" value="${hotel.wifi_name || ''}" />
          </div>
          <div class="field-group">
            <label>WiFi password</label>
            <input type="text" name="wifi_password" value="${hotel.wifi_password || ''}" />
          </div>
        </div>
        <div class="field-row-2">
          <div class="field-group">
            <label>Check-out time</label>
            <input type="text" name="checkout_time" value="${hotel.checkout_time || '11:00'}" placeholder="11:00" />
          </div>
          <div class="field-group">
            <label>Restaurant hours</label>
            <input type="text" name="restaurant_hours" value="${hotel.restaurant_hours || ''}" placeholder="07:00-23:00" />
          </div>
        </div>
        <div class="field-group">
          <label>Extra info for guests</label>
          <input type="text" name="extra_info" value="${hotel.extra_info || ''}" placeholder="e.g. Pool open 08:00-21:00" />
        </div>
        <button type="submit" class="btn-primary btn-full">Save hotel info</button>
      </div>
    </form>

    <!-- PINs -->
    <div class="section-label">Access PINs</div>
    <form method="POST" action="/${hotel.slug}/settings/pins">
      <div class="detail-card" style="padding:14px">
        <div class="field-row-2">
          <div class="field-group">
            <label>Admin PIN</label>
            <input type="text" name="admin_pin" value="${hotel.admin_pin}" maxlength="8" pattern="[0-9]+" required />
          </div>
          <div class="field-group">
            <label>Cleaner PIN</label>
            <input type="text" name="cleaner_pin" value="${hotel.cleaner_pin}" maxlength="8" pattern="[0-9]+" required />
          </div>
        </div>
        <button type="submit" class="btn-primary btn-full">Update PINs</button>
      </div>
    </form>

    <!-- WhatsApp / Twilio -->
    <div class="section-label">WhatsApp (Twilio)</div>
    <form method="POST" action="/${hotel.slug}/settings/twilio">
      <div class="detail-card" style="padding:14px">
        <div class="field-group">
          <label>Account SID</label>
          <input type="text" name="twilio_account_sid" value="${hotel.twilio_account_sid || ''}" placeholder="ACxxxxxxxx" />
        </div>
        <div class="field-group">
          <label>Auth Token</label>
          <input type="password" name="twilio_auth_token" value="${hotel.twilio_auth_token || ''}" placeholder="••••••••" />
        </div>
        <div class="field-group">
          <label>WhatsApp From number</label>
          <input type="text" name="twilio_whatsapp_from" value="${hotel.twilio_whatsapp_from || ''}" placeholder="+14155238886" />
        </div>
        <button type="submit" class="btn-primary btn-full">Save WhatsApp settings</button>
      </div>
    </form>

    <!-- Rooms -->
    <div class="section-label">Rooms (${rooms?.length || 0})</div>
    <div class="detail-card">
      ${rooms?.map(r => `
        <div class="detail-row">
          <span class="detail-label">Room ${r.number} · Floor ${r.floor}</span>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge badge-${r.status}">${r.status}</span>
            <form method="POST" action="/${hotel.slug}/settings/rooms/${r.id}/delete" onsubmit="return confirm('Delete room ${r.number}?')">
              <button type="submit" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer">✕</button>
            </form>
          </div>
        </div>
      `).join('') || '<div style="padding:12px 14px;color:var(--text-muted);font-size:13px">No rooms yet</div>'}
    </div>

    <!-- Add room -->
    <form method="POST" action="/${hotel.slug}/settings/rooms">
      <div class="detail-card" style="padding:14px;margin-top:8px">
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
        <button type="submit" class="btn-primary btn-full">Add room</button>
      </div>
    </form>

    <script>
      const toast = document.querySelector('.toast-banner');
      if (toast) setTimeout(() => toast.remove(), 3000);
    </script>
  `;

  res.send(renderLayout('Settings', html, 'settings', req.session.role, hotel));
});

// POST /settings/info
router.post('/info', requireAdmin, async (req, res) => {
  const { name, wifi_name, wifi_password, checkout_time, restaurant_hours, extra_info } = req.body;
  await supabase.from('hotels').update({ name, wifi_name, wifi_password, checkout_time, restaurant_hours, extra_info }).eq('id', req.hotel.id);
  res.redirect(`/${req.hotel.slug}/settings?msg=Hotel+info+saved+✓`);
});

// POST /settings/pins
router.post('/pins', requireAdmin, async (req, res) => {
  const { admin_pin, cleaner_pin } = req.body;
  if (admin_pin === cleaner_pin) return res.redirect(`/${req.hotel.slug}/settings?error=PINs+must+be+different`);
  await supabase.from('hotels').update({ admin_pin, cleaner_pin }).eq('id', req.hotel.id);
  res.redirect(`/${req.hotel.slug}/settings?msg=PINs+updated+✓`);
});

// POST /settings/twilio
router.post('/twilio', requireAdmin, async (req, res) => {
  const { twilio_account_sid, twilio_auth_token, twilio_whatsapp_from } = req.body;
  await supabase.from('hotels').update({ twilio_account_sid, twilio_auth_token, twilio_whatsapp_from }).eq('id', req.hotel.id);
  res.redirect(`/${req.hotel.slug}/settings?msg=WhatsApp+settings+saved+✓`);
});

// POST /settings/rooms
router.post('/rooms', requireAdmin, async (req, res) => {
  const { number, floor } = req.body;
  const { error } = await supabase.from('rooms').insert({ hotel_id: req.hotel.id, number: number.trim(), floor: parseInt(floor), status: 'free' });
  if (error) return res.redirect(`/${req.hotel.slug}/settings?error=${encodeURIComponent(error.message)}`);
  res.redirect(`/${req.hotel.slug}/settings?msg=Room+${number}+added+✓`);
});

// POST /settings/rooms/:id/delete
router.post('/rooms/:id/delete', requireAdmin, async (req, res) => {
  await supabase.from('rooms').delete().eq('id', req.params.id).eq('hotel_id', req.hotel.id);
  res.redirect(`/${req.hotel.slug}/settings?msg=Room+deleted`);
});


// Protect all POST routes in settings
router.use((req, res, next) => {
  if (!req.session.superAdmin) {
    return res.redirect(`/${req.hotel.slug}/reservations`);
  }
  next();
});

module.exports = router;