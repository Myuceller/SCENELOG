import { getSupabaseClient } from "@/lib/supabase/client";
import { authMessage } from "@/lib/supabase/auth-errors";

export const SOCIAL_UPDATED = "scenelog:social-updated";
export function publishSocialUpdate(userId: string) {
  window.dispatchEvent(new CustomEvent(SOCIAL_UPDATED, { detail: { userId } }));
}

export async function requestSocial<T>(userId: string, query = "", options?: { method: "PUT" | "PATCH"; body: unknown }, signal?: AbortSignal): Promise<T> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw new Error(authMessage(error));
  if (!data.session || data.session.user.id !== userId) throw new Error("다시 로그인해 주세요.");
  const response = await fetch(`/api/social${query ? `?${query}` : ""}`, {
    method: options?.method ?? "GET", cache: "no-store", signal,
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(options ? { "Content-Type": "application/json" } : {}) },
    ...(options ? { body: JSON.stringify(options.body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "친구 정보를 불러오지 못했습니다.");
  return payload;
}
