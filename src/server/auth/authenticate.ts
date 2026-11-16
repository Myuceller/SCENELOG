import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAuth } from "@/server/supabase/auth";
import { ApiError } from "@/server/http/errors";

type AuthVerifier = Pick<SupabaseClient["auth"], "getUser">;
export function createAuthenticator(getAuth: () => AuthVerifier = getSupabaseAuth) {
  return async function authenticate(request: Request): Promise<User> {
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token || token.length > 8192) throw new ApiError(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
    try {
      // Auth server validates the token; unverified client IDs/claims are never trusted.
      const { data, error } = await getAuth().getUser(token);
      if (error) {
        if (["bad_jwt", "session_not_found", "session_expired", "user_not_found", "user_banned"].includes(error.code ?? "") || error.status === 401 || error.status === 403) {
          throw new ApiError(401, "INVALID_SESSION", "로그인이 만료되었습니다. 다시 로그인해 주세요.");
        }
        throw error;
      }
      if (!data.user?.id) throw new ApiError(401, "INVALID_SESSION", "다시 로그인해 주세요.");
      return data.user;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "AUTH_UNAVAILABLE", "로그인을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };
}
export const authenticate = createAuthenticator();
