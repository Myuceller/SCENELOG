import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { achievements, evaluateAchievements, findAchievement, formatOwnershipPercent, type AchievementFact } from "../src/lib/achievements";
import { createAchievementRepository } from "../src/server/achievements/repository";
import { createAchievementHandlers } from "../src/server/achievements/handlers";
import { applyMigrations, loadMigrations } from "../src/server/db/migrate";
import type { DatabasePool } from "../src/server/db/pool";
import { ApiError } from "../src/server/http/errors";

const fact = (movieId: string, extra: Partial<AchievementFact> = {}): AchievementFact => ({ movieId, watchedOn: "2026-01-01", reviewed: false, detailed: false, genres: ["코미디"], ...extra });
const progress = (facts: AchievementFact[], id: string) => evaluateAchievements(facts, "2026-11-25").find(item => item.id === id)!;

test("new members receive a starter title; catalogue IDs and fallback stay valid", () => {
  assert.equal(progress([], "first-seat").current, 1);
  assert.equal(progress([], "first-scene").current, 0);
  assert.equal(new Set(achievements.map(item => item.id)).size, achievements.length);
  assert.equal(findAchievement("unknown").id, "first-seat");
});

test("genre/movie counts deduplicate rewatches, count every declared genre and ignore future dates", () => {
  const facts = Array.from({ length: 10 }, (_, i) => fact(`movie-${i}`, { genres: ["코미디", "SF", "코미디"] }));
  facts.push(fact("movie-0"), fact("future", { watchedOn: "2099-01-01" }));
  assert.equal(progress(facts, "comedy-10").current, 10);
  assert.equal(progress(facts, "sf-10").current, 10);
  assert.equal(progress(facts, "small-cinema").current, 10);
  assert.equal(progress([fact("no-date", { watchedOn: "" })], "first-scene").current, 1);
});

test("calendar days, reviews, detail ratings and repeat viewings have separate counting rules", () => {
  const facts = [fact("a", { reviewed: true, detailed: true }), fact("a", { reviewed: true, detailed: true }),
    fact("a", { watchedOn: "2026-01-02" }), fact("a", { watchedOn: "2026-01-03" }), fact("b", { watchedOn: "" })];
  assert.equal(progress(facts, "reviews-10").current, 1);
  assert.equal(progress(facts, "details-10").current, 1);
  assert.equal(progress(facts, "calendar-10").current, 3);
  assert.equal(progress(facts, "rewatch-3").current, 3);
  assert.equal(progress(Array.from({ length: 3 }, (_, i) => fact(`${i}`, { genres: ["코미디", "SF", "공포", "액션", "로맨스"] })), "genre-explorer").current, 5);
});

async function memoryDb(t: TestContext) {
  const engine = new PGlite(); t.after(() => engine.close());
  let queue = Promise.resolve();
  const db: DatabasePool = { async connect() {
    const previous = queue; let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; }); await previous;
    return {
      async query<T>(sql: string, values?: unknown[]) {
        if (values) return engine.query<T>(sql, values);
        return { rows: ((await engine.exec(sql)).at(-1)?.rows ?? []) as T[] };
      }, release,
    };
  } };
  const migrations = await loadMigrations(resolve("db/migrations"));
  await applyMigrations(db, migrations.slice(0, -1));
  await engine.query("INSERT INTO scenelog.profiles (user_id, display_name) VALUES ('existing', '기존 회원')");
  await applyMigrations(db, migrations);
  return { engine, db };
}

test("migration grants old/new members a default; earned titles survive edits and remain account-scoped", async t => {
  const { db, engine } = await memoryDb(t);
  const repo = createAchievementRepository(() => db);
  assert.deepEqual((await engine.query("SELECT equipped_title FROM scenelog.profiles WHERE user_id = 'existing'")).rows, [{ equipped_title: "first-seat" }]);
  const starter = await repo.read("new-member");
  assert.equal(starter.equippedTitle, "first-seat");
  assert.equal(starter.achievements.filter(item => item.unlockedAt).length, 1);
  assert.equal((await engine.query("SELECT title_id FROM scenelog.user_achievements WHERE user_id = 'existing'")).rows.length, 1);
  await engine.query("INSERT INTO scenelog.archive_owners (user_id) VALUES ('new-member')");
  for (let i = 0; i < 10; i++) {
    await engine.query("INSERT INTO scenelog.archive_movies (user_id, movie_id, position, metadata) VALUES ($1,$2,$3,$4)",
      ["new-member", `m${i}`, i, JSON.stringify({ id: `m${i}`, genres: ["코미디", "SF"] })]);
    await engine.query(`INSERT INTO scenelog.viewing_logs (user_id,id,movie_id,position,watched_on,review,themes,spoiler,created_at)
      VALUES ($1,$2,$3,$4,'2026-01-01',$5,$6,false,now())`,
      ["new-member", `log${i}`, `m${i}`, i, i === 0 ? " \n\t\r " : "좋았어요", JSON.stringify({ ost: 0, visual: 0, story: 0 })]);
  }
  const earned = await repo.read("new-member");
  assert.ok(earned.achievements.find(item => item.id === "comedy-10")?.unlockedAt);
  assert.equal(earned.achievements.find(item => item.id === "reviews-10")?.current, 9);
  assert.equal(earned.achievements.find(item => item.id === "details-10")?.current, 10, "zero is a valid theme score");
  const selected = await repo.equip("new-member", "comedy-10");
  assert.equal(selected.equippedTitle, "comedy-10");
  await assert.rejects(repo.equip("existing", "comedy-10"), (error: unknown) => error instanceof ApiError && error.status === 403);
  assert.equal((await repo.read("existing")).equippedTitle, "first-seat");
  await engine.query("DELETE FROM scenelog.viewing_logs WHERE user_id = 'new-member'");
  const retained = await repo.read("new-member");
  assert.equal(retained.equippedTitle, "comedy-10");
  assert.ok(retained.achievements.find(item => item.id === "comedy-10")?.unlockedAt);
  assert.equal(retained.achievements.find(item => item.id === "comedy-10")?.current, 0);
  assert.equal((await repo.equip("new-member", "first-seat")).equippedTitle, "first-seat");
  await Promise.all([repo.read("new-member"), repo.read("new-member")]);
  assert.equal((await engine.query("SELECT * FROM scenelog.user_achievements WHERE user_id = 'new-member' AND title_id = 'comedy-10'")).rows.length, 1);
});

test("achievement API rejects forged identities, unknown/locked titles, oversized bodies and unauthenticated requests", async t => {
  const { db } = await memoryDb(t);
  const repo = createAchievementRepository(() => db);
  const handlers = createAchievementHandlers({ authenticate: async () => "member", repository: repo });
  const request = (body: unknown, type = "application/json") => new Request("http://localhost/api/achievements?userId=existing", {
    method: "PUT", headers: { "content-type": type }, body: JSON.stringify(body),
  });
  assert.equal((await handlers.PUT(request({ titleId: "comedy-10" }))).status, 403);
  assert.equal((await handlers.PUT(request({ titleId: "first-seat", userId: "existing" }))).status, 400);
  assert.equal((await handlers.PUT(request({ titleId: "unknown" }))).status, 400);
  assert.equal((await handlers.PUT(request({ titleId: "x".repeat(2000) }))).status, 413);
  assert.equal((await handlers.PUT(request({ titleId: "first-seat" }, "text/plain"))).status, 415);
  assert.equal((await handlers.PUT(new Request("http://localhost/api/achievements", { method: "PUT", headers: { "content-type": "application/json" }, body: "{" }))).status, 400);
  const result = await handlers.PUT(request({ titleId: "first-seat" }));
  assert.equal(result.status, 200); assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await result.json()).equippedTitle, "first-seat");
  const denied = createAchievementHandlers({ authenticate: async () => { throw new ApiError(401, "AUTH_REQUIRED", "로그인이 필요합니다."); }, repository: repo });
  assert.equal((await denied.GET(new Request("http://localhost/api/achievements"))).status, 401);
});


test("movie milestones cover every hundred to 1000; gold begins at 1000 without changing existing IDs", () => {
  const titles = achievements.filter(item => item.metric === "movies");
  for (let n = 100; n <= 1000; n += 100) assert.ok(titles.some(item => item.target === n));
  assert.equal(findAchievement("hundred-scenes").target, 100);
  assert.equal(findAchievement("comedy-10").title, "웃음 수집가");
  for (const item of titles) assert.equal(item.effect === "gold", item.target >= 1000);
  const facts = Array.from({ length: 999 }, (_, i) => fact(`m${i}`));
  assert.equal(progress(facts, "movies-1000").current, 999);
  facts.push(fact("m0"));
  assert.equal(progress(facts, "movies-1000").current, 999);
  facts.push(fact("m999"));
  assert.equal(progress(facts, "movies-1000").current, 1000);
  assert.ok(achievements.length >= 100);
});

test("one movie per month earns a streak across years; gaps, duplicates, missing and future dates do not inflate it", () => {
  const facts = [fact("a", { watchedOn: "2025-11-30" }), fact("b", { watchedOn: "2025-12-01" }),
    fact("c", { watchedOn: "2026-01-01" }), fact("d", { watchedOn: "2026-01-30" }),
    fact("e", { watchedOn: "2026-03-01" }), fact("f", { watchedOn: "2026-12-01" }), fact("g", { watchedOn: "" })];
  assert.equal(progress(facts, "months-3").current, 4);
  assert.equal(progress(facts, "monthly-streak-3").current, 3);
  assert.equal(progress([fact("a", { watchedOn: "2026-01-01" }), fact("b", { watchedOn: "2026-03-01" })], "monthly-streak-3").current, 1);
  assert.equal(progress([], "monthly-streak-3").current, 0);
});

test("ownership percentages distinguish zero, rare, fractional and universal titles", () => {
  assert.equal(formatOwnershipPercent(0, 0), "0%");
  assert.equal(formatOwnershipPercent(0, 3), "0%");
  assert.equal(formatOwnershipPercent(1, 3), "33.3%");
  assert.equal(formatOwnershipPercent(1, 10000), "0.1% 미만");
  assert.equal(formatOwnershipPercent(9999, 10000), "99.9%");
  assert.equal(formatOwnershipPercent(3, 3), "100%");
});

test("ownership aggregates all profiles and permanent unlocks, never equipment or another member's private progress", async t => {
  const { db, engine } = await memoryDb(t);
  const repo = createAchievementRepository(() => db);
  await repo.read("other");
  await engine.query("INSERT INTO scenelog.user_achievements (user_id, title_id) VALUES ('existing', 'comedy-10')");
  const result = await repo.read("reader");
  assert.equal(result.population.totalMembers, 3);
  assert.ok(Number.isFinite(Date.parse(result.population.calculatedAt)));
  assert.equal(result.achievements.find(item => item.id === "first-seat")?.holderCount, 3);
  const comedy = result.achievements.find(item => item.id === "comedy-10")!;
  assert.equal(comedy.holderCount, 1);
  assert.equal(comedy.current, 0);
  assert.equal(comedy.unlockedAt, null);
  assert.equal(result.achievements.find(item => item.id === "movies-1000")?.holderCount, 0);
  await repo.equip("existing", "comedy-10");
  const equipped = await repo.read("reader");
  assert.equal(equipped.achievements.find(item => item.id === "comedy-10")?.holderCount, 1);
  await engine.query("DELETE FROM scenelog.profiles WHERE user_id = 'existing'");
  const deleted = await repo.read("reader");
  assert.equal(deleted.population.totalMembers, 2);
  assert.equal(deleted.achievements.find(item => item.id === "comedy-10")?.holderCount, 0);
  assert.equal(deleted.achievements.find(item => item.id === "first-seat")?.holderCount, 2);
});


test("all genres retain bronze ten, add silver fifty, and unlock gold only after one hundred distinct films", () => {
  const genres = [...new Set(achievements.filter(item => item.metric === "genre").map(item => item.genre!))];
  for (const genre of genres) {
    const family = achievements.filter(item => item.genre === genre);
    for (const [target, metal] of [[10, "bronze"], [50, "silver"], [100, "gold"]] as const) {
      const title = family.find(item => item.target === target)!;
      assert.ok(title, `${genre} ${target}`);
      assert.equal(title.ornament?.metal, metal);
      const facts = Array.from({ length: target - 1 }, (_, i) => fact(`m${i}`, { genres: [genre] }));
      facts.push(fact("m0", { genres: [genre] }));
      assert.equal(progress(facts, title.id).current, target - 1);
      facts.push(fact(`m${target}`, { genres: [genre] }));
      assert.equal(progress(facts, title.id).current, target);
    }
    assert.ok(family.find(item => item.target === 30), "existing titles stay available");
  }
});
