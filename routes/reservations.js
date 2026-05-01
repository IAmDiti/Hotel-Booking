const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAdmin } = require('../middleware/auth');
const { renderLayout } = require('./layout');
const { sendWelcome } = require('../lib/whatsapp');

// ── GET / — Reservations list (home) ──────────────────────
router.get('/', requireAdmin, async (req, res) => {
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('*, rooms(number)')
    .eq('hotel_id', req.hotel.id)
    .not('status', 'eq', 'cancelled')
    .order('check_in', { ascending: true });

  if (error) return res.send(renderLayout('Error', `<p class="error-msg">${error.message}</p>`, 'reservations', 'admin'));

  const upcoming = reservations.filter(r => r.status !== 'checked_out');
  const checkedOut = reservations.filter(r => r.status === 'checked_out');

  const html = `
    <div class="page-header">
      <h2 class="page-title">Bookings</h2>
      <button class="fab-inline" onclick="openQuickAdd()">+ New</button>
    </div>

    <!-- Quick Add Drawer -->
    <div class="drawer" id="quick-add-drawer">
      <div class="drawer-inner">
        <div class="drawer-header">
          <span class="drawer-title">New reservation</span>
          <button class="drawer-close" onclick="closeQuickAdd()">×</button>
        </div>
        <form method="POST" action="/reservations" class="quick-form">
          <div class="field-group">
            <label>Guest name</label>
            <input type="text" name="guest_name" placeholder="e.g. Marco Rossi" required autocomplete="off" autocapitalize="words" />
          </div>
          <div class="field-row-2">
            <div class="field-group">
              <label>Check-in</label>
              <input type="date" name="check_in" id="checkin" required />
            </div>
            <div class="field-group">
              <label>Check-out</label>
              <input type="date" name="check_out" id="checkout" required />
            </div>
          </div>
          <div class="field-group">
            <label>Phone (WhatsApp)</label>
            <input type="tel" name="phone" placeholder="e.g. +38970123456" autocomplete="off" />
          </div>
          <div class="field-group">
            <label>Notes (optional)</label>
            <input type="text" name="notes" placeholder="e.g. 2 adults, late arrival" autocomplete="off" />
          </div>
          <button type="submit" class="btn-primary btn-full">Save reservation</button>
        </form>
      </div>
    </div>
    <div class="drawer-overlay" id="drawer-overlay" onclick="closeQuickAdd()"></div>

    ${req.query.saved ? '<div class="toast-banner">Reservation saved ✓</div>' : ''}
    ${req.query.error ? `<div class="toast-banner toast-error">${req.query.error}</div>` : ''}

    <div class="res-list">
      ${upcoming.length === 0 ? '<div class="empty-state"><div class="empty-icon">📋</div><p>No upcoming reservations.<br>Tap "+ New" to add one.</p></div>' : ''}
      ${upcoming.map(r => reservationCard(r, req.hotel.slug)).join('')}
    </div>

    ${checkedOut.length > 0 ? `
      <div class="section-label" style="margin-top:20px">Recently checked out</div>
      <div class="res-list">
        ${checkedOut.slice(0, 5).map(r => reservationCard(r, req.hotel.slug)).join('')}
      </div>
    ` : ''}

    <script>
      // Set default dates
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      document.getElementById('checkin').value = today;
      document.getElementById('checkout').value = tomorrow;

      function openQuickAdd() {
        document.getElementById('quick-add-drawer').classList.add('open');
        document.getElementById('drawer-overlay').classList.add('open');
        setTimeout(() => document.querySelector('[name=guest_name]').focus(), 200);
      }
      function closeQuickAdd() {
        document.getElementById('quick-add-drawer').classList.remove('open');
        document.getElementById('drawer-overlay').classList.remove('open');
      }

      // Auto-dismiss toast
      const toast = document.querySelector('.toast-banner');
      if (toast) setTimeout(() => toast.remove(), 3000);
    </script>
  `;

  res.send(renderLayout('Bookings', html, 'reservations', req.session.role, req.hotel));
});

// ── POST /reservations — Create reservation ────────────────
router.post('/', requireAdmin, async (req, res) => {
  const { guest_name, check_in, check_out, notes, phone } = req.body;

  if (!guest_name || !check_in || !check_out) {
    return res.redirect(`/${req.hotel.slug}/reservations?error=Missing+required+fields`);
  }
  if (check_out <= check_in) {
    return res.redirect(`/${req.hotel.slug}/reservations?error=Check-out+must+be+after+check-in`);
  }

  const { error } = await supabase.from('reservations').insert({
    hotel_id: req.hotel.id,
    guest_name: guest_name.trim(),
    check_in,
    check_out,
    notes: notes?.trim() || null,
    phone: phone?.trim() || null,
    status: 'pending'
  });

  if (error) return res.redirect(`/${req.hotel.slug}/reservations?error=${encodeURIComponent(error.message)}`);
  res.redirect(`/${req.hotel.slug}/reservations?saved=1`);
});

// ── GET /reservations/:id — Reservation detail ─────────────
router.get('/:id', requireAdmin, async (req, res) => {
  const { data: r, error } = await supabase
    .from('reservations')
    .select('*, rooms(id, number, floor, status)')
    .eq('hotel_id', req.hotel.id)
    .eq('id', req.params.id)
    .single();

  if (error || !r) return res.redirect(`/${req.hotel.slug}/reservations`);

  // Run conflict check and room fetch IN PARALLEL
  let availableRooms = [];
  if (r.status === 'pending' || r.status === 'confirmed') {
    const [{ data: conflicts }, { data: allRooms }] = await Promise.all([
      supabase.from('reservations').select('room_id')
        .eq('hotel_id', req.hotel.id)
        .lt('check_in', r.check_out).gt('check_out', r.check_in)
        .in('status', ['confirmed', 'checked_in'])
        .not('room_id', 'is', null).neq('id', r.id),
      supabase.from('rooms').select('id, number, floor, status').eq('hotel_id', req.hotel.id).order('number')
    ]);
    const takenIds = (conflicts || []).map(c => c.room_id).filter(Boolean);
    availableRooms = (allRooms || []).filter(room =>
      !takenIds.includes(room.id) && room.status !== 'occupied'
    );
  }

  const nights = Math.round((new Date(r.check_out) - new Date(r.check_in)) / 86400000);

  const html = `
    <div class="page-header">
      <a href="/reservations" class="back-link">← Bookings</a>
    </div>

    ${req.query.msg ? `<div class="toast-banner">${req.query.msg}</div>` : ''}

    <div class="guest-hero">
      <div class="guest-avatar">${initials(r.guest_name)}</div>
      <div class="guest-hero-info">
        <h2 class="guest-name">${r.guest_name}</h2>
        <p class="guest-dates">${fmtDate(r.check_in)} → ${fmtDate(r.check_out)} · ${nights} night${nights !== 1 ? 's' : ''}</p>
      </div>
    </div>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="badge badge-${r.status}">${statusLabel(r.status)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Room</span>
        <span class="detail-value">${r.rooms ? 'Room ' + r.rooms.number : '—'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Check-in</span>
        <span class="detail-value">${r.check_in}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Check-out</span>
        <span class="detail-value">${r.check_out}</span>
      </div>
      ${r.phone ? `<div class="detail-row"><span class="detail-label">📱 WhatsApp</span><span class="detail-value">${r.phone}</span></div>` : ''}
      ${r.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${r.notes}</span></div>` : ''}
    </div>

    <!-- ACTIONS -->
    <div class="actions-section">
      ${actionsHtml(r, availableRooms, req.hotel.slug)}
    </div>

    <!-- Danger zone -->
    <div class="danger-zone">
      <form method="POST" action="/${req.hotel.slug}/reservations/${r.id}/cancel" onsubmit="return confirm('Cancel this reservation?')">
        <button type="submit" class="btn-ghost-danger">Cancel reservation</button>
      </form>
    </div>

    <script>
      const toast = document.querySelector('.toast-banner');
      if (toast) setTimeout(() => toast.remove(), 3000);
    </script>
  `;

  res.send(renderLayout(r.guest_name, html, 'reservations', req.session.role, req.hotel));
});

// ── POST /reservations/:id/assign — Assign room ────────────
router.post('/:id/assign', requireAdmin, async (req, res) => {
  const { room_id } = req.body;
  const { data: r } = await supabase.from('reservations').select('*').eq('id', req.params.id).single();
  if (!r) return res.redirect('/');

  // Check no overlap
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id')
    .lt('check_in', r.check_out)
    .gt('check_out', r.check_in)
    .in('status', ['confirmed', 'checked_in'])
    .eq('room_id', room_id)
    .neq('id', r.id);

  if (conflicts && conflicts.length > 0) {
    return res.redirect(`/${req.hotel.slug}/reservations/${r.id}?msg=Room+already+taken+for+these+dates`);
  }

  await supabase.from('reservations').update({ room_id, status: 'confirmed' }).eq('id', r.id);
  res.redirect(`/${req.hotel.slug}/reservations/${r.id}?msg=Room+assigned+✓`);
});

// ── POST /reservations/:id/checkin ─────────────────────────
router.post('/:id/checkin', requireAdmin, async (req, res) => {
  const { data: r } = await supabase.from('reservations').select('*, rooms(number)').eq('hotel_id', req.hotel.id).eq('id', req.params.id).single();
  if (!r || !r.room_id) return res.redirect(`/${req.hotel.slug}/reservations/${req.params.id}?msg=Assign+a+room+first`);

  await supabase.from('reservations').update({ status: 'checked_in' }).eq('id', r.id);
  await supabase.from('rooms').update({ status: 'occupied' }).eq('id', r.room_id);

  // Send WhatsApp welcome message
  if (r.phone) {
    const roomNum = r.rooms ? r.rooms.number : r.room_id;
    sendWelcome(req.hotel, r.guest_name, r.phone, roomNum);
  }

  res.redirect(`/${req.hotel.slug}/reservations/${r.id}?msg=Checked+in+✓`);
});

// ── POST /reservations/:id/checkout ───────────────────────
router.post('/:id/checkout', requireAdmin, async (req, res) => {
  const { data: r } = await supabase.from('reservations').select('*').eq('id', req.params.id).single();
  if (!r) return res.redirect('/');

  await supabase.from('reservations').update({ status: 'checked_out' }).eq('id', r.id);
  if (r.room_id) {
    await supabase.from('rooms').update({ status: 'dirty' }).eq('id', r.room_id);
    // Get room number for notification
    const { data: room } = await supabase.from('rooms').select('number').eq('id', r.room_id).single();
    const roomNum = room ? room.number : '?';
    sendPushToRole('cleaner', {
      title: '🧹 Room needs cleaning',
      body: `Room ${roomNum} is ready to be cleaned`,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      vibrate: [200, 100, 200],
      data: { url: '/cleaner' }
    });
  }

  res.redirect(`/${req.hotel.slug}/reservations/${r.id}?msg=Checked+out+—+room+marked+dirty`);
});

// ── POST /reservations/:id/cancel ─────────────────────────
router.post('/:id/cancel', requireAdmin, async (req, res) => {
  const { data: r } = await supabase.from('reservations').select('*').eq('id', req.params.id).single();
  if (!r) return res.redirect('/');

  await supabase.from('reservations').update({ status: 'cancelled', room_id: null }).eq('id', r.id);
  if (r.room_id) {
    // Free the room if it was occupied by this reservation
    const { data: room } = await supabase.from('rooms').select('*').eq('id', r.room_id).single();
    if (room && room.status === 'occupied') {
      await supabase.from('rooms').update({ status: 'free' }).eq('id', r.room_id);
    }
  }

  res.redirect(`/${req.hotel.slug}/reservations?msg=Reservation+cancelled`);
});

// ── Helpers ────────────────────────────────────────────────
function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmtDate(d) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

function statusLabel(s) {
  return { pending: 'Pending', confirmed: 'Confirmed', checked_in: 'Checked in', checked_out: 'Checked out', cancelled: 'Cancelled' }[s] || s;
}

function reservationCard(r, slug) {
  return `
    <a href="/${slug}/reservations/${r.id}" class="res-card">
      <div class="res-avatar">${initials(r.guest_name)}</div>
      <div class="res-info">
        <div class="res-name">${r.guest_name}</div>
        <div class="res-meta">${fmtDate(r.check_in)} → ${fmtDate(r.check_out)}${r.rooms ? ' · Room ' + r.rooms.number : ' · No room'}</div>
      </div>
      <span class="badge badge-${r.status}">${statusLabel(r.status)}</span>
    </a>
  `;
}

function actionsHtml(r, availableRooms, slug) {
  if (r.status === 'pending') {
    if (availableRooms.length === 0) {
      return `<p class="no-rooms-msg">No free rooms for these dates.</p>`;
    }
    return `
      <div class="section-label">Assign a room</div>
      <div class="room-picker">
        ${availableRooms.map(room => `
          <form method="POST" action="/${req.hotel.slug}/reservations/${r.id}/assign">
            <input type="hidden" name="room_id" value="${room.id}" />
            <button type="submit" class="room-pick-btn">
              <span class="room-pick-num">${room.number}</span>
              <span class="room-pick-floor">Floor ${room.floor}</span>
            </button>
          </form>
        `).join('')}
      </div>
    `;
  }

  if (r.status === 'confirmed') {
    return `
      <div class="section-label">Actions</div>
      <form method="POST" action="/${req.hotel.slug}/reservations/${r.id}/checkin">
        <button type="submit" class="btn-primary btn-full btn-large">Check in →</button>
      </form>
      <div class="section-label" style="margin-top:12px">Change room</div>
      <div class="room-picker">
        ${availableRooms.map(room => `
          <form method="POST" action="/${req.hotel.slug}/reservations/${r.id}/assign">
            <input type="hidden" name="room_id" value="${room.id}" />
            <button type="submit" class="room-pick-btn">
              <span class="room-pick-num">${room.number}</span>
              <span class="room-pick-floor">Floor ${room.floor}</span>
            </button>
          </form>
        `).join('')}
      </div>
    `;
  }

  if (r.status === 'checked_in') {
    return `
      <form method="POST" action="/${req.hotel.slug}/reservations/${r.id}/checkout" onsubmit="return confirm('Check out ${r.guest_name}?')">
        <button type="submit" class="btn-warning btn-full btn-large">Check out →</button>
      </form>
    `;
  }

  return '';
}

module.exports = router;
