const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables.');
    }
    _client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: { persistSession: false },
        db: { schema: 'public' },
        global: {
          headers: { 'x-connection-encrypted': 'true' }
        }
      }
    );
  }
  return _client;
}

module.exports = new Proxy({}, {
  get(_, prop) {
    return (...args) => getClient()[prop](...args);
  }
});
