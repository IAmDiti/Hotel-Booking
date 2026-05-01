// Each session stores: role ('admin'|'cleaner'), hotelId, hotelSlug

function requireAuth(req, res, next) {
  if (req.session?.role && req.session?.hotelId) return next();
  res.redirect(`/${req.params.hotelSlug || ''}`);
}

function requireAdmin(req, res, next) {
  if (req.session?.role === 'admin' && req.session?.hotelId) return next();
  res.redirect(`/${req.hotelSlug || req.params.hotelSlug || ''}`);
}

function requireCleaner(req, res, next) {
  if ((req.session?.role === 'admin' || req.session?.role === 'cleaner') && req.session?.hotelId) return next();
  res.redirect('/');
}

module.exports = { requireAuth, requireAdmin, requireCleaner };
