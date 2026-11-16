import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMovie, type ArchiveMovie } from "../src/lib/archive-movies";
import { buildFigureCards } from "../src/lib/figure-cards";
import { buildTasteInsights } from "../src/lib/taste-insights";
import type { FilmLog } from "../src/lib/scene-model";

const movie = (id: string, genres: string[], extra: Partial<ArchiveMovie> = {}): ArchiveMovie => ({
  ...normalizeMovie({ id, title: `영화 ${id}`, originalTitle: id, year: 2020, source: "tmdb", rating: null, poster: null, description: "", genres }), ...extra,
});
const log = (movieId: string, rating: number): FilmLog => ({
  id: `${movieId}-log`, movieId, rating, userId: "guma", watchedOn: "2026-11-06", createdAt: "2026-11-06T00:00:00Z", review: "", themes: {}, spoiler: false,
});

test("분석 카드는 피규어 카드에 제목·큰 숫자·짧은 통계로 요약된다", () => {
  const movies = [movie("a", ["드라마"]), movie("b", ["드라마"]), movie("c", ["SF"])];
  const { insights } = buildTasteInsights(movies, [log("a", 5), log("b", 4), log("c", 3)], "guma");
  const cards = buildFigureCards(insights);
  assert.equal(cards.length, insights.length);
  const like = cards[insights.findIndex(item => item.id === "like")];
  assert.equal(like.label, "가장 좋아하는 장르");
  assert.equal(like.title, "드라마");
  assert.deepEqual(like.lines, ["4.5", "평균 별점 ★ 4.5", "최고작 영화 a ★5.0"]);
  const rank = cards[insights.findIndex(item => item.id === "rank")];
  assert.equal(rank.lines[0], "1위");
  assert.ok(rank.lines.every(line => line.length > 0) && rank.lines.length <= 4);
});

test("분석할 근거가 부족하면 카드가 없다", () => {
  assert.deepEqual(buildFigureCards(buildTasteInsights([movie("a", ["드라마"])], [log("a", 5)], "guma").insights), []);
});
