import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMovie } from "../src/lib/archive-movies";
import { ratingPeers, viewingArchive } from "../src/lib/collection-insights";
import type { FilmLog } from "../src/lib/scene-model";

const movies = ["current", "a", "b", "c"].map(id => normalizeMovie({ id, title: id, originalTitle: id, year: 2026, source: "tmdb", rating: null, poster: null, description: "", genres: [] }));
const log = (id: string, movieId: string, rating: number | null, extra: Partial<FilmLog> = {}): FilmLog => ({ id, movieId, rating, userId: "guma", watchedOn: "2026-11-06", createdAt: "2026-11-06T00:00:00Z", review: "", themes: {}, spoiler: false, ...extra });

test("같은 별점 비교는 현재 영화와 다른 계정을 제외하고 소수 첫째 자리까지 일치한다", () => {
  const entries = [log("self", "current", 4.3), log("a", "a", 4.3), log("b", "b", 4.4), log("friend", "c", 4.3, { userId: "gamja" })];
  assert.deepEqual(ratingPeers(movies, entries, "guma", "current", 4.2 + .1).map(item => item.movie.id), ["a"]);
});

test("0점도 비교하며 미평가와 테마 점수를 섞지 않는다", () => {
  const entries = [log("a", "a", 0), log("b", "b", null, { themes: { ost: 0 } }), log("c", "c", 4, { themes: { ost: 0 } })];
  assert.deepEqual(ratingPeers(movies, entries, "guma", "current", 0).map(item => item.movie.id), ["a"]);
  assert.equal(ratingPeers(movies, entries, "guma", "current", null).length, 0);
});

test("재관람 시 최근 평가만 비교하며 알려진 영화만 표시한다", () => {
  const entries = [log("old", "a", 4.5, { createdAt: "2026-10-01T00:00:00Z" }), log("new", "a", 3), log("b", "b", 4.5), log("missing", "missing", 4.5)];
  assert.deepEqual(ratingPeers(movies, entries, "guma", "current", 4.5).map(item => item.movie.id), ["b"]);
  assert.equal(ratingPeers(movies, entries, "guma", "current", 3)[0].log.id, "new");
});

test("VHS는 재관람 기록을 보존하고 실제 최근 관람일 순으로 묶는다", () => {
  const entries = [log("a-first", "a", 3, { watchedOn: "2026-10-03" }), log("a-second", "a", 4.5, { watchedOn: "2026-11-05", createdAt: "2026-11-07T00:00:00Z" }), log("b", "b", 0), log("friend", "a", 5, { userId: "momo" })];
  const result = viewingArchive(movies, entries, "guma");
  assert.deepEqual(result.map(item => item.movie.id), ["b", "a"]);
  assert.deepEqual(result[1].entries.map(entry => entry.id), ["a-second", "a-first"]);
  assert.equal(result[1].latest.rating, 4.5);
  assert.equal(entries.length, 4);
});

test("뒤늦게 등록한 과거 관람과 관람일 미정 기록을 최근 관람으로 둔갑시키지 않는다", () => {
  const entries = [log("a-recent", "a", 4.7), log("a-backfill", "a", 3, { watchedOn: "2026-01-01", createdAt: "2026-11-07T00:00:00Z" }), log("b", "b", 4.5, { watchedOn: "", createdAt: "2026-11-08T00:00:00Z" })];
  const result = viewingArchive(movies, entries, "guma");
  assert.equal(result[0].watchedOn, "2026-11-06");
  assert.equal(result[0].latest.id, "a-backfill");
  assert.equal(result[1].watchedOn, "");
  assert.equal(viewingArchive(movies, entries, "momo").length, 0);
});
