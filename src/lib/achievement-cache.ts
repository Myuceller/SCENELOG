import { achievementCatalogVersion, type AchievementCollection } from "./achievements";
const cache = new Map<string, { data: AchievementCollection; savedAt: number }>();
export const ACHIEVEMENT_CACHE_MS = 30_000;
export function readAchievementCache(userId: string, now = Date.now()) {
  const entry = cache.get(userId);
  if (!entry || entry.data.catalogVersion !== achievementCatalogVersion || now - entry.savedAt > 5 * 60_000) return null;
  return { data: entry.data, fresh: now - entry.savedAt < ACHIEVEMENT_CACHE_MS };
}
export function rememberAchievements(userId: string, data: AchievementCollection, now = Date.now()) {
  cache.delete(userId);
  cache.set(userId, { data, savedAt: now });
  // Memory-only recent accounts; never reuse one account's results for another account.
  if (cache.size > 5) cache.delete(cache.keys().next().value!);
}
export function invalidateAchievements(userId: string) { cache.delete(userId); }
