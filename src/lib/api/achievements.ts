import { getSupabaseClient } from "@/lib/supabase/client";
import type { AchievementCollection, AchievementId } from "@/lib/achievements";
import { rememberAchievements } from "@/lib/achievement-cache";
import { validateAchievementCollection, withAchievementDeadline } from "@/lib/achievement-request";
export async function requestAchievements(userId: string, signal: AbortSignal, titleId?: AchievementId): Promise<AchievementCollection> {
  return withAchievementDeadline(signal, async requestSignal => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    requestSignal.throwIfAborted();
    if (error || !data.session || data.session.user.id !== userId) throw new Error("다시 로그인해 주세요.");
    const response = await fetch("/api/achievements", {
      method: titleId ? "PUT" : "GET", cache: "no-store", signal: requestSignal,
      headers: { Authorization: `Bearer ${data.session.access_token}`, ...(titleId ? { "Content-Type": "application/json" } : {}) },
      ...(titleId ? { body: JSON.stringify({ titleId }) } : {}),
    });
    const result = await response.json().catch(() => null);
    requestSignal.throwIfAborted();
    if (!response.ok || !result) throw new Error(result?.error?.message ?? "도전과제를 불러오지 못했어요.");
    const collection = validateAchievementCollection(result);
    rememberAchievements(userId, collection);
    return collection;
  });
}
