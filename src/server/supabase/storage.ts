import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "@/server/http/errors";

export const AVATAR_BUCKET = "profile-avatars";

export function getStorageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new ApiError(503, "STORAGE_NOT_CONFIGURED", "프로필 사진 저장소 설정이 필요합니다.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage;
}

export function avatarUrl(path: string | null): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  return path && url ? `${url}/storage/v1/object/public/${AVATAR_BUCKET}/${path}` : null;
}
