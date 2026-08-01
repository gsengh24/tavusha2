const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://tbadcvbuxznataplchsv.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

if (!supabaseKey || supabaseKey.includes('your_supabase_secret_key')) {
  console.warn('⚠️ Warning: SUPABASE_SECRET_KEY or SUPABASE_PUBLISHABLE_KEY is not configured in backend/.env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = supabase;
