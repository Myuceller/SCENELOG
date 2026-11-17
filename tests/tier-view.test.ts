import assert from "node:assert/strict";
import { test } from "node:test";
import { inPeriod, periodChip, periodLabel, periodYears, sortLogs, watchedDay } from "../src/lib/tier-view";
import type { FilmLog } from "../src/lib/scene-model";

const log = (id: string, rating: number | null, watchedOn: string, extra: Partial<FilmLog> = {}): FilmLog => ({
  id, movieId: id, rating, userId: "guma", watchedOn, createdAt: `${watchedOn || "2026-01-01"}T00:00:00Z`, review: "", themes: {}, spoiler: false, ...extra,
});

test("an unknown watched date falls back to the day it was recorded", () => {
  assert.equal(watchedDay(log("a", 4, "", { createdAt: "2025-03-09T12:00:00Z" })), "2025-03-09");
});

test("period filters by year and by month", () => {
  const a = log("a", 4, "2026-11-05"), b = log("b", 4, "2026-02-01"), c = log("c", 4, "2025-11-05");
  assert.deepEqual([a, b, c].filter(l => inPeriod(l, { mode: "all" })).length, 3);
  assert.deepEqual([a, b, c].filter(l => inPeriod(l, { mode: "year", year: 2026 })).map(l => l.id), ["a", "b"]);
  assert.deepEqual([a, b, c].filter(l => inPeriod(l, { mode: "month", year: 2026, month: 11 })).map(l => l.id), ["a"]);
});

test("labels and years", () => {
  assert.equal(periodLabel({ mode: "all" }), "전체");
  assert.equal(periodLabel({ mode: "year", year: 2026 }), "2026년");
  assert.equal(periodLabel({ mode: "month", year: 2026, month: 3 }), "2026년 3월");
  assert.equal(periodChip({ mode: "month", year: 2026, month: 3 }), "2026.03");
  assert.equal(periodChip({ mode: "year", year: 2026 }), "2026년");
  assert.deepEqual(periodYears([log("a", 4, "2024-05-05"), log("b", 4, "2026-01-02")], 2026), [2026, 2024]);
  assert.deepEqual(periodYears([], 2026), [2026]);
});

test("rating order breaks ties by the more recently watched film; unrated come last", () => {
  const logs = [log("old", 4.5, "2026-01-01"), log("none", null, "2026-11-01"), log("new", 4.5, "2026-06-01"), log("low", 3, "2026-12-01")];
  assert.deepEqual(sortLogs(logs, "rating").map(l => l.id), ["new", "old", "low", "none"]);
  assert.deepEqual(sortLogs(logs, "recent").map(l => l.id), ["low", "none", "new", "old"]);
  assert.deepEqual(logs.map(l => l.id), ["old", "none", "new", "low"], "input is not mutated");
});
