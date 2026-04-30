// Replace these values with your own Supabase project credentials.
// Find them in: Supabase Dashboard → Project Settings → API
//
// The anon key is safe to expose publicly — it is rate-limited and
// protected by Row Level Security policies.
//
// The service_role key bypasses RLS and is used only for admin
// operations (adding drinks, advancing phase). It is gated behind
// the admin password URL check and is acceptable for a private
// party app. For production apps, move admin writes to an Edge Function.

const CONFIG = {
  supabaseUrl:        'YOUR_SUPABASE_URL',
  supabaseAnonKey:    'YOUR_SUPABASE_ANON_KEY',
  supabaseServiceKey: 'YOUR_SUPABASE_SERVICE_ROLE_KEY',
  adminPassword:      'spritz2025'
};
