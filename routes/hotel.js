const express = require('express');
const router = express.Router({ mergeParams: true });
const supabase = require('../lib/supabase');

// Load hotel middleware — attaches req.hotel to every request
router.use(async (req, res, next) => {
  const { hotelSlug } = req.params;
  if (!hotelSlug) return res.redirect('/');

  const { data: hotel } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', hotelSlug)
    .eq('active', true)
    .single();

  if (!hotel) return res.status(404).send('Hotel not found');
  req.hotel = hotel;
  next();
});

// Mount sub-routers
router.use('/', require('./auth'));
router.use('/reservations', require('./reservations'));
router.use('/rooms', require('./rooms'));
router.use('/cleaner', require('./cleaner'));
router.use('/analytics', require('./analytics'));
router.use('/settings', require('./hotelSettings'));

// Default redirect
router.get('/', (req, res) => {
  if (req.session?.hotelId === req.hotel.id && req.session?.role) {
    return res.redirect(`/${req.hotel.slug}/reservations`);
  }
  res.redirect(`/${req.hotel.slug}/login`);
});

module.exports = router;
