import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMovie } from "../src/lib/archive-movies";
import { buildTasteProfile, getDayCover } from "../src/lib/taste-profile";
import { createSeedState, validState, type FilmLog } from "../src/lib/scene-model";

const movie = (id: string, genres: string[]) => normalizeMovie({ id, title: id, originalTitle: id, year: 2026, source: "tmdb" as const, rating: 4, poster: null, description: "", genres });
const films = [movie("a", ["드라마", "드라마", "로맨스"]), movie("b", ["SF"]), movie("c", ["드라마"])];
const log = (id: string, movieId: string, rating: number | null, extra: Partial<FilmLog> = {}): FilmLog => ({ id, movieId, rating, userId: "guma", watchedOn: "2026-11-06", createdAt: "2026-11-06T00:00:00Z", review: "", themes: {}, spoiler: false, ...extra });

test("취향 지도는 4.0점 이상만 포함하며 0점·미평가·다른 계정은 섞이지 않는다", () => {
  const result = buildTasteProfile(films, [log("a", "a", 4), log("b", "b", 0), log("c", "c", null), log("friend", "c", 5, { userId: "momo" })], "guma");
  assert.equal(result.ratedCount, 2);
  assert.deepEqual(result.favorites.map(item => item.movie.id), ["a"]);
  assert.equal(result.facets.find(facet => facet.name === "드라마")?.films.length, 1);
  assert.equal(result.facets.find(facet => facet.name === "SF")?.average, 0);
});

test("재관람은 취향 비율을 중복 집계하지 않으며 최신 별점 하락도 반영된다", () => {
  const logs = [log("old", "a", 5, { createdAt: "2026-10-01T00:00:00Z" }), log("new", "a", 3.9), log("b", "b", 4.6)];
  const result = buildTasteProfile(films, logs, "guma");
  assert.equal(result.ratedCount, 2);
  assert.deepEqual(result.favorites.map(item => item.movie.id), ["b"]);
});

test("월별 분석은 관람일을 기준으로 하며 해당 월 안의 최신 평가를 사용한다", () => {
  const logs = [log("old", "a", 4.7, { watchedOn: "2026-10-15", createdAt: "2026-10-15T00:00:00Z" }), log("new", "a", 2), log("undated", "b", 5, { watchedOn: "" })];
  assert.equal(buildTasteProfile(films, logs, "guma", "2026-10").favorites[0].log.rating, 4.7);
  assert.equal(buildTasteProfile(films, logs, "guma", "2026-11").favorites.length, 0);
});

test("기록이 없어도 거짓 분석 없이 0개의 취향과 잠정 상태를 제공한다", () => {
  const profile = buildTasteProfile(films, [], "guma");
  assert.equal(profile.ratedCount, 0);
  assert.equal(profile.provisional, true);
  assert.equal(profile.facets.length, 8);
  assert.ok(profile.facets.every(facet => facet.films.length === 0 && facet.average === null));
});

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
