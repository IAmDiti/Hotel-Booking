// Each session stores: role ('admin'|'cleaner'), hotelId, hotelSlug

function requireAuth(req, res, next) {
  if (req.session?.role && req.session?.hotelId) return next();
  const slug = req.hotel?.slug || req.params.hotelSlug || '';
  res.redirect(`/${slug}/login`);
}

function requireAdmin(req, res, next) {
  if (req.session?.role === 'admin' && req.session?.hotelId) return next();
  const slug = req.hotel?.slug || req.params.hotelSlug || '';
  res.redirect(`/${slug}/login`);
}

function requireCleaner(req, res, next) {
  if ((req.session?.role === 'admin' || req.session?.role === 'cleaner') && req.session?.hotelId) return next();
  const slug = req.hotel?.slug || req.params.hotelSlug || '';
  res.redirect(`/${slug}/login`);
}

module.exports = { requireAuth, requireAdmin, requireCleaner };
