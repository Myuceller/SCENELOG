import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { ApiError } from "@/server/http/errors";

let client: SupabaseClient | undefined;
/** Token verification only. Never persists a user's session on the server. */
export function getSupabaseAuth() {
  if (!client) {
    try {
      const { url, key } = getSupabaseConfig();
      client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    } catch {
      throw new ApiError(503, "AUTH_NOT_CONFIGURED", "로그인 서비스 설정이 필요합니다.");
    }
  }
  return client.auth;
}
