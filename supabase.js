let client = null;
let currentUser = null;

export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
  }
}

async function resolveConfiguration() {
  const localConfig = window.LITTLE_WINS_CONFIG || {};
  if (localConfig.SUPABASE_URL && localConfig.SUPABASE_ANON_KEY) {
    return localConfig;
  }

  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (response.ok) {
      const runtimeConfig = await response.json();
      if (runtimeConfig.SUPABASE_URL && runtimeConfig.SUPABASE_ANON_KEY) {
        return runtimeConfig;
      }
    }
  } catch (error) {
    // A plain static server will not have /api/config. The detailed setup error
    // below tells the user to use config.js instead.
    console.info("Runtime config endpoint unavailable:", error.message);
  }

  throw new ConfigurationError(
    "Supabase configuration was not found. Set Vercel environment variables or fill config.js for a plain static host."
  );
}

function requireClient() {
  if (!client) throw new Error("Supabase client has not been initialized.");
  return client;
}

function requireUser() {
  if (!currentUser) throw new Error("Anonymous user session is unavailable.");
  return currentUser;
}

export async function initializeDatabase() {
  if (!window.supabase?.createClient) {
    throw new ConfigurationError("The Supabase JavaScript SDK failed to load.");
  }

  const config = await resolveConfiguration();
  client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;

  let session = sessionData.session;
  if (!session) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    session = data.session;
  }

  currentUser = session?.user || null;
  if (!currentUser) throw new Error("Anonymous sign-in did not return a user.");

  const { error: profileError } = await client.rpc("ensure_user_profile");
  if (profileError) throw profileError;

  client.auth.onAuthStateChange((_event, nextSession) => {
    currentUser = nextSession?.user || null;
  });

  return currentUser;
}

export function getCurrentUser() {
  return requireUser();
}

export async function fetchSettings() {
  const { data, error } = await requireClient()
    .from("settings")
    .select("*")
    .eq("user_id", requireUser().id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSettings(changes) {
  const { data, error } = await requireClient()
    .from("settings")
    .update(changes)
    .eq("user_id", requireUser().id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTodayLog(localDate) {
  const { data, error } = await requireClient()
    .from("daily_logs")
    .select("*")
    .eq("user_id", requireUser().id)
    .eq("log_date", localDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitCheckIn(status, localDate) {
  const { data, error } = await requireClient().rpc("check_in", { p_status: status, p_log_date: localDate });
  if (error) throw error;
  return data;
}

export async function fetchLogsBetween(startDate, endDate) {
  const { data, error } = await requireClient()
    .from("daily_logs")
    .select("id, log_date, status, created_at")
    .eq("user_id", requireUser().id)
    .gte("log_date", startDate)
    .lte("log_date", endDate)
    .order("log_date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchRecentLogs(limit = 45) {
  const { data, error } = await requireClient()
    .from("daily_logs")
    .select("id, log_date, status, created_at")
    .eq("user_id", requireUser().id)
    .order("log_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchRewards(limit = 100) {
  const { data, error } = await requireClient()
    .from("rewards")
    .select("*")
    .eq("user_id", requireUser().id)
    .order("earned_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchAchievements() {
  const { data, error } = await requireClient()
    .from("achievements")
    .select("achievement_key, unlocked_at")
    .eq("user_id", requireUser().id)
    .order("unlocked_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchWishlist() {
  const { data, error } = await requireClient()
    .from("wishlist")
    .select("*")
    .eq("user_id", requireUser().id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createWishlistItem(item) {
  const { data, error } = await requireClient()
    .from("wishlist")
    .insert({ ...item, user_id: requireUser().id })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateWishlistItem(id, changes) {
  const { data, error } = await requireClient()
    .from("wishlist")
    .update(changes)
    .eq("id", id)
    .eq("user_id", requireUser().id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWishlistItem(id) {
  const { error } = await requireClient()
    .from("wishlist")
    .delete()
    .eq("id", id)
    .eq("user_id", requireUser().id);
  if (error) throw error;
}

export async function fetchStatistics() {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { data, error } = await requireClient().rpc("get_statistics", { p_local_date: localDate });
  if (error) throw error;
  return data;
}

export async function fetchBackupData() {
  const { data, error } = await requireClient().rpc("get_backup_data");
  if (error) throw error;
  return data;
}

export async function restoreBackupData(backup) {
  const { data, error } = await requireClient().rpc("restore_backup_data", { p_backup: backup });
  if (error) throw error;
  return data;
}
