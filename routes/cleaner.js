const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireCleaner } = require('../middleware/auth');
const { renderLayout } = require('./layout');
const { sendPushToRole } = require('../lib/push');

// ── GET /cleaner — Dirty rooms list ───────────────────────
router.get('/', requireCleaner, async (req, res) => {
  const { data: dirtyRooms, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('hotel_id', req.hotel.id)
    .eq('status', 'dirty')
    .order('number');

  if (error) return res.send(renderLayout('Cleaner', `<p class=\"error-msg\">\${error.message}</p>`, 'cleaner', req.session.role, req.hotel, req.session.superAdmin));

  const html = `
    <div class="page-header">
      <h2 class="page-title">Cleaner mode</h2>
      <span class="page-sub">${dirtyRooms.length} room${dirtyRooms.length !== 1 ? 's' : ''} to clean</span>
    </div>

    ${req.query.msg ? `<div class="toast-banner">${req.query.msg}</div>` : ''}

    ${dirtyRooms.length === 0 ? `
      <div class="done-state">
        <div class="done-icon">✓</div>
        <p class="done-text">All rooms are clean!</p>
        <p class="done-sub">Nothing left to do.</p>
      </div>
    ` : `
      <div class="cleaner-list">
        ${dirtyRooms.map(r => `
          <div class="cleaner-card">
            <div class="cleaner-icon">🧹</div>
            <div class="cleaner-info">
              <div class="cleaner-room">Room ${r.number}</div>
              <div class="cleaner-floor">Floor ${r.floor}${r.notes ? ' · ' + r.notes : ''}</div>
            </div>
            <form method="POST" action="/${req.hotel.slug}/cleaner/${r.id}/clean">
              <button type="submit" class="btn-clean">Done</button>
            </form>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:20px">
        <form method="POST" action="/${req.hotel.slug}/cleaner/all-clean" onsubmit="return confirm('Mark ALL rooms as clean?')">
          <button type="submit" class="btn-ghost">Mark all as clean</button>
        </form>
      </div>
    `}

    <script>
      const toast = document.querySelector('.toast-banner');
      if (toast) setTimeout(() => toast.remove(), 3000);
    </script>
  `;

  res.send(renderLayout('Cleaner', html, 'cleaner', req.session.role, req.hotel, req.session.superAdmin));
});

// ── POST /cleaner/:id/clean — Mark single room clean ──────
router.post('/:id/clean', requireCleaner, async (req, res) => {
  const { data: room } = await supabase.from('rooms').select('number').eq('id', req.params.id).eq('hotel_id', req.hotel.id).single();
  await supabase.from('rooms').update({ status: 'free' }).eq('id', req.params.id).eq('hotel_id', req.hotel.id);

  const roomNum = room ? room.number : '?';
  sendPushToRole('admin', {
    title: '✅ Room is ready',
    body: `Room ${roomNum} has been cleaned and is free`,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    vibrate: [100, 50, 100],
    data: { url: '/rooms' }
  });

  res.redirect('/cleaner?msg=Room+marked+clean+✓');
});

// ── POST /cleaner/all-clean — Mark all dirty rooms clean ──
router.post('/all-clean', requireCleaner, async (req, res) => {
  const { data: dirtyRooms } = await supabase.from('rooms').select('number').eq('hotel_id', req.hotel.id).eq('status', 'dirty');
  await supabase.from('rooms').update({ status: 'free' }).eq('hotel_id', req.hotel.id).eq('status', 'dirty');

  const count = dirtyRooms ? dirtyRooms.length : 0;
  if (count > 0) {
    sendPushToRole('admin', {
      title: '✅ All rooms are ready',
      body: `${count} room${count !== 1 ? 's' : ''} cleaned and free`,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      vibrate: [100, 50, 100],
      data: { url: '/rooms' }
    });
  }

  res.redirect('/cleaner?msg=All+rooms+marked+clean+✓');
});

module.exports = router;
