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
  supabaseUrl:        '<https://nvuzpyrufeqblqozyeln.supabase.co>',
  supabaseAnonKey:    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXpweXJ1ZmVxYmxxb3p5ZWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjgxNjAsImV4cCI6MjA5MzE0NDE2MH0.8wy12nxlex0bKcb4atFQer5C4rc_paej8rZ784dM8Ew',
  supabaseServiceKey: 'sb_secret_6jEGT80z-9zMfDChemqN2g_PRMXBkmT',
  adminPassword:      'spritz2026'
};
