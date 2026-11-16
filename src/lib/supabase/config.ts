/** Explicit accesses let Next.js inline public environment variables. */
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || !key.startsWith("sb_publishable_")) {
    throw Object.assign(new Error("Supabase configuration missing"), { code: "supabase_not_configured" });
  }
  return { url, key };
}
