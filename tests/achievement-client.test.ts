import assert from "node:assert/strict";
import { test } from "node:test";
import { achievements, achievementCatalogVersion, summarizeAchievements, type AchievementCollection } from "../src/lib/achievements";
import { readAchievementCache, rememberAchievements, invalidateAchievements } from "../src/lib/achievement-cache";
import { ACHIEVEMENT_REFRESH_MESSAGE, validateAchievementCollection, withAchievementDeadline } from "../src/lib/achievement-request";
const collection = (): AchievementCollection => ({ catalogVersion: achievementCatalogVersion, equippedTitle: "first-seat",
  population: { totalMembers: 1, calculatedAt: "2026-11-25T00:00:00Z" },
  achievements: achievements.map((item, i) => ({ id: item.id, target: item.target, current: i < 83 ? item.target : 0, unlockedAt: i < 83 ? "2026-11-25T00:00:00Z" : null, holderCount: i < 83 ? 1 : 0 })) });
test("83 earned titles and the total come from the same catalogue; unknown/duplicate entries never inflate counts", () => {
  const data = collection();
  assert.deepEqual(summarizeAchievements(data), { unlocked: 83, total: achievements.length });
  data.achievements.push(data.achievements[0], { ...data.achievements[0], id: "future-title" });
  assert.deepEqual(summarizeAchievements(data), { unlocked: 83, total: achievements.length });
});
test("old open tabs or incomplete API catalogues require refresh instead of mixing progress and definitions", () => {
  assert.equal(validateAchievementCollection(collection()).achievements.length, achievements.length);
  for (const data of [{ ...collection(), catalogVersion: "old-17" }, { ...collection(), achievements: collection().achievements.slice(0, 17) },
    { ...collection(), achievements: collection().achievements.map((item, i) => i === 0 ? { ...item, id: "unknown" } : item) }]) {
    assert.throws(() => validateAchievementCollection(data), { message: ACHIEVEMENT_REFRESH_MESSAGE });
  }
});
test("recent achievement cache is account-scoped, expires and can be invalidated after saving a record", () => {
  rememberAchievements("cache-a", collection(), 1000);
  assert.equal(readAchievementCache("cache-a", 2000)?.fresh, true);
  assert.equal(readAchievementCache("cache-b", 2000), null);
  assert.equal(readAchievementCache("cache-a", 32000)?.fresh, false);
  assert.equal(readAchievementCache("cache-a", 302000), null);
  invalidateAchievements("cache-a");
  assert.equal(readAchievementCache("cache-a", 2000), null);
  rememberAchievements("cache-a", { ...collection(), catalogVersion: "old-17" }, 1000);
  assert.equal(readAchievementCache("cache-a", 2000), null);
  invalidateAchievements("cache-a");
});
test("deadline exits even when session refresh never resolves; navigation cancellation stops the request", async () => {
  const controller = new AbortController();
  let timedSignal: AbortSignal | undefined;
  await assert.rejects(withAchievementDeadline(controller.signal, signal => { timedSignal = signal; return new Promise(() => {}); }, 10), /응답이 늦어지고/);
  assert.equal(timedSignal?.aborted, true);
  const cancel = new AbortController();
  const pending = withAchievementDeadline(cancel.signal, () => new Promise(() => {}));
  cancel.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(await withAchievementDeadline(controller.signal, async () => "loaded"), "loaded");
});
