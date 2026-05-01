const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAdmin } = require('../middleware/auth');
const { renderLayout } = require('./layout');

// ── GET /rooms — Room board ─────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  const { checkIn, checkOut } = req.query;

  // Run rooms fetch + optional availability check in parallel
  const queries = [supabase.from('rooms').select('*').order('number')];
  if (checkIn && checkOut && checkOut > checkIn) {
    queries.push(
      supabase.from('reservations').select('room_id')
        .lt('check_in', checkOut)
        .gt('check_out', checkIn)
        .in('status', ['confirmed', 'checked_in'])
        .not('room_id', 'is', null)
    );
  }

  const results = await Promise.all(queries);
  const rooms = results[0].data || [];

  // bookedIds: rooms that have an overlapping active reservation
  // A reservation checking OUT on the search checkIn date does NOT overlap (gt not gte)
  // So same-day turnover is correctly allowed by the SQL query
  let bookedIds = null;
  if (results[1]) {
    bookedIds = (results[1].data || []).map(r => r.room_id).filter(Boolean);
  }

  const free = rooms.filter(r => r.status === 'free').length;
  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const dirty = rooms.filter(r => r.status === 'dirty').length;

  // Fetch rooms whose current guest checks out exactly on search checkIn
  // These are 'occupied' rooms but SHOULD show as available (same-day turnover)
  let checkoutTodayIds = [];
  if (bookedIds !== null && checkIn) {
    const { data: checkoutToday } = await supabase
      .from('reservations')
      .select('room_id')
      .eq('check_out', checkIn)
      .in('status', ['confirmed', 'checked_in'])
      .not('room_id', 'is', null);
    checkoutTodayIds = (checkoutToday || []).map(r => r.room_id).filter(Boolean);
    // Remove these from bookedIds since they check out on the search date
    bookedIds = bookedIds.filter(id => !checkoutTodayIds.includes(id));
  }

  // When checking availability, mark rooms
  let availableCount = null;
  if (bookedIds !== null) {
    availableCount = rooms.filter(r => !bookedIds.includes(r.id)).length;
  }

  const fmtDate = d => { const [y,m,day] = d.split('-'); return `${day}.${m}.${y}`; };

  const html = `
    <div class="page-header">
      <h2 class="page-title">Room board</h2>
    </div>

    <!-- Availability checker -->
    <div class="avail-card">
      <div class="avail-label">Check availability</div>
      <form method="GET" action="/rooms" class="avail-form">
        <div class="avail-dates">
          <div class="avail-field">
            <label>From</label>
            <input type="date" name="checkIn" value="${checkIn || ''}" required />
          </div>
          <div class="avail-field">
            <label>To</label>
            <input type="date" name="checkOut" value="${checkOut || ''}" required />
          </div>
        </div>
        <button type="submit" class="avail-btn">Check</button>
      </form>
      ${bookedIds !== null ? `
        <div class="avail-result">
          ${availableCount > 0
            ? `<span class="avail-ok">✓ ${availableCount} room${availableCount !== 1 ? 's' : ''} available for ${fmtDate(checkIn)} – ${fmtDate(checkOut)}</span>`
            : `<span class="avail-none">✗ No rooms available for these dates</span>`
          }
          <a href="/rooms" class="avail-clear">Clear</a>
        </div>` : ''}
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

    ${bookedIds === null ? `
    <div class="filter-row">
      <button class="filter-chip active" data-filter="all" onclick="setFilter('all', this)">All</button>
      <button class="filter-chip" data-filter="free" onclick="setFilter('free', this)">Free</button>
      <button class="filter-chip" data-filter="occupied" onclick="setFilter('occupied', this)">Occupied</button>
      <button class="filter-chip" data-filter="dirty" onclick="setFilter('dirty', this)">Dirty</button>
    </div>` : `
    <div class="section-label">Rooms for ${fmtDate(checkIn)} – ${fmtDate(checkOut)}</div>`}

    <div class="rooms-grid" id="rooms-grid">
      ${rooms.map(r => {
        if (bookedIds !== null) {
          const isAvailable = !bookedIds.includes(r.id);
          const isCheckoutDay = !isAvailable && checkoutTodayIds.includes(r.id);
          return roomTileAvail(r, isAvailable, isCheckoutDay);
        }
        return roomTile(r);
      }).join('')}
    </div>

    <script>
      function setFilter(f, btn) {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.room-tile').forEach(tile => {
          tile.style.display = (f === 'all' || tile.dataset.status === f) ? '' : 'none';
        });
      }
      // Auto-set min dates
      const ci = document.querySelector('[name=checkIn]');
      const co = document.querySelector('[name=checkOut]');
      if (ci && !ci.value) ci.value = new Date().toISOString().split('T')[0];
      ci && ci.addEventListener('change', () => { if (co.value <= ci.value) co.value = ''; });
      const toast = document.querySelector('.toast-banner');
      if (toast) setTimeout(() => toast.remove(), 3000);
    </script>
  `;

  res.send(renderLayout('Rooms', html, 'rooms', req.session.role, req.hotel));
});

// ── GET /rooms/:id — Room detail / status change ────────────
router.get('/:id', requireAdmin, async (req, res) => {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !room) return res.redirect(`/${req.hotel.slug}/rooms`);

  // Run both queries in parallel
  const [{ data: currentRes }, { data: upcoming }] = await Promise.all([
    room.status === 'occupied'
      ? supabase.from('reservations').select('id, guest_name, check_out').eq('room_id', room.id).eq('status', 'checked_in').maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('reservations').select('id, guest_name, check_in, check_out, status').eq('room_id', room.id)
      .in('status', ['confirmed', 'pending']).gte('check_in', new Date().toISOString().split('T')[0])
      .order('check_in').limit(3)
  ]);

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
          <a href="/${req.hotel.slug}/reservations/${currentRes.id}" class="link-btn">View reservation →</a>
        </div>
      </div>
    ` : ''}

    <div class="section-label">Change status</div>
    <div class="status-actions">
      ${room.status !== 'free' ? `
        <form method="POST" action="/${req.hotel.slug}/rooms/${room.id}/status">
          <input type="hidden" name="status" value="free" />
          <button type="submit" class="status-btn status-btn-free">Mark as Free</button>
        </form>
      ` : ''}
      ${room.status !== 'occupied' ? `
        <form method="POST" action="/${req.hotel.slug}/rooms/${room.id}/status">
          <input type="hidden" name="status" value="occupied" />
          <button type="submit" class="status-btn status-btn-occupied">Mark as Occupied</button>
        </form>
      ` : ''}
      ${room.status !== 'dirty' ? `
        <form method="POST" action="/${req.hotel.slug}/rooms/${room.id}/status">
          <input type="hidden" name="status" value="dirty" />
          <button type="submit" class="status-btn status-btn-dirty">Mark as Dirty</button>
        </form>
      ` : ''}
    </div>

    ${upcoming && upcoming.length > 0 ? `
      <div class="section-label" style="margin-top:20px">Upcoming</div>
      ${upcoming.map(r => `
        <a href="/${req.hotel.slug}/reservations/${r.id}" class="res-card" style="margin-bottom:8px">
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

  res.send(renderLayout('Room ' + room.number, html, 'rooms', req.session.role, req.hotel));
});

// ── POST /rooms/:id/status — Update room status ─────────────
router.post('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['free', 'occupied', 'dirty'];
  if (!validStatuses.includes(status)) return res.redirect(`/${req.hotel.slug}/rooms`);

  await supabase.from('rooms').update({ status }).eq('id', req.params.id);
  res.redirect('/rooms?msg=Room+updated+✓');
});

// ── Helpers ────────────────────────────────────────────────
function bedIcon(status) {
  const colors = { free: '#2d9e6b', occupied: '#d94f4f', dirty: '#c47f10' };
  const c = colors[status] || '#2d9e6b';
  return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="18" width="26" height="8" rx="2" fill="${c}" opacity="0.25"/>
    <rect x="3" y="18" width="26" height="3" rx="1.5" fill="${c}" opacity="0.5"/>
    <rect x="3" y="13" width="3" height="13" rx="1.5" fill="${c}"/>
    <rect x="26" y="13" width="3" height="13" rx="1.5" fill="${c}"/>
    <rect x="6" y="13" width="20" height="7" rx="2" fill="${c}" opacity="0.35"/>
    <rect x="7" y="14" width="7" height="5" rx="1.5" fill="${c}" opacity="0.7"/>
    <rect x="18" y="14" width="7" height="5" rx="1.5" fill="${c}" opacity="0.7"/>
  </svg>`;
}

function statusIcon(status) {
  if (status === 'free') return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#2d9e6b"/><path d="M4 7l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (status === 'occupied') return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#d94f4f"/><path d="M7 4v3.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="9.5" r="0.75" fill="white"/></svg>`;
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#c47f10"/><path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

function roomTile(r) {
  const label = { free: 'Free', occupied: 'Occupied', dirty: 'Needs clean' }[r.status] || r.status;
  return `
    <a href="/${req.hotel.slug}/rooms/${r.id}" class="room-tile room-tile-${r.status}" data-status="${r.status}">
      <div class="room-tile-bed">${bedIcon(r.status)}</div>
      <div class="room-tile-num">${r.number}</div>
      <div class="room-tile-footer">
        <span class="room-tile-status-icon">${statusIcon(r.status)}</span>
        <span class="room-tile-status">${label}</span>
      </div>
    </a>
  `;
}

function roomTileAvail(r, isAvailable, isCheckoutDay) {
  let tileClass, icon, label;

  if (isCheckoutDay) {
    tileClass = 'avail-checkout';
    label = 'Checkout day';
    icon = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#c47f10"/><path d="M7 3v4l2 2" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  } else if (isAvailable) {
    tileClass = 'avail-yes';
    label = 'Available';
    icon = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#2d9e6b"/><path d="M4 7l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  } else {
    tileClass = 'avail-no';
    label = 'Booked';
    icon = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#d94f4f"/><path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }

  return `
    <a href="/${req.hotel.slug}/rooms/${r.id}" class="room-tile room-tile-${r.status} ${tileClass}" data-status="${r.status}">
      <div class="room-tile-bed">${bedIcon(r.status)}</div>
      <div class="room-tile-num">${r.number}</div>
      <div class="room-tile-footer">
        <span class="room-tile-status-icon">${icon}</span>
        <span class="room-tile-status">${label}</span>
      </div>
    </a>
  `;
}

module.exports = router;
