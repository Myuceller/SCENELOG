import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { normalizeMovie, mergeMovieCatalog } from "../src/lib/archive-movies";
import { createSeedState, latestLogs, friendIds, validState, type FilmLog } from "../src/lib/scene-model";
import { getPrintItems } from "../src/lib/print-sheet";
import { fetchMovieDetail } from "../src/lib/api/movies";
import type { Movie, MovieDetail } from "../src/types/movie";

afterEach(() => mock.restoreAll());

const listed: Movie = {
  id: "157336", title: "인터스텔라", originalTitle: "Interstellar", year: 2014,
  genres: ["SF"], rating: 4.3, poster: null, description: "우주를 향한 여정", source: "tmdb",
};
const detail: MovieDetail = { ...listed, director: "크리스토퍼 놀란", runtime: 169 };
function log(overrides: Partial<FilmLog> = {}): FilmLog {
  return {
    id: "log-1", userId: "guma", movieId: listed.id, rating: null, watchedOn: "2026-01-01",
    review: "", themes: {}, spoiler: false, createdAt: "2026-01-01T12:00:00Z", ...overrides,
  };
}

test("TMDB 목록의 누락된 포스터·감독·상영시간은 아카이브에서 안전하게 표시된다", () => {
  const movie = normalizeMovie(listed);
  assert.equal(movie.poster, "/images/poster-placeholder.svg");
  assert.equal(movie.director, null);
  assert.equal(movie.runtime, null);
  assert.equal(movie.detailLoaded, false);
  assert.equal(normalizeMovie(movie).detailLoaded, false);
});

test("다른 검색 페이지를 열어도 저장한 영화와 이미 조회한 상세 정보가 유지된다", () => {
  const saved = normalizeMovie(detail);
  const nextPage = normalizeMovie({ ...listed, id: "550", title: "다른 영화" });
  const result = mergeMovieCatalog([saved], [normalizeMovie(listed), nextPage]);
  assert.equal(result.length, 2);
  assert.equal(result[0].director, detail.director);
  assert.equal(result[0].runtime, 169);
  assert.equal(result[0].detailLoaded, true);
  assert.equal(result[1].id, "550");
  assert.deepEqual(mergeMovieCatalog([normalizeMovie(listed)], [saved]), [saved]);
});

test("재관람 후에는 최신 평가로 집계하고 원래의 날짜별 관람 기록은 보존한다", () => {
  const logs = [log(), log({ id: "log-2", rating: 4.8, createdAt: "2026-01-02T12:00:00Z" }), log({ id: "friend", userId: "gamja", rating: 2 })];
  assert.equal(latestLogs(logs, "guma").length, 1);
  assert.equal(latestLogs(logs, "guma")[0].rating, 4.8);
  assert.equal(logs.length, 3);
  assert.equal(logs[0].rating, null);
});

test("0점은 실제 평가이며 미평가와 구분해 출력한다", () => {
  const movies = [normalizeMovie(detail), normalizeMovie({ ...detail, id: "unrated" })];
  const items = getPrintItems(movies, [log({ rating: 0 }), log({ movieId: "unrated" })], "overall", "rating");
  assert.equal(items.length, 1);
  assert.equal(items[0].score, 0);
  assert.equal(items[0].tier, "D");
});

test("테마 점수는 전체 별점과 독립적으로 집계하고 높은 순으로 정렬한다", () => {
  const movies = [normalizeMovie(detail), normalizeMovie({ ...detail, id: "other" })];
  const logs = [log({ rating: 5, themes: { ost: 0 } }), log({ movieId: "other", rating: 1, themes: { ost: 4.7 } })];
  const ost = getPrintItems(movies, logs, "ost", "rating");
  assert.deepEqual(ost.map(item => item.score), [4.7, 0]);
  assert.equal(getPrintItems(movies, logs, "visual", "rating").length, 0);
});

test("별점이 없어도 직접 지정한 티어로 출력하고 자동 분류보다 우선한다", () => {
  const movies = [normalizeMovie(detail), normalizeMovie({ ...detail, id: "other" })];
  const items = getPrintItems(movies, [log({ tier: "S" }), log({ movieId: "other", rating: 5, tier: "B" })], "overall", "tier");
  assert.deepEqual(items.map(item => item.tier), ["S", "B"]);
  assert.equal(items[0].score, null);
});

test("기존 브라우저 기록과 새 TMDB 영화 캐시를 함께 불러올 수 있다", () => {
  const state = createSeedState();
  assert.equal(validState(state), true);
  assert.equal(validState({ ...state, catalog: [normalizeMovie(detail)] }), true);
  assert.equal(validState({ ...state, catalog: [{ id: 123 }] }), false);
  assert.equal(validState({ ...state, logs: [log({ rating: 5.1 })] }), false);
  assert.equal(validState({ ...state, version: 999 }), false);
});

test("친구 요청을 수락해야 친구 목록과 추천 대상에 포함된다", () => {
  const state = createSeedState();
  state.friends = [{ from: "guma", to: "momo", accepted: false }, { from: "gamja", to: "guma", accepted: true }];
  assert.deepEqual(friendIds(state), ["gamja"]);
});

test("영화 상세는 동일 출처 API로 요청하고 취소 신호를 전달한다", async () => {
  const controller = new AbortController();
  const fetchMock = mock.method(globalThis, "fetch", async () => Response.json({ data: detail }));
  assert.deepEqual(await fetchMovieDetail("157336", controller.signal), detail);
  assert.deepEqual(fetchMock.mock.calls[0].arguments, ["/api/movies/157336", { signal: controller.signal }]);
});

test("상세 API 실패 시 예시 데이터로 대체하지 않고 오류를 전달한다", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "영화를 찾을 수 없습니다." } }, { status: 404 }));
  await assert.rejects(fetchMovieDetail("999", new AbortController().signal), /영화를 찾을 수 없습니다/);
});
