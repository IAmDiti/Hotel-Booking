const express = require('express');
const router = express.Router({ mergeParams: true });

// GET /login
router.get('/login', (req, res) => {
  const hotel = req.hotel;
  const error = req.query.error || null;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta name="theme-color" content="#1a1a2e">
  <title>${hotel.name} · Login</title>
  <link rel="stylesheet" href="/css/app.css?v=3">
</head>
<body class="login-body">
  <div class="login-wrap">
    <div class="login-logo">
      <span class="login-icon">🏨</span>
      <h1 class="login-title">${hotel.name}</h1>
      <p class="login-sub">Enter your PIN to continue</p>
    </div>
    ${error ? `<div class="alert alert-error">${error === 'wrong_pin' ? 'Wrong PIN, try again' : error}</div>` : ''}
    <div class="pin-display">
      <span class="pin-dot" id="d0"></span>
      <span class="pin-dot" id="d1"></span>
      <span class="pin-dot" id="d2"></span>
      <span class="pin-dot" id="d3"></span>
    </div>
    <form method="POST" action="/${hotel.slug}/login">
      <input type="hidden" name="pin" id="pin-input" />
      <div class="numpad">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(n => `
          <button type="button" class="numpad-btn ${n===''?'numpad-empty':''}"
            onclick="${n==='⌫'?'delDigit()':n!==''?`addDigit('${n}')`:'void 0'}">${n}</button>
        `).join('')}
      </div>
    </form>
    <p class="login-hint">Admin PIN or Cleaner PIN</p>
  </div>
  <script>
    let pin = '';
    function updateDots() {
      for(let i=0;i<4;i++) document.getElementById('d'+i).classList.toggle('filled',i<pin.length);
    }
    function addDigit(d) {
      if(pin.length>=4) return;
      pin+=d; updateDots();
      if(pin.length===4) { document.getElementById('pin-input').value=pin; setTimeout(()=>document.querySelector('form').submit(),150); }
    }
    function delDigit() { pin=pin.slice(0,-1); updateDots(); }
  </script>
</body>
</html>`);
});

// POST /login
router.post('/login', (req, res) => {
  const { pin } = req.body;
  const hotel = req.hotel;
  if (pin === hotel.admin_pin) {
    req.session.role = 'admin';
    req.session.hotelId = hotel.id;
    req.session.hotelSlug = hotel.slug;
    return res.redirect(`/${hotel.slug}/reservations`);
  } else if (pin === hotel.cleaner_pin) {
    req.session.role = 'cleaner';
    req.session.hotelId = hotel.id;
    req.session.hotelSlug = hotel.slug;
    return res.redirect(`/${hotel.slug}/cleaner`);
  }
  res.redirect(`/${hotel.slug}/login?error=wrong_pin`);
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect(`/${req.hotel.slug}/login`);
});

module.exports = router;
