import assert from "node:assert/strict";
import { test } from "node:test";
import { getDayCover } from "../src/lib/taste-profile";
import { createSeedState, validState, type FilmLog } from "../src/lib/scene-model";

const log = (id: string, movieId: string, rating: number | null, extra: Partial<FilmLog> = {}): FilmLog => ({ id, movieId, rating, userId: "guma", watchedOn: "2026-11-06", createdAt: "2026-11-06T00:00:00Z", review: "", themes: {}, spoiler: false, ...extra });

test("달력 대표 포스터는 사용자 선택을 우선하고 다른 계정이나 날짜의 선택은 무시한다", () => {
  const entries = [log("earlier", "a", 4, { createdAt: "2026-11-05T00:00:00Z" }), log("latest", "b", 5), log("other", "c", 4.5, { userId: "momo" })];
  assert.equal(getDayCover(entries, "guma", "2026-11-06")?.id, "latest");
  assert.equal(getDayCover(entries, "guma", "2026-11-06", "earlier")?.id, "earlier");
  assert.equal(getDayCover(entries, "guma", "2026-11-06", "other")?.id, "latest");
  assert.equal(getDayCover(entries, "guma", "2026-11-07", "earlier"), undefined);
});

test("대표로 선택한 기록의 날짜가 바뀌면 기존 날짜는 남아 있는 영화로 돌아간다", () => {
  const entries = [log("moved", "a", 4, { watchedOn: "2026-11-05" }), log("remaining", "b", 5)];
  assert.equal(getDayCover(entries, "guma", "2026-11-06", "moved")?.id, "remaining");
  const state = createSeedState();
  assert.equal(validState(state), true);
  assert.equal(validState({ ...state, calendarCovers: { guma: { "2026-11-06": "remaining" } } }), true);
});
