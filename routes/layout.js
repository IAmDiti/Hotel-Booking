function renderLayout(title, content, activeTab, role, hotel, isSuperAdmin) {
  const isAdmin = role === 'admin';
  const slug = hotel?.slug || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#1a1a2e">
  <title>${title} · ${hotel?.name || 'Pocket Reception'}</title>
  <link rel="stylesheet" href="/css/app.css?v=3">
  <link rel="manifest" href="/manifest.json">
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-brand">
        <span style="font-size:18px">🏨</span>
        <span class="topbar-name">${hotel?.name || 'Pocket Reception'}</span>
      </div>
      <div class="topbar-right">
        <button class="topbar-btn" id="notif-btn" style="display:none" onclick="requestPushPermission()" title="Enable notifications">🔔</button>
        <form method="POST" action="/${slug}/logout" style="margin:0">
          <button type="submit" class="topbar-btn" title="Sign out">⏻</button>
        </form>
      </div>
    </header>

    <main class="main-content">${content}</main>

    <nav class="bottom-nav">
      ${isAdmin ? `
        <a href="/${slug}/reservations" class="nav-btn ${activeTab === 'reservations' ? 'active' : ''}">
          <span class="nav-icon">📋</span><span class="nav-label">Bookings</span>
        </a>
        <a href="/${slug}/rooms" class="nav-btn ${activeTab === 'rooms' ? 'active' : ''}">
          <span class="nav-icon">🏨</span><span class="nav-label">Rooms</span>
        </a>
        <a href="/${slug}/cleaner" class="nav-btn ${activeTab === 'cleaner' ? 'active' : ''}">
          <span class="nav-icon">🧹</span><span class="nav-label">Cleaner</span>
        </a>
        ${isSuperAdmin ? `
          <a href="/${slug}/analytics" class="nav-btn ${activeTab === 'analytics' ? 'active' : ''}">
            <span class="nav-icon">📊</span><span class="nav-label">Analytics</span>
          </a>
          <a href="/${slug}/settings" class="nav-btn ${activeTab === 'settings' ? 'active' : ''}">
            <span class="nav-icon">⚙️</span><span class="nav-label">Settings</span>
          </a>
        ` : ''}
      ` : `
        <a href="/${slug}/cleaner" class="nav-btn active">
          <span class="nav-icon">🧹</span><span class="nav-label">Cleaner</span>
        </a>
      `}
    </nav>
  </div>

  <script>
  (async function() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    let reg;
    try { reg = await navigator.serviceWorker.register('/sw.js'); } catch(e) { return; }
    let vapidKey;
    try {
      const r = await fetch('/push/vapid-public-key');
      const d = await r.json();
      vapidKey = d.key;
    } catch(e) { return; }
    if (!vapidKey) return;
    if (Notification.permission === 'default') {
      document.getElementById('notif-btn').style.display = 'flex';
    }
    if (Notification.permission === 'granted') await ensureSubscribed(reg, vapidKey);
    window.requestPushPermission = async function() {
      const result = await Notification.requestPermission();
      document.getElementById('notif-btn').style.display = 'none';
      if (result === 'granted') await ensureSubscribed(reg, vapidKey);
    };
    async function ensureSubscribed(reg, vapidKey) {
      try {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapidKey) });
        await fetch('/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      } catch(e) {}
    }
    function urlB64ToUint8(b) {
      const p = '='.repeat((4 - b.length % 4) % 4);
      const base64 = (b + p).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(base64);
      return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    }
  })();
  </script>
</body>
</html>`;
}

module.exports = { renderLayout };
