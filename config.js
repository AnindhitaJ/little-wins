/**
 * Local static-host fallback.
 *
 * For Vercel, leave these values blank and configure SUPABASE_URL and
 * SUPABASE_ANON_KEY as project environment variables. The app will retrieve
 * them from /api/config at runtime.
 *
 * For a plain static server, fill the two strings below. The Supabase anon key
 * is designed for public clients; Row Level Security protects user data.
 */
window.LITTLE_WINS_CONFIG = Object.freeze({
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
});
