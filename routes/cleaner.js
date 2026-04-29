const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireCleaner } = require('../middleware/auth');
const { renderLayout } = require('./layout');

// ── GET /cleaner — Dirty rooms list ───────────────────────
router.get('/', requireCleaner, async (req, res) => {
  const { data: dirtyRooms, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('status', 'dirty')
    .order('number');

  if (error) return res.send(renderLayout('Cleaner', `<p class="error-msg">${error.message}</p>`, 'cleaner', req.session.role));

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
            <form method="POST" action="/cleaner/${r.id}/clean">
              <button type="submit" class="btn-clean">Done</button>
            </form>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:20px">
        <form method="POST" action="/cleaner/all-clean" onsubmit="return confirm('Mark ALL rooms as clean?')">
          <button type="submit" class="btn-ghost">Mark all as clean</button>
        </form>
      </div>
    `}

    <script>
      const toast = document.querySelector('.toast-banner');
      if (toast) setTimeout(() => toast.remove(), 3000);
    </script>
  `;

  res.send(renderLayout('Cleaner', html, 'cleaner', req.session.role));
});

// ── POST /cleaner/:id/clean — Mark single room clean ──────
router.post('/:id/clean', requireCleaner, async (req, res) => {
  await supabase.from('rooms').update({ status: 'free' }).eq('id', req.params.id);
  res.redirect('/cleaner?msg=Room+marked+clean+✓');
});

// ── POST /cleaner/all-clean — Mark all dirty rooms clean ──
router.post('/all-clean', requireCleaner, async (req, res) => {
  await supabase.from('rooms').update({ status: 'free' }).eq('status', 'dirty');
  res.redirect('/cleaner?msg=All+rooms+marked+clean+✓');
});

module.exports = router;
