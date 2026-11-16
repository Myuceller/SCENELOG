import "client-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let client: SupabaseClient | undefined;
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const { url, key } = getSupabaseConfig();
    client = createClient(url, key, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
