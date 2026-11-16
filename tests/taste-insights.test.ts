import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMovie, type ArchiveMovie } from "../src/lib/archive-movies";
import { josa } from "../src/lib/korean";
import { ANALYSES, buildTasteInsights } from "../src/lib/taste-insights";
import type { FilmLog } from "../src/lib/scene-model";

const movie = (id: string, genres: string[], extra: Partial<ArchiveMovie> = {}): ArchiveMovie => ({
  ...normalizeMovie({ id, title: id, originalTitle: id, year: 2020, source: "tmdb", rating: null, poster: null, description: "", genres }), ...extra,
});
const log = (movieId: string, rating: number | null, extra: Partial<FilmLog> = {}): FilmLog => ({
  id: `${movieId}-log`, movieId, rating, userId: "guma", watchedOn: "2026-11-06", createdAt: "2026-11-06T00:00:00Z", review: "", themes: {}, spoiler: false, ...extra,
});
const ids = (result: ReturnType<typeof buildTasteInsights>) => result.insights.map(item => item.id);

test("별점이 3편 미만이면 거짓 분석 없이 카드를 만들지 않는다", () => {
  const movies = [movie("a", ["드라마"]), movie("b", ["SF"])];
  const result = buildTasteInsights(movies, [log("a", 5), log("b", 4)], "guma");
  assert.equal(result.insights.length, 0);
  assert.equal(result.ratedCount, 2);
  assert.equal(buildTasteInsights(movies, [], "guma").average, null);
});

test("미평가·다른 계정·카탈로그에 없는 영화는 세지 않는다", () => {
  const movies = [movie("a", ["드라마"]), movie("b", ["드라마"]), movie("c", ["드라마"])];
  const logs = [log("a", 4), log("b", null), log("c", 5, { userId: "momo" }), log("ghost", 5)];
  assert.equal(buildTasteInsights(movies, logs, "guma").ratedCount, 1);
});

test("재관람은 최신 별점 하나만 쓴다", () => {
  const movies = [movie("a", ["드라마"]), movie("b", ["드라마"]), movie("c", ["드라마"])];
  const logs = [log("a", 5, { id: "old", createdAt: "2026-10-01T00:00:00Z" }), log("a", 3, { id: "new" }), log("b", 4), log("c", 4)];
  const result = buildTasteInsights(movies, logs, "guma");
  assert.equal(result.ratedCount, 3);
  assert.ok(Math.abs(result.average! - 11 / 3) < 1e-9);
});

test("장르 순위는 편수가 아니라 별점으로 좋아한 장르를 앞에 둔다", () => {
  const movies = [
    movie("a1", ["액션"]), movie("a2", ["액션"]), movie("a3", ["액션"]),
    movie("d1", ["드라마"]), movie("d2", ["드라마"]),
  ];
  const logs = [log("a1", 3), log("a2", 3), log("a3", 3.2), log("d1", 5), log("d2", 4.8)];
  const rank = buildTasteInsights(movies, logs, "guma").insights.find(item => item.id === "rank")!;
  assert.equal(rank.name, "드라마");
  assert.equal(rank.rank!.liked[0].name, "드라마");
  assert.equal(rank.rank!.watched[0].name, "액션");
  assert.match(rank.rank!.foot, /액션은 가장 많이 봤지만, 가장 좋아한 건 드라마예요/);
});

test("한 편뿐인 장르는 순위에 오르지 않는다", () => {
  const movies = [movie("a", ["드라마"]), movie("b", ["SF"]), movie("c", ["코미디"])];
  const result = buildTasteInsights(movies, [log("a", 5), log("b", 4), log("c", 3)], "guma");
  assert.ok(!ids(result).includes("rank") && !ids(result).includes("like"));
  assert.ok(ids(result).includes("best"));
});

test("감독·시대는 2편 이상일 때만, 감독 정보가 없으면 건너뛴다", () => {
  const movies = [
    movie("a", ["드라마"], { director: "셔젤", year: 2014 }), movie("b", ["음악"], { director: "셔젤", year: 2016 }),
    movie("c", ["SF"], { director: null, year: 1999 }),
  ];
  const result = buildTasteInsights(movies, [log("a", 4.9), log("b", 4.3), log("c", 3)], "guma");
  const dir = result.insights.find(item => item.id === "dir")!;
  assert.equal(dir.name, "셔젤");
  assert.equal(dir.big, "2편");
  assert.equal(result.insights.some(item => item.id === "dec" && item.name === "1990년대"), false);
});

test("대중 평점과 0.4점 이상 엇갈린 영화만 보여 주고 방향을 표시한다", () => {
  const movies = [movie("a", ["x"], { rating: 3.9 }), movie("b", ["y"], { rating: 3.8 }), movie("c", ["z"], { rating: 4.5 })];
  const pub = buildTasteInsights(movies, [log("a", 3), log("b", 4), log("c", 4.4)], "guma").insights.find(item => item.id === "pub")!;
  assert.equal(pub.name, "a");
  assert.equal(pub.big, "−0.9");
  assert.deepEqual(pub.compare, { base: 3.9, value: 3, baseLabel: "대중", valueLabel: "나" });
  const same = buildTasteInsights([movie("a", ["x"], { rating: 4 }), movie("b", ["y"], { rating: 4 }), movie("c", ["z"], { rating: 4 })], [log("a", 4.1), log("b", 3.9), log("c", 4)], "guma");
  assert.ok(!ids(same).includes("pub"));
});

test("테마 점수는 직접 입력한 기록만 쓰고 3편 이상일 때만 비교한다", () => {
  const movies = ["a", "b", "c"].map(id => movie(id, ["x"]));
  const themed = (movieId: string, ost: number, story: number) => log(movieId, 4, { themes: { ost, story } });
  const theme = buildTasteInsights(movies, [themed("a", 5, 3), themed("b", 4.5, 3.5), themed("c", 5, 3)], "guma").insights.find(item => item.id === "theme")!;
  assert.equal(theme.name, "음악");
  assert.deepEqual(theme.bars!.map(bar => bar.label), ["음악", "스토리"]);
  const thin = buildTasteInsights(movies, [themed("a", 5, 3), themed("b", 4.5, 3.5), log("c", 4)], "guma");
  assert.ok(!ids(thin).includes("theme"));
});

test("러닝타임은 상세 정보가 있고 양쪽 모두 2편 이상일 때만 비교한다", () => {
  const movies = [movie("s1", ["x"], { runtime: 100 }), movie("s2", ["x"], { runtime: 110 }), movie("l1", ["x"], { runtime: 150 }), movie("l2", ["x"], { runtime: 170 })];
  const run = buildTasteInsights(movies, [log("s1", 4.6), log("s2", 4.4), log("l1", 3), log("l2", 3.4)], "guma").insights.find(item => item.id === "run")!;
  assert.equal(run.name, "130분 미만");
  assert.match(run.sentence, /짧은 영화에 더 후해요/);
  const unknown = buildTasteInsights(movies.map(item => ({ ...item, runtime: null })), [log("s1", 4.6), log("s2", 4.4), log("l1", 3), log("l2", 3.4)], "guma");
  assert.ok(!ids(unknown).includes("run"));
});

test("요일 분석은 유효한 관람일만 쓴다", () => {
  const movies = ["a", "b", "c", "d", "e"].map(id => movie(id, ["x"]));
  const logs = [
    log("a", 4.8, { watchedOn: "2026-11-07" }), log("b", 4.6, { watchedOn: "2026-11-08" }),
    log("c", 3, { watchedOn: "2026-11-09" }), log("d", 3.2, { watchedOn: "2026-11-10" }), log("e", 5, { watchedOn: "" }),
  ];
  const week = buildTasteInsights(movies, logs, "guma").insights.find(item => item.id === "week")!;
  assert.equal(week.name, "주말");
  assert.equal(week.big, "4.7");
});

test("가장 높게 준 영화는 동점이면 더 최근 기록을 고른다", () => {
  const movies = ["a", "b", "c"].map(id => movie(id, ["x"]));
  const best = buildTasteInsights(movies, [log("a", 5, { createdAt: "2026-11-01T00:00:00Z" }), log("b", 5, { createdAt: "2026-11-05T00:00:00Z" }), log("c", 4)], "guma").insights.find(item => item.id === "best")!;
  assert.equal(best.name, "b");
  assert.equal(best.sentence, "가장 높게 준 영화는 b예요");
});

test("조사는 받침에 맞게 붙는다", () => {
  assert.equal(josa("드라마", "은", "는"), "드라마는");
  assert.equal(josa("액션", "은", "는"), "액션은");
  assert.equal(josa("SF", "을", "를"), "SF를");
  assert.equal(josa("위플래쉬", "이에요", "예요"), "위플래쉬예요");
  assert.equal(josa("인터스텔라", "이에요", "예요"), "인터스텔라예요");
  assert.equal(josa("기생충", "이에요", "예요"), "기생충이에요");
});

test("새 분석은 목록에 함수 하나만 더하면 카드가 되고, 같은 id는 한 번만 나온다", () => {
  const movies = ["a", "b", "c"].map(id => movie(id, ["x"]));
  const logs = [log("a", 5), log("b", 4), log("c", 3)];
  const extra = (id: string) => () => [{ id, hue: 100, label: "새 분석", short: "새 분석", big: "1", name: "예시", sentence: "", films: [], stats: [] as [string, string][] }];
  const result = buildTasteInsights(movies, logs, "guma", [extra("custom"), extra("custom"), () => []]);
  assert.deepEqual(result.insights.map(item => item.id), ["custom"]);
  assert.ok(ANALYSES.length >= 10 && new Set(buildTasteInsights(movies, logs, "guma").insights.map(item => item.hue)).size >= 1);
});
