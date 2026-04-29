const webpush = require('web-push');
const supabase = require('./supabase');

// Configure VAPID — called once at startup
function configureWebPush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('⚠️  VAPID keys not set — push notifications disabled');
    return false;
  }
  webpush.setVapidDetails(
    VAPID_EMAIL || 'mailto:admin@hotel.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  return true;
}

// Send push notification to all subscribers of a given role
async function sendPushToRole(role, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return; // silently skip if not configured

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('role', role);

  if (error || !subs || subs.length === 0) return;

  const message = JSON.stringify(payload);
  const staleIds = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message
        );
      } catch (err) {
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  // Clean up expired subscriptions
  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }
}

// Save a new push subscription for a role
async function saveSubscription(role, subscription) {
  const { endpoint, keys } = subscription;
  const { p256dh, auth } = keys;

  // Upsert — same endpoint can re-register after browser restart
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ role, endpoint, p256dh, auth }, { onConflict: 'endpoint' });

  return !error;
}

// Remove a subscription (user explicitly denies)
async function removeSubscription(endpoint) {
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

module.exports = { configureWebPush, sendPushToRole, saveSubscription, removeSubscription };
