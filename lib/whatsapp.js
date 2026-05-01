const twilio = require('twilio');

// Get Twilio client for a specific hotel
function getClient(hotel) {
  const sid = hotel.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
  const token = hotel.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function formatPhone(phone) {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return `whatsapp:${cleaned}`;
}

async function sendWelcome(hotel, guestName, phone, roomNumber) {
  const client = getClient(hotel);
  if (!client || !phone) return;
  const from = `whatsapp:${hotel.twilio_whatsapp_from || process.env.TWILIO_WHATSAPP_FROM || '+14155238886'}`;
  const firstName = guestName.split(' ')[0];

  const extras = hotel.extra_info ? `\n\nℹ️ ${hotel.extra_info}` : '';

  const body = `🏨 *${hotel.name}* — Welcome!

Dear ${firstName}, welcome! We hope you have a wonderful stay.

🛏️ *Your room:* ${roomNumber}
⏰ *Check-out:* ${hotel.checkout_time || '11:00'} AM

📶 *WiFi*
Network: ${hotel.wifi_name || 'Ask at reception'}
Password: ${hotel.wifi_password || 'Ask at reception'}

🍽️ *Restaurant*
Open: ${hotel.restaurant_hours || 'Ask at reception'}${extras}

If you need anything, ask at reception. Enjoy your stay! 😊`;

  try {
    await client.messages.create({ from, to: formatPhone(phone), body });
    console.log(`✅ Welcome WhatsApp sent to ${phone}`);
  } catch (err) {
    console.warn(`⚠️  WhatsApp failed: ${err.message}`);
  }
}

async function sendCheckoutReminder(hotel, guestName, phone, checkoutDate, roomNumber) {
  const client = getClient(hotel);
  if (!client || !phone) return;
  const from = `whatsapp:${hotel.twilio_whatsapp_from || process.env.TWILIO_WHATSAPP_FROM || '+14155238886'}`;
  const firstName = guestName.split(' ')[0];

  const body = `🏨 *${hotel.name}* — Checkout Reminder

Dear ${firstName}, your checkout is tomorrow.

🛏️ *Room:* ${roomNumber}
📅 *Date:* ${checkoutDate}
⏰ *Time:* ${hotel.checkout_time || '11:00'} AM

Please return your key at reception. Thank you for staying with us! 🙏`;

  try {
    await client.messages.create({ from, to: formatPhone(phone), body });
    console.log(`✅ Checkout reminder sent to ${phone}`);
  } catch (err) {
    console.warn(`⚠️  WhatsApp failed: ${err.message}`);
  }
}

module.exports = { sendWelcome, sendCheckoutReminder };
