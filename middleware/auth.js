// Simple PIN-based auth middleware
// No accounts, no JWT — just a session flag

function requireAuth(req, res, next) {
  if (req.session && req.session.role) {
    return next();
  }
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  res.redirect('/login?error=admin_required');
}

function requireCleaner(req, res, next) {
  if (req.session && (req.session.role === 'admin' || req.session.role === 'cleaner')) {
    return next();
  }
  res.redirect('/login');
}

module.exports = { requireAuth, requireAdmin, requireCleaner };
