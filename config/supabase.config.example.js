/* ===================================================================
 * Dr.Coach! v3.0.0 — Supabase configuration
 * -------------------------------------------------------------------
 * Copy this file to `supabase.config.js` and fill in YOUR project's
 * URL and publishable (anon) key. The app will gracefully fall back
 * to local-only mode if the file is missing or the credentials are
 * the placeholder values.
 *
 * ⚠️  NEVER put the service_role key here. Frontend only uses anon.
 * =================================================================== */

window.DRCOACH_SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT-ref.supabase.co',
  anonKey: 'YOUR-PUBLISHABLE-ANON-KEY',
  // Optional: display names shown on the login screen as a hint.
  // The actual login still requires email + password registered in
  // Supabase Dashboard → Authentication → Users.
  userHints: [
    { email: 'usuario1@drcoach.local', label: 'Usuario 1' },
    { email: 'usuario2@drcoach.local', label: 'Usuario 2' }
  ]
};
