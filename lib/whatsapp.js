const twilio = require('twilio');

let _client = null;

function getClient() {
  if (!_client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      console.warn('⚠️  Twilio credentials not set — WhatsApp disabled');
      return null;
    }
    _client = twilio(accountSid, authToken);
  }
  return _client;
}

const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM || '+14155238886'}`;

// Format phone number to WhatsApp format
function formatPhone(phone) {
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Add + if missing
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return `whatsapp:${cleaned}`;
}

// Send welcome message on check-in
async function sendWelcome(guestName, phone, roomNumber) {
  const client = getClient();
  if (!client || !phone) return;

  const firstName = guestName.split(' ')[0];
  const message = `🏨 *Hotel Kerchova* — Welcome!

Dear ${firstName}, welcome to Hotel Kerchova! We hope you have a wonderful stay.

🛏️ *Your room:* ${roomNumber}
⏰ *Check-out:* 11:00 AM

📶 *WiFi*
Network: Terasa
Password: terasa12345

🍽️ *Restaurant*
Open daily: 07:00 – 23:00
Breakfast, lunch & dinner available.

If you need anything, don't hesitate to ask at reception.

Enjoy your stay! 😊`;

  try {
    await client.messages.create({
      from: FROM,
      to: formatPhone(phone),
      body: message
    });
    console.log(`✅ Welcome WhatsApp sent to ${phone}`);
  } catch (err) {
    console.warn(`⚠️  WhatsApp send failed: ${err.message}`);
  }
}

// Send checkout reminder
async function sendCheckoutReminder(guestName, phone, checkoutDate, roomNumber) {
  const client = getClient();
  if (!client || !phone) return;

  const firstName = guestName.split(' ')[0];
  const message = `🏨 *Hotel Kerchova* — Checkout Reminder

Dear ${firstName}, this is a friendly reminder that your checkout is tomorrow.

🛏️ *Room:* ${roomNumber}
📅 *Checkout date:* ${checkoutDate}
⏰ *Checkout time:* 11:00 AM

Please make sure to return your room key at reception.

We hope you had a great stay and look forward to seeing you again! 🙏

_Reply CONFIRM to confirm your checkout, or call reception if you need a late checkout._`;

  try {
    await client.messages.create({
      from: FROM,
      to: formatPhone(phone),
      body: message
    });
    console.log(`✅ Checkout reminder WhatsApp sent to ${phone}`);
  } catch (err) {
    console.warn(`⚠️  WhatsApp send failed: ${err.message}`);
  }
}

module.exports = { sendWelcome, sendCheckoutReminder };
