// Shared HTML layout renderer
// All pages use this shell — nav, head, styles

function renderLayout(title, content, activeTab, role) {
  const isAdmin = role === 'admin';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#1a1a2e">
  <title>${title} · Pocket Reception</title>
  <link rel="stylesheet" href="/css/app.css">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icons/icon-192.svg">
</head>
<body>
  <div class="app-shell">

    <!-- Top bar -->
    <header class="topbar">
      <div class="topbar-brand">
        <span class="topbar-icon">🏨</span>
        <span class="topbar-name">Pocket Reception</span>
      </div>
      <div class="topbar-right">
        <button class="topbar-notif-btn" id="notif-btn" title="Enable notifications" onclick="requestPushPermission()" style="display:none">🔔</button>
        <form method="POST" action="/logout" class="topbar-logout">
          <button type="submit" class="topbar-logout-btn" title="Sign out">⏻</button>
        </form>
      </div>
    </header>

    <!-- Main content -->
    <main class="main-content">
      ${content}
    </main>

    <!-- Bottom nav -->
    <nav class="bottom-nav">
      ${isAdmin ? `
        <a href="/reservations" class="nav-btn ${activeTab === 'reservations' ? 'active' : ''}">
          <span class="nav-icon">📋</span>
          <span class="nav-label">Bookings</span>
        </a>
        <a href="/rooms" class="nav-btn ${activeTab === 'rooms' ? 'active' : ''}">
          <span class="nav-icon">🏨</span>
          <span class="nav-label">Rooms</span>
        </a>
        <a href="/cleaner" class="nav-btn ${activeTab === 'cleaner' ? 'active' : ''}">
          <span class="nav-icon">🧹</span>
          <span class="nav-label">Cleaner</span>
        </a>
        <a href="/settings" class="nav-btn ${activeTab === 'settings' ? 'active' : ''}">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">Settings</span>
        </a>
      ` : `
        <a href="/cleaner" class="nav-btn active">
          <span class="nav-icon">🧹</span>
          <span class="nav-label">Cleaner</span>
        </a>
      `}
    </nav>

  </div>

  <script>
  // ── Service worker + Push setup ───────────────────────────
  (async function() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // Register service worker
    let reg;
    try {
      reg = await navigator.serviceWorker.register('/sw.js');
    } catch(e) { return; }

    // Fetch VAPID public key
    let vapidKey;
    try {
      const r = await fetch('/push/vapid-public-key');
      const d = await r.json();
      vapidKey = d.key;
    } catch(e) { return; }
    if (!vapidKey) return; // Push not configured server-side

    const permission = Notification.permission;

    // Show bell button if not yet granted
    if (permission === 'default') {
      document.getElementById('notif-btn').style.display = 'flex';
    }

    // Auto-subscribe if already granted (re-subscribe after reinstall)
    if (permission === 'granted') {
      await ensureSubscribed(reg, vapidKey);
    }

    window.requestPushPermission = async function() {
      const result = await Notification.requestPermission();
      document.getElementById('notif-btn').style.display = 'none';
      if (result === 'granted') {
        await ensureSubscribed(reg, vapidKey);
      }
    };

    async function ensureSubscribed(reg, vapidKey) {
      try {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
          });
        }
        // Send to server
        await fetch('/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() })
        });
      } catch(e) {
        console.warn('Push subscribe failed:', e);
      }
    }

    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
    }
  })();
  </script>
</body>
</html>`;
}

module.exports = { renderLayout };
