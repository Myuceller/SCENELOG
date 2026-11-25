import { achievementCatalogVersion, achievements, type AchievementCollection } from "./achievements";
export const ACHIEVEMENT_REFRESH_MESSAGE = "도전과제가 업데이트됐어요. 페이지를 새로고침해 주세요.";
export function validateAchievementCollection(value: AchievementCollection): AchievementCollection {
  const ids = new Set(value.achievements?.map(item => item.id));
  if (value.catalogVersion !== achievementCatalogVersion || ids.size !== achievements.length ||
      value.achievements.length !== achievements.length || achievements.some(item => !ids.has(item.id))) {
    throw new Error(ACHIEVEMENT_REFRESH_MESSAGE);
  }
  return value;
}
/** Covers session refresh as well as fetch; an auth lock must not leave the panel spinning forever. */
export async function withAchievementDeadline<T>(signal: AbortSignal, operation: (signal: AbortSignal) => Promise<T>, ms = 12_000): Promise<T> {
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  let onAbort!: () => void;
  const timer = setTimeout(() => controller.abort(new Error("도전과제 응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.")), ms);
  try {
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(combined.reason);
      combined.addEventListener("abort", onAbort, { once: true });
    });
    combined.throwIfAborted();
    return await Promise.race([operation(combined), aborted]);
  } finally {
    clearTimeout(timer);
    combined.removeEventListener("abort", onAbort);
  }
}
