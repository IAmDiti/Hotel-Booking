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
        <a href="/admin/hotels/${h.slug}/access" class="btn-visit">Open →</a>
        <a href="/admin/hotels/${h.slug}/analytics" class="btn-visit" style="background:#6b21a8">📊 Analytics</a>
        <a href="/admin/hotels/${h.slug}/settings" class="btn-visit" style="background:#374151">⚙️ Settings</a>
        <form method="POST" action="/admin/hotels/${h.id}/toggle" style="margin:0">
          <button type="submit" class="btn-toggle">${h.active ? 'Disable' : 'Enable'}</button>
        </form>
        <form method="POST" action="/admin/hotels/${h.id}/delete" onsubmit="return confirm('Delete ${h.name}? This will delete ALL rooms and reservations. This cannot be undone.')" style="margin:0">
          <button type="submit" style="background:#fdf0f0;color:#d94f4f;border:1px solid #f5b8b8;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Delete</button>
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

// POST /admin/hotels/:id/delete
router.post('/hotels/:id/delete', requireSuperAdmin, async (req, res) => {
  await supabase.from('hotels').delete().eq('id', req.params.id);
  res.redirect('/admin?msg=Hotel+deleted');
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
  res.redirect(`/${hotel.slug}/reservations`);
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  req.session.superAdmin = false;
  res.redirect('/admin/login');
});

// GET /admin/hotels/:slug/analytics — analytics inside super admin
router.get('/hotels/:slug/analytics', requireSuperAdmin, async (req, res) => {
  const supabase = require('../lib/supabase');
  const { data: hotel } = await supabase.from('hotels').select('*').eq('slug', req.params.slug).single();
  if (!hotel) return res.redirect('/admin');

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];

  const [
    { data: allRooms },
    { data: thisMonthRes },
    { data: lastMonthRes },
    { data: activeRes },
    { data: recentRes }
  ] = await Promise.all([
    supabase.from('rooms').select('id,status').eq('hotel_id', hotel.id),
    supabase.from('reservations').select('*').eq('hotel_id', hotel.id).gte('created_at', thisMonthStart).neq('status','cancelled'),
    supabase.from('reservations').select('*').eq('hotel_id', hotel.id).gte('created_at', lastMonthStart).lt('created_at', thisMonthStart).neq('status','cancelled'),
    supabase.from('reservations').select('*, rooms(number)').eq('hotel_id', hotel.id).eq('status','checked_in'),
    supabase.from('reservations').select('*, rooms(number)').eq('hotel_id', hotel.id).neq('status','cancelled').order('created_at',{ascending:false}).limit(10)
  ]);

  const totalRooms = allRooms?.length || 0;
  const occupiedNow = allRooms?.filter(r => r.status === 'occupied').length || 0;
  const freeNow = allRooms?.filter(r => r.status === 'free').length || 0;
  const dirtyNow = allRooms?.filter(r => r.status === 'dirty').length || 0;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedNow / totalRooms) * 100) : 0;
  const thisMonthCount = thisMonthRes?.length || 0;
  const lastMonthCount = lastMonthRes?.length || 0;
  const monthDiff = thisMonthCount - lastMonthCount;
  const avgStay = thisMonthRes?.length > 0
    ? (thisMonthRes.reduce((s,r) => s + Math.round((new Date(r.check_out)-new Date(r.check_in))/86400000), 0) / thisMonthRes.length).toFixed(1) : 0;
  const fmtDate = d => { const [y,m,day] = d.split('-'); return `${day}.${m}.${y.slice(2)}`; };

  res.send(adminPage(hotel.name, `
    <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px">
      <a href="/admin" style="color:#6b7280;text-decoration:none;font-size:14px">← Admin</a>
      <h2 style="font-size:18px;font-weight:700">${hotel.name} — Analytics</h2>
    </div>
    <div class="stats-bar">
      <div class="stat-box"><div class="stat-box-num">${totalRooms}</div><div class="stat-box-label">Total rooms</div></div>
      <div class="stat-box"><div class="stat-box-num" style="color:#2d9e6b">${freeNow}</div><div class="stat-box-label">Free</div></div>
      <div class="stat-box"><div class="stat-box-num" style="color:#d94f4f">${occupiedNow}</div><div class="stat-box-label">Occupied</div></div>
    </div>
    <div class="stat-box" style="margin-bottom:16px">
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px">
        <span style="font-size:32px;font-weight:800;color:#1a1a2e">${occupancyRate}%</span>
        <span style="font-size:13px;color:#888">Current occupancy</span>
      </div>
      <div style="background:#f3f4f6;border-radius:20px;height:10px;overflow:hidden">
        <div style="background:#1a1a2e;height:100%;border-radius:20px;width:${occupancyRate}%"></div>
      </div>
    </div>
    <div class="stats-bar">
      <div class="stat-box">
        <div class="stat-box-num">${thisMonthCount}</div>
        <div class="stat-box-label">This month</div>
        <div style="font-size:11px;color:${monthDiff>=0?'#2d9e6b':'#d94f4f'};margin-top:4px">${monthDiff>=0?'+':''}${monthDiff} vs last</div>
      </div>
      <div class="stat-box"><div class="stat-box-num">${avgStay}</div><div class="stat-box-label">Avg nights</div></div>
      <div class="stat-box"><div class="stat-box-num">${activeRes?.length||0}</div><div class="stat-box-label">Active guests</div></div>
    </div>
    ${activeRes?.length ? `
      <h3 style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;margin:16px 0 10px">Current guests</h3>
      ${activeRes.map(r=>`
        <div style="background:white;border-radius:10px;padding:12px 14px;margin-bottom:8px;border:0.5px solid #e5e7eb;display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:#1a1a2e;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${r.guest_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
          <div style="flex:1"><div style="font-size:14px;font-weight:600">${r.guest_name}</div><div style="font-size:12px;color:#888">Room ${r.rooms?.number||'?'} · out ${fmtDate(r.check_out)}</div></div>
        </div>`).join('')}` : ''}
    <h3 style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;margin:16px 0 10px">Recent bookings</h3>
    ${recentRes?.map(r=>`
      <div style="background:white;border-radius:10px;padding:12px 14px;margin-bottom:8px;border:0.5px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:14px;font-weight:600">${r.guest_name}</div><div style="font-size:12px;color:#888">${fmtDate(r.check_in)} → ${fmtDate(r.check_out)}</div></div>
        <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;background:${r.status==='checked_in'?'#eaf6f0':r.status==='pending'?'#fdf3dc':'#f3f4f6'};color:${r.status==='checked_in'?'#2d9e6b':r.status==='pending'?'#c47f10':'#888'}">${r.status.replace('_',' ')}</span>
      </div>`).join('')||'<p style="color:#888;font-size:14px">No bookings yet</p>'}
  `));
});

// GET /admin/hotels/:slug/settings — settings inside super admin
router.get('/hotels/:slug/settings', requireSuperAdmin, async (req, res) => {
  const supabase = require('../lib/supabase');
  const { data: hotel } = await supabase.from('hotels').select('*').eq('slug', req.params.slug).single();
  const { data: rooms } = await supabase.from('rooms').select('*').eq('hotel_id', hotel.id).order('number');
  if (!hotel) return res.redirect('/admin');
  const msg = req.query.msg || null;
  const err = req.query.error || null;

  res.send(adminPage(hotel.name + ' — Settings', `
    <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px">
      <a href="/admin" style="color:#6b7280;text-decoration:none;font-size:14px">← Admin</a>
      <h2 style="font-size:18px;font-weight:700">${hotel.name} — Settings</h2>
    </div>
    ${msg ? `<div style="background:#eaf6f0;color:#2d9e6b;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px">${msg}</div>` : ''}
    ${err ? `<div style="background:#fdf0f0;color:#d94f4f;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px">${err}</div>` : ''}

    <div class="add-hotel" style="margin-bottom:16px">
      <h3>Hotel information</h3>
      <form method="POST" action="/admin/hotels/${hotel.slug}/settings/info">
        <div class="form-grid">
          <div class="form-field"><label>Hotel name</label><input type="text" name="name" value="${hotel.name}" required/></div>
          <div class="form-field"><label>WiFi name</label><input type="text" name="wifi_name" value="${hotel.wifi_name||''}"/></div>
          <div class="form-field"><label>WiFi password</label><input type="text" name="wifi_password" value="${hotel.wifi_password||''}"/></div>
          <div class="form-field"><label>Check-out time</label><input type="text" name="checkout_time" value="${hotel.checkout_time||'11:00'}"/></div>
          <div class="form-field"><label>Restaurant hours</label><input type="text" name="restaurant_hours" value="${hotel.restaurant_hours||''}"/></div>
          <div class="form-field"><label>Extra info</label><input type="text" name="extra_info" value="${hotel.extra_info||''}"/></div>
        </div>
        <button type="submit" class="btn-add">Save info</button>
      </form>
    </div>

    <div class="add-hotel" style="margin-bottom:16px">
      <h3>Access PINs</h3>
      <form method="POST" action="/admin/hotels/${hotel.slug}/settings/pins">
        <div class="form-grid">
          <div class="form-field"><label>Admin (receptionist) PIN</label><input type="text" name="admin_pin" value="${hotel.admin_pin}" required/></div>
          <div class="form-field"><label>Cleaner PIN</label><input type="text" name="cleaner_pin" value="${hotel.cleaner_pin}" required/></div>
        </div>
        <button type="submit" class="btn-add">Update PINs</button>
      </form>
    </div>

    <div class="add-hotel" style="margin-bottom:16px">
      <h3>WhatsApp (Twilio)</h3>
      <form method="POST" action="/admin/hotels/${hotel.slug}/settings/twilio">
        <div class="form-grid">
          <div class="form-field"><label>Account SID</label><input type="text" name="twilio_account_sid" value="${hotel.twilio_account_sid||''}" placeholder="ACxxxxxxxx"/></div>
          <div class="form-field"><label>Auth Token</label><input type="password" name="twilio_auth_token" value="${hotel.twilio_auth_token||''}"/></div>
          <div class="form-field"><label>WhatsApp From</label><input type="text" name="twilio_whatsapp_from" value="${hotel.twilio_whatsapp_from||''}" placeholder="+14155238886"/></div>
        </div>
        <button type="submit" class="btn-add">Save WhatsApp</button>
      </form>
    </div>

    <div class="add-hotel">
      <h3>Rooms (${rooms?.length||0})</h3>
      <div style="margin-bottom:12px">
        ${rooms?.map(r=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:0.5px solid #f3f4f6">
            <span style="font-size:14px">Room ${r.number} · Floor ${r.floor}</span>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;background:${r.status==='free'?'#eaf6f0':r.status==='occupied'?'#fdf0f0':'#fdf3dc'};color:${r.status==='free'?'#2d9e6b':r.status==='occupied'?'#d94f4f':'#c47f10'}">${r.status}</span>
              <form method="POST" action="/admin/hotels/${hotel.slug}/settings/rooms/${r.id}/delete" onsubmit="return confirm('Delete room ${r.number}?')" style="margin:0">
                <button type="submit" style="background:none;border:none;color:#d94f4f;font-size:16px;cursor:pointer">✕</button>
              </form>
            </div>
          </div>`).join('')||'<p style="color:#888;font-size:14px">No rooms</p>'}
      </div>
      <form method="POST" action="/admin/hotels/${hotel.slug}/settings/rooms">
        <div class="form-grid">
          <div class="form-field"><label>Room number</label><input type="text" name="number" placeholder="e.g. 105" required/></div>
          <div class="form-field"><label>Floor</label><input type="number" name="floor" placeholder="1" min="1" required/></div>
        </div>
        <button type="submit" class="btn-add">Add room</button>
      </form>
    </div>
  `));
});

// Settings POST handlers
router.post('/hotels/:slug/settings/info', requireSuperAdmin, async (req, res) => {
  const supabase = require('../lib/supabase');
  const { name, wifi_name, wifi_password, checkout_time, restaurant_hours, extra_info } = req.body;
  await supabase.from('hotels').update({ name, wifi_name, wifi_password, checkout_time, restaurant_hours, extra_info }).eq('slug', req.params.slug);
  res.redirect(`/admin/hotels/${req.params.slug}/settings?msg=Hotel+info+saved+✓`);
});

router.post('/hotels/:slug/settings/pins', requireSuperAdmin, async (req, res) => {
  const supabase = require('../lib/supabase');
  const { admin_pin, cleaner_pin } = req.body;
  if (admin_pin === cleaner_pin) return res.redirect(`/admin/hotels/${req.params.slug}/settings?error=PINs+must+be+different`);
  await supabase.from('hotels').update({ admin_pin, cleaner_pin }).eq('slug', req.params.slug);
  res.redirect(`/admin/hotels/${req.params.slug}/settings?msg=PINs+updated+✓`);
});

router.post('/hotels/:slug/settings/twilio', requireSuperAdmin, async (req, res) => {
  const supabase = require('../lib/supabase');
  const { twilio_account_sid, twilio_auth_token, twilio_whatsapp_from } = req.body;
  await supabase.from('hotels').update({ twilio_account_sid, twilio_auth_token, twilio_whatsapp_from }).eq('slug', req.params.slug);
  res.redirect(`/admin/hotels/${req.params.slug}/settings?msg=WhatsApp+saved+✓`);
});

router.post('/hotels/:slug/settings/rooms', requireSuperAdmin, async (req, res) => {
  const supabase = require('../lib/supabase');
  const { data: hotel } = await supabase.from('hotels').select('id').eq('slug', req.params.slug).single();
  const { number, floor } = req.body;
  await supabase.from('rooms').insert({ hotel_id: hotel.id, number: number.trim(), floor: parseInt(floor), status: 'free' });
  res.redirect(`/admin/hotels/${req.params.slug}/settings?msg=Room+${number}+added+✓`);
});

router.post('/hotels/:slug/settings/rooms/:id/delete', requireSuperAdmin, async (req, res) => {
  const supabase = require('../lib/supabase');
  await supabase.from('rooms').delete().eq('id', req.params.id);
  res.redirect(`/admin/hotels/${req.params.slug}/settings?msg=Room+deleted`);
});

function adminPage(title, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Super Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#f6f6f4;min-height:100vh}
.admin-topbar{background:#1a1a2e;color:white;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.admin-title{font-size:16px;font-weight:700}
.admin-body{padding:20px;max-width:900px;margin:0 auto}
.hotel-card{background:white;border-radius:12px;padding:16px;margin-bottom:12px;border:0.5px solid rgba(0,0,0,0.1);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.hotel-name{font-size:15px;font-weight:600}
.hotel-slug{font-size:12px;color:#888;margin-top:2px}
.hotel-stats{display:flex;gap:16px;font-size:13px}
.hotel-stat{text-align:center}
.hotel-stat-num{font-size:18px;font-weight:700;color:#1a1a2e}
.hotel-stat-label{font-size:10px;color:#aaa;text-transform:uppercase}
.hotel-actions{display:flex;gap:8px;flex-wrap:wrap}
.btn-visit{background:#1a1a2e;color:white;padding:7px 14px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;white-space:nowrap}
.btn-toggle{background:#fdf0f0;color:#d94f4f;border:1px solid #f5b8b8;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.add-hotel{background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:0.5px solid rgba(0,0,0,0.1)}
.add-hotel h3{font-size:15px;font-weight:700;margin-bottom:14px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.form-field{display:flex;flex-direction:column;gap:5px}
.form-field label{font-size:11px;font-weight:600;color:#888;text-transform:uppercase}
.form-field input{border:1px solid #ddd;border-radius:8px;padding:10px;font-size:14px;font-family:inherit}
.btn-add{background:#1a1a2e;color:white;border:none;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer}
.stats-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
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
<div class="admin-body">${body}</div>
</body></html>`;
}

module.exports = router;
