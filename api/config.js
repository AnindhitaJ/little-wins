module.exports = function configHandler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    return response.status(503).json({
      error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY in the deployment environment."
    });
  }

  return response.status(200).json({
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: anonKey
  });
};
