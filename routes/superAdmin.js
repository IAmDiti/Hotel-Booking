const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

const SUPER_PIN = process.env.SUPER_ADMIN_PIN || '999999';

// Simple super admin auth
function requireSuperAdmin(req, res, next) {
  if (req.session?.superAdmin) return next();
  res.redirect('/admin/login');
}

// GET /admin/login
router.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Super Admin</title><link rel="stylesheet" href="/css/app.css?v=3"></head>
<body style="background:#1a1a2e;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="background:white;border-radius:16px;padding:32px;width:90%;max-width:360px;text-align:center">
  <div style="font-size:40px;margin-bottom:12px">🔐</div>
  <h2 style="margin-bottom:20px;font-size:18px">Super Admin</h2>
  ${req.query.error ? '<p style="color:red;font-size:14px;margin-bottom:12px">Wrong PIN</p>' : ''}
  <form method="POST" action="/admin/login">
    <input type="password" name="pin" placeholder="Enter PIN" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:16px;margin-bottom:12px" />
    <button type="submit" style="width:100%;padding:12px;background:#1a1a2e;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Login</button>
  </form>
</div></body></html>`);
});

router.post('/login', (req, res) => {
  if (req.body.pin === SUPER_PIN) {
    req.session.superAdmin = true;
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?error=1');
});

// GET /admin — All hotels dashboard
router.get('/', requireSuperAdmin, async (req, res) => {
  const { data: hotels } = await supabase.from('hotels').select('*, rooms(count), reservations(count)').order('created_at', { ascending: false });

  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Super Admin · Pocket Reception</title><link rel="stylesheet" href="/css/app.css?v=3">
<style>
body{font-family:-apple-system,sans-serif;background:#f6f6f4;margin:0;padding:0}
.admin-topbar{background:#1a1a2e;color:white;padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
.admin-title{font-size:16px;font-weight:700}
.admin-body{padding:20px;max-width:900px;margin:0 auto}
.hotel-card{background:white;border-radius:12px;padding:16px;margin-bottom:12px;border:0.5px solid rgba(0,0,0,0.1);display:flex;align-items:center;justify-content:space-between;gap:12px}
.hotel-name{font-size:15px;font-weight:600}
.hotel-slug{font-size:12px;color:#888;margin-top:2px}
.hotel-stats{display:flex;gap:16px;font-size:13px;color:#555}
.hotel-stat{text-align:center}
.hotel-stat-num{font-size:18px;font-weight:700;color:#1a1a2e}
.hotel-stat-label{font-size:10px;color:#aaa;text-transform:uppercase}
.hotel-actions{display:flex;gap:8px}
.btn-visit{background:#1a1a2e;color:white;padding:7px 14px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600}
.btn-toggle{background:#fdf0f0;color:#d94f4f;border:1px solid #f5b8b8;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.add-hotel{background:white;border-radius:12px;padding:20px;margin-bottom:20px;border:0.5px solid rgba(0,0,0,0.1)}
.add-hotel h3{font-size:15px;font-weight:700;margin-bottom:14px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.form-field{display:flex;flex-direction:column;gap:5px}
.form-field label{font-size:11px;font-weight:600;color:#888;text-transform:uppercase}
.form-field input{border:1px solid #ddd;border-radius:8px;padding:10px;font-size:14px;font-family:inherit}
.btn-add{background:#1a1a2e;color:white;border:none;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;margin-top:10px}
.stats-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.stat-box{background:white;border-radius:12px;padding:16px;text-align:center;border:0.5px solid rgba(0,0,0,0.1)}
.stat-box-num{font-size:28px;font-weight:800;color:#1a1a2e}
.stat-box-label{font-size:12px;color:#888;margin-top:4px}
</style></head>
<body>
<div class="admin-topbar">
  <div class="admin-title">🏨 Pocket Reception — Super Admin</div>
  <form method="POST" action="/admin/logout" style="margin:0">
    <button type="submit" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px">Logout</button>
  </form>
</div>
<div class="admin-body">
  ${req.query.msg ? `<div style="background:#eaf6f0;color:#2d9e6b;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px">${req.query.msg}</div>` : ''}

  <div class="stats-bar">
    <div class="stat-box">
      <div class="stat-box-num">${hotels?.length || 0}</div>
      <div class="stat-box-label">Hotels</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-num">${hotels?.filter(h => h.active).length || 0}</div>
      <div class="stat-box-label">Active</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-num">${hotels?.reduce((s, h) => s + (h.rooms?.[0]?.count || 0), 0) || 0}</div>
      <div class="stat-box-label">Total rooms</div>
    </div>
  </div>

  <!-- Add hotel -->
  <div class="add-hotel">
    <h3>+ Add new hotel</h3>
    <form method="POST" action="/admin/hotels">
      <div class="form-grid">
        <div class="form-field">
          <label>Hotel name</label>
          <input type="text" name="name" placeholder="Hotel Example" required />
        </div>
        <div class="form-field">
          <label>Slug (URL)</label>
          <input type="text" name="slug" placeholder="hotel-example" required pattern="[a-z0-9\\-]+" />
        </div>
        <div class="form-field">
          <label>Admin PIN</label>
          <input type="text" name="admin_pin" placeholder="1234" value="1234" required />
        </div>
        <div class="form-field">
          <label>Cleaner PIN</label>
          <input type="text" name="cleaner_pin" placeholder="0000" value="0000" required />
        </div>
      </div>
      <button type="submit" class="btn-add">Create hotel</button>
    </form>
  </div>

  <!-- Hotels list -->
  <h3 style="font-size:14px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:12px">All hotels</h3>
  ${hotels?.map(h => `
    <div class="hotel-card">
      <div style="flex:1">
        <div class="hotel-name">${h.name} ${h.active ? '' : '<span style="color:#d94f4f;font-size:11px">[INACTIVE]</span>'}</div>
        <div class="hotel-slug">/${h.slug}</div>
      </div>
      <div class="hotel-stats">
        <div class="hotel-stat">
          <div class="hotel-stat-num">${h.rooms?.[0]?.count || 0}</div>
          <div class="hotel-stat-label">Rooms</div>
        </div>
        <div class="hotel-stat">
          <div class="hotel-stat-num">${h.reservations?.[0]?.count || 0}</div>
          <div class="hotel-stat-label">Bookings</div>
        </div>
      </div>
      <div class="hotel-actions">
        <a href="/admin/hotels/${h.slug}/access" class="btn-visit">Bookings →</a>
        <a href="/admin/hotels/${h.slug}/access?goto=analytics" class="btn-visit" style="background:#6b21a8">📊</a>
        <a href="/admin/hotels/${h.slug}/access?goto=settings" class="btn-visit" style="background:#374151">⚙️</a>
        <form method="POST" action="/admin/hotels/${h.id}/toggle" style="margin:0">
          <button type="submit" class="btn-toggle">${h.active ? 'Disable' : 'Enable'}</button>
        </form>
      </div>
    </div>
  `).join('') || '<p style="color:#888;font-size:14px">No hotels yet</p>'}
</div>
</body></html>`);
});

// POST /admin/hotels — Create hotel
router.post('/hotels', requireSuperAdmin, async (req, res) => {
  const { name, slug, admin_pin, cleaner_pin } = req.body;
  const { error } = await supabase.from('hotels').insert({ name, slug, admin_pin, cleaner_pin });
  if (error) return res.redirect(`/admin?msg=Error:+${encodeURIComponent(error.message)}`);
  res.redirect(`/admin?msg=Hotel+${name}+created+✓`);
});

// POST /admin/hotels/:id/toggle
router.post('/hotels/:id/toggle', requireSuperAdmin, async (req, res) => {
  const { data: h } = await supabase.from('hotels').select('active').eq('id', req.params.id).single();
  await supabase.from('hotels').update({ active: !h.active }).eq('id', req.params.id);
  res.redirect('/admin');
});

// GET /admin/hotels/:id/access — super admin enters a hotel with full access
router.get('/hotels/:slug/access', requireSuperAdmin, async (req, res) => {
  const { data: hotel } = await supabase.from('hotels').select('*').eq('slug', req.params.slug).single();
  if (!hotel) return res.redirect('/admin');
  // Set hotel session as admin AND keep superAdmin flag
  req.session.role = 'admin';
  req.session.hotelId = hotel.id;
  req.session.hotelSlug = hotel.slug;
  req.session.superAdmin = true; // keep super admin privileges
  const goto = req.query.goto;
  if (goto === 'analytics') return res.redirect(`/${hotel.slug}/analytics`);
  if (goto === 'settings') return res.redirect(`/${hotel.slug}/settings`);
  res.redirect(`/${hotel.slug}/reservations`);
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  req.session.superAdmin = false;
  res.redirect('/admin/login');
});

module.exports = router;
