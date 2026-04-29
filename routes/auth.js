const express = require('express');
const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
  const error = req.query.error || null;
  res.send(loginPage(error, req.session?.role));
});

// POST /login
router.post('/login', (req, res) => {
  const { pin } = req.body;
  const adminPin = process.env.ADMIN_PIN || '1234';
  const cleanerPin = process.env.CLEANER_PIN || '0000';

  if (pin === adminPin) {
    req.session.role = 'admin';
    return res.redirect('/');
  } else if (pin === cleanerPin) {
    req.session.role = 'cleaner';
    return res.redirect('/cleaner');
  } else {
    return res.redirect('/login?error=wrong_pin');
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

function loginPage(error, role) {
  const errorMsg = error === 'wrong_pin'
    ? 'Wrong PIN, try again'
    : error === 'admin_required'
    ? 'Admin access required'
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Pocket Reception</title>
  <link rel="stylesheet" href="/css/app.css">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#1a1a2e">
</head>
<body class="login-body">
  <div class="login-wrap">
    <div class="login-logo">
      <div class="login-icon">🏨</div>
      <h1 class="login-title">Pocket Reception</h1>
      <p class="login-sub">Enter your PIN to continue</p>
    </div>

    ${errorMsg ? `<div class="alert alert-error">${errorMsg}</div>` : ''}

    <form method="POST" action="/login" class="login-form">
      <div class="pin-display" id="pin-display">
        <span class="pin-dot" id="d0"></span>
        <span class="pin-dot" id="d1"></span>
        <span class="pin-dot" id="d2"></span>
        <span class="pin-dot" id="d3"></span>
      </div>
      <input type="hidden" name="pin" id="pin-input" maxlength="4" />

      <div class="numpad">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(n => `
          <button type="button" class="numpad-btn ${n===''?'numpad-empty':''}" onclick="${n==='⌫'?'delDigit()':n!==''?`addDigit(${n})`:''}">
            ${n !== '' ? n : ''}
          </button>
        `).join('')}
      </div>

      <div class="login-hint">
        <p>Staff PIN or Cleaner PIN</p>
      </div>
    </form>
  </div>

  <script>
    let pin = '';
    function updateDisplay() {
      for (let i = 0; i < 4; i++) {
        const dot = document.getElementById('d' + i);
        dot.classList.toggle('filled', i < pin.length);
      }
      document.getElementById('pin-input').value = pin;
    }
    function addDigit(d) {
      if (pin.length < 4) {
        pin += d;
        updateDisplay();
        if (pin.length === 4) {
          setTimeout(() => document.querySelector('form').submit(), 150);
        }
      }
    }
    function delDigit() {
      pin = pin.slice(0, -1);
      updateDisplay();
    }
  </script>
</body>
</html>`;
}

module.exports = router;
