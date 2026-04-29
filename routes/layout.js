// Shared HTML layout renderer
// All pages use this shell — nav, head, styles

function renderLayout(title, content, activeTab, role) {
  const isAdmin = role === 'admin';
  const isCleaner = role === 'cleaner';

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
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
</head>
<body>
  <div class="app-shell">

    <!-- Top bar -->
    <header class="topbar">
      <div class="topbar-brand">
        <span class="topbar-icon">🏨</span>
        <span class="topbar-name">Pocket Reception</span>
      </div>
      <form method="POST" action="/logout" class="topbar-logout">
        <button type="submit" class="topbar-logout-btn" title="Sign out">⏻</button>
      </form>
    </header>

    <!-- Main content -->
    <main class="main-content">
      ${content}
    </main>

    <!-- Bottom nav -->
    <nav class="bottom-nav">
      ${isAdmin ? `
        <a href="/" class="nav-btn ${activeTab === 'reservations' ? 'active' : ''}">
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
</body>
</html>`;
}

module.exports = { renderLayout };
