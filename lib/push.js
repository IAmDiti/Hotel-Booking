const webpush = require('web-push');
const supabase = require('./supabase');

let pushEnabled = false;

// Configure VAPID — called once at startup, never throws
function configureWebPush() {
  try {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn('⚠️  VAPID keys not set — push notifications disabled');
      return false;
    }
    // Always ensure email has mailto: prefix
    let email = VAPID_EMAIL || 'mailto:admin@hotel.com';
    if (!email.startsWith('mailto:') && !email.startsWith('https://')) {
      email = 'mailto:' + email;
    }
    webpush.setVapidDetails(email, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    pushEnabled = true;
    console.log('✅ Web Push configured');
    return true;
  } catch (err) {
    console.warn('⚠️  Web Push config failed (push disabled):', err.message);
    pushEnabled = false;
    return false;
  }
}

// Send push notification to all subscribers of a given role
async function sendPushToRole(role, payload) {
  if (!pushEnabled) return;

  let subs;
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('role', role);
    if (error || !data || data.length === 0) return;
    subs = data;
  } catch (err) {
    console.warn('Push: failed to fetch subscriptions:', err.message);
    return;
  }

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
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }
}

// Save a new push subscription for a role
async function saveSubscription(role, subscription) {
  try {
    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ role, endpoint, p256dh, auth }, { onConflict: 'endpoint' });
    return !error;
  } catch (err) {
    console.warn('Push: failed to save subscription:', err.message);
    return false;
  }
}

// Remove a subscription
async function removeSubscription(endpoint) {
  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (err) {
    console.warn('Push: failed to remove subscription:', err.message);
  }
}

module.exports = { configureWebPush, sendPushToRole, saveSubscription, removeSubscription };
