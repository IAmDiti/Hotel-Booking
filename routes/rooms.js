const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAdmin } = require('../middleware/auth');
const { renderLayout } = require('./layout');

// ── GET /rooms — Room board ─────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*')
    .order('number');

  if (error) return res.send(renderLayout('Rooms', `<p class="error-msg">${error.message}</p>`, 'rooms', 'admin'));

  const free = rooms.filter(r => r.status === 'free').length;
  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const dirty = rooms.filter(r => r.status === 'dirty').length;

  const html = `
    <div class="page-header">
      <h2 class="page-title">Room board</h2>
    </div>

    <div class="stats-row">
      <div class="stat-chip stat-free">
        <span class="stat-num">${free}</span>
        <span class="stat-label">Free</span>
      </div>
      <div class="stat-chip stat-occupied">
        <span class="stat-num">${occupied}</span>
        <span class="stat-label">Occupied</span>
      </div>
      <div class="stat-chip stat-dirty">
        <span class="stat-num">${dirty}</span>
        <span class="stat-label">Dirty</span>
      </div>
    </div>

    ${req.query.msg ? `<div class="toast-banner">${req.query.msg}</div>` : ''}

    <div class="filter-row">
      <button class="filter-chip active" data-filter="all" onclick="setFilter('all', this)">All</button>
      <button class="filter-chip" data-filter="free" onclick="setFilter('free', this)">Free</button>
      <button class="filter-chip" data-filter="occupied" onclick="setFilter('occupied', this)">Occupied</button>
      <button class="filter-chip" data-filter="dirty" onclick="setFilter('dirty', this)">Dirty</button>
    </div>

    <div class="rooms-grid" id="rooms-grid">
      ${rooms.map(r => roomTile(r)).join('')}
    </div>

    <script>
      function setFilter(f, btn) {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.room-tile').forEach(tile => {
          tile.style.display = (f === 'all' || tile.dataset.status === f) ? '' : 'none';
        });
      }
      const toast = document.querySelector('.toast-banner');
      if (toast) setTimeout(() => toast.remove(), 3000);
    </script>
  `;

  res.send(renderLayout('Rooms', html, 'rooms', req.session.role));
});

// ── GET /rooms/:id — Room detail / status change ────────────
router.get('/:id', requireAdmin, async (req, res) => {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !room) return res.redirect('/rooms');

  // Get current guest if occupied
  let currentRes = null;
  if (room.status === 'occupied') {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('room_id', room.id)
      .eq('status', 'checked_in')
      .single();
    currentRes = data;
  }

  // Upcoming reservations for this room
  const { data: upcoming } = await supabase
    .from('reservations')
    .select('*')
    .eq('room_id', room.id)
    .in('status', ['confirmed', 'pending'])
    .gte('check_in', new Date().toISOString().split('T')[0])
    .order('check_in')
    .limit(5);

  const html = `
    <div class="page-header">
      <a href="/rooms" class="back-link">← Rooms</a>
    </div>

    ${req.query.msg ? `<div class="toast-banner">${req.query.msg}</div>` : ''}

    <div class="room-hero room-hero-${room.status}">
      <div class="room-hero-num">${room.number}</div>
      <div class="room-hero-info">
        <div class="room-hero-status">${room.status.charAt(0).toUpperCase() + room.status.slice(1)}</div>
        <div class="room-hero-floor">Floor ${room.floor}</div>
      </div>
    </div>

    ${currentRes ? `
      <div class="detail-card" style="margin-bottom:12px">
        <div class="section-label" style="padding:12px 14px 4px;margin:0">Current guest</div>
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${currentRes.guest_name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Check-out</span>
          <span class="detail-value">${currentRes.check_out}</span>
        </div>
        <div class="detail-row" style="border:none;padding-bottom:12px">
          <a href="/reservations/${currentRes.id}" class="link-btn">View reservation →</a>
        </div>
      </div>
    ` : ''}

    <div class="section-label">Change status</div>
    <div class="status-actions">
      ${room.status !== 'free' ? `
        <form method="POST" action="/rooms/${room.id}/status">
          <input type="hidden" name="status" value="free" />
          <button type="submit" class="status-btn status-btn-free">Mark as Free</button>
        </form>
      ` : ''}
      ${room.status !== 'occupied' ? `
        <form method="POST" action="/rooms/${room.id}/status">
          <input type="hidden" name="status" value="occupied" />
          <button type="submit" class="status-btn status-btn-occupied">Mark as Occupied</button>
        </form>
      ` : ''}
      ${room.status !== 'dirty' ? `
        <form method="POST" action="/rooms/${room.id}/status">
          <input type="hidden" name="status" value="dirty" />
          <button type="submit" class="status-btn status-btn-dirty">Mark as Dirty</button>
        </form>
      ` : ''}
    </div>

    ${upcoming && upcoming.length > 0 ? `
      <div class="section-label" style="margin-top:20px">Upcoming</div>
      ${upcoming.map(r => `
        <a href="/reservations/${r.id}" class="res-card" style="margin-bottom:8px">
          <div class="res-avatar">${r.guest_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
          <div class="res-info">
            <div class="res-name">${r.guest_name}</div>
            <div class="res-meta">${r.check_in} → ${r.check_out}</div>
          </div>
          <span class="badge badge-${r.status}">${r.status}</span>
        </a>
      `).join('')}
    ` : ''}

    <script>
      const toast = document.querySelector('.toast-banner');
      if (toast) setTimeout(() => toast.remove(), 3000);
    </script>
  `;

  res.send(renderLayout('Room ' + room.number, html, 'rooms', req.session.role));
});

// ── POST /rooms/:id/status — Update room status ─────────────
router.post('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['free', 'occupied', 'dirty'];
  if (!validStatuses.includes(status)) return res.redirect('/rooms');

  await supabase.from('rooms').update({ status }).eq('id', req.params.id);
  res.redirect('/rooms?msg=Room+updated+✓');
});

// ── Helpers ────────────────────────────────────────────────
function roomTile(r) {
  return `
    <a href="/rooms/${r.id}" class="room-tile room-tile-${r.status}" data-status="${r.status}">
      <div class="room-tile-num">${r.number}</div>
      <div class="room-tile-status">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</div>
      <div class="room-tile-floor">Floor ${r.floor}</div>
    </a>
  `;
}

module.exports = router;
