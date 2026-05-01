const cron = require('node-cron');
const supabase = require('./supabase');
const { sendCheckoutReminder } = require('./whatsapp');

// Runs every day at 10:00 AM UTC (12:00 PM North Macedonia time)
function startCheckoutReminderCron() {
  cron.schedule('0 10 * * *', async () => {
    console.log('🔔 Running checkout reminder cron...');

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Find all guests checking out tomorrow
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*, rooms(number)')
      .eq('check_out', tomorrowStr)
      .eq('status', 'checked_in')
      .not('phone', 'is', null);

    if (error) {
      console.warn('Checkout cron error:', error.message);
      return;
    }

    if (!reservations || reservations.length === 0) {
      console.log('No checkouts tomorrow.');
      return;
    }

    console.log(`Sending ${reservations.length} checkout reminder(s)...`);

    for (const r of reservations) {
      if (r.phone) {
        const roomNum = r.rooms ? r.rooms.number : '?';
        const fmtDate = d => { const [y,m,day] = d.split('-'); return `${day}.${m}.${y}`; };
        await sendCheckoutReminder(r.guest_name, r.phone, fmtDate(r.check_out), roomNum);
      }
    }

    console.log('✅ Checkout reminders sent.');
  });

  console.log('⏰ Checkout reminder cron scheduled (daily at 10:00 UTC)');
}

module.exports = { startCheckoutReminderCron };
