const express = require('express');
const router = express.Router({ mergeParams: true });
const supabase = require('../lib/supabase');
const { requireAdmin } = require('../middleware/auth');
const { renderLayout } = require('./layout');

router.get('/', requireAdmin, async (req, res) => {
  // Only super admin can see analytics
  if (!req.session.superAdmin) {
    return res.redirect(`/${req.hotel.slug}/reservations`);
  }
  const hotel = req.hotel;
  const hotelId = hotel.id;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  // Run all analytics queries in parallel
  const [
    { data: allRooms },
    { data: thisMonthRes },
    { data: lastMonthRes },
    { data: activeRes },
    { data: recentRes }
  ] = await Promise.all([
    supabase.from('rooms').select('id, status').eq('hotel_id', hotelId),
    supabase.from('reservations').select('*').eq('hotel_id', hotelId)
      .gte('created_at', thisMonthStart).neq('status', 'cancelled'),
    supabase.from('reservations').select('*').eq('hotel_id', hotelId)
      .gte('created_at', lastMonthStart).lt('created_at', thisMonthStart).neq('status', 'cancelled'),
    supabase.from('reservations').select('*, rooms(number)').eq('hotel_id', hotelId)
      .eq('status', 'checked_in'),
    supabase.from('reservations').select('*, rooms(number)').eq('hotel_id', hotelId)
      .neq('status', 'cancelled').order('created_at', { ascending: false }).limit(10)
  ]);

  const totalRooms = allRooms?.length || 0;
  const occupiedNow = allRooms?.filter(r => r.status === 'occupied').length || 0;
  const freeNow = allRooms?.filter(r => r.status === 'free').length || 0;
  const dirtyNow = allRooms?.filter(r => r.status === 'dirty').length || 0;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedNow / totalRooms) * 100) : 0;

  // Avg stay length this month
  const avgStay = thisMonthRes?.length > 0
    ? (thisMonthRes.reduce((sum, r) => {
        const nights = Math.round((new Date(r.check_out) - new Date(r.check_in)) / 86400000);
        return sum + nights;
      }, 0) / thisMonthRes.length).toFixed(1)
    : 0;

  // Month comparison
  const thisMonthCount = thisMonthRes?.length || 0;
  const lastMonthCount = lastMonthRes?.length || 0;
  const monthDiff = thisMonthCount - lastMonthCount;
  const monthDiffSign = monthDiff >= 0 ? '+' : '';

  const fmtDate = d => { const [y,m,day] = d.split('-'); return `${day}.${m}.${y.slice(2)}`; };

  const html = `
    <div class="page-header">
      <h2 class="page-title">Analytics</h2>
      <span style="font-size:12px;color:var(--text-muted)">${new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})}</span>
    </div>

    <!-- Live status -->
    <div class="section-label">Live status</div>
    <div class="analytics-grid-4">
      <div class="analytics-card ac-blue">
        <div class="ac-num">${totalRooms}</div>
        <div class="ac-label">Total rooms</div>
      </div>
      <div class="analytics-card ac-green">
        <div class="ac-num">${freeNow}</div>
        <div class="ac-label">Free</div>
      </div>
      <div class="analytics-card ac-red">
        <div class="ac-num">${occupiedNow}</div>
        <div class="ac-label">Occupied</div>
      </div>
      <div class="analytics-card ac-amber">
        <div class="ac-num">${dirtyNow}</div>
        <div class="ac-label">Dirty</div>
      </div>
    </div>

    <!-- Occupancy rate -->
    <div class="section-label">Occupancy rate</div>
    <div class="occupancy-card">
      <div class="occupancy-header">
        <span class="occupancy-pct">${occupancyRate}%</span>
        <span class="occupancy-label">Current occupancy</span>
      </div>
      <div class="occupancy-bar-bg">
        <div class="occupancy-bar-fill" style="width:${occupancyRate}%"></div>
      </div>
      <div class="occupancy-footer">
        <span>${occupiedNow} occupied</span>
        <span>${freeNow} free</span>
      </div>
    </div>

    <!-- This month stats -->
    <div class="section-label">This month</div>
    <div class="analytics-grid-3">
      <div class="analytics-card ac-purple">
        <div class="ac-num">${thisMonthCount}</div>
        <div class="ac-label">Bookings</div>
        <div class="ac-diff ${monthDiff >= 0 ? 'pos' : 'neg'}">${monthDiffSign}${monthDiff} vs last month</div>
      </div>
      <div class="analytics-card ac-teal">
        <div class="ac-num">${avgStay}</div>
        <div class="ac-label">Avg nights</div>
      </div>
      <div class="analytics-card ac-blue">
        <div class="ac-num">${activeRes?.length || 0}</div>
        <div class="ac-label">Active guests</div>
      </div>
    </div>

    <!-- Current guests -->
    ${activeRes?.length > 0 ? `
      <div class="section-label">Current guests</div>
      ${activeRes.map(r => `
        <div class="res-card" onclick="location.href='/${hotel.slug}/reservations/${r.id}'">
          <div class="res-avatar">${r.guest_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
          <div class="res-info">
            <div class="res-name">${r.guest_name}</div>
            <div class="res-meta">Room ${r.rooms?.number || '?'} · checkout ${fmtDate(r.check_out)}</div>
          </div>
          <span class="badge badge-checked_in">In</span>
        </div>
      `).join('')}
    ` : ''}

    <!-- Recent bookings -->
    <div class="section-label" style="margin-top:16px">Recent bookings</div>
    ${recentRes?.map(r => `
      <div class="res-card" onclick="location.href='/${hotel.slug}/reservations/${r.id}'">
        <div class="res-avatar">${r.guest_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
        <div class="res-info">
          <div class="res-name">${r.guest_name}</div>
          <div class="res-meta">${fmtDate(r.check_in)} → ${fmtDate(r.check_out)}${r.rooms ? ' · Room ' + r.rooms.number : ''}</div>
        </div>
        <span class="badge badge-${r.status}">${r.status.replace('_',' ')}</span>
      </div>
    `).join('') || '<div class="empty-state">No bookings yet</div>'}
  `;

  res.send(renderLayout('Analytics', html, 'analytics', req.session.role, hotel));
});

module.exports = router;
