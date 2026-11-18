import { getSupabaseClient } from "@/lib/supabase/client";
import type { OwnProfile } from "@/types/social";

export const PROFILE_UPDATED = "scenelog:profile-updated";
export function publishProfile(profile: OwnProfile) {
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: profile }));
}
export async function requestProfile(userId: string, signal: AbortSignal, file?: File | null): Promise<OwnProfile> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error("다시 로그인해 주세요.");
  const body = file ? new FormData() : undefined;
  if (file) body!.append("file", file);
  const response = await fetch(file === undefined ? "/api/profile" : "/api/profile/avatar", {
    method: file === undefined ? "GET" : file === null ? "DELETE" : "POST",
    body, signal, cache: "no-store", headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error?.message ?? "프로필을 저장하지 못했습니다. 다시 시도해 주세요.");
  return result;
}
