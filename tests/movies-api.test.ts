import assert from "node:assert/strict";
import { afterEach, beforeEach, test, mock } from "node:test";
import { GET as listMovies } from "../src/app/api/movies/route";
import { GET as movieDetail } from "../src/app/api/movies/[id]/route";
import type { MovieListResponse } from "../src/types/movie";

const originalToken = process.env.TMDB_READ_ACCESS_TOKEN;
const movie = {
  id: 157336,
  title: "인터스텔라",
  original_title: "Interstellar",
  release_date: "2014-11-05",
  overview: "우주를 향한 여정",
  poster_path: "/poster.jpg",
  vote_average: 8.6,
  vote_count: 100,
  genre_ids: [878, 18],
};
const genres = [{ id: 878, name: "SF" }, { id: 18, name: "드라마" }];
const listing = { page: 1, total_pages: 700, total_results: 14000, results: [movie] };
const details = { ...movie, genres, runtime: 169, credits: { crew: [{ job: "Director", name: "크리스토퍼 놀란" }, { job: "Writer", name: "작가" }] } };

beforeEach(() => { process.env.TMDB_READ_ACCESS_TOKEN = "test-token-never-public"; });
afterEach(() => {
  mock.restoreAll();
  if (originalToken === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN;
  else process.env.TMDB_READ_ACCESS_TOKEN = originalToken;
});

function request(query = "") { return new Request(`http://localhost/api/movies${query}`); }
function mockTmdb(result: unknown = listing) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push({ url, init });
    return Response.json(url.pathname.endsWith("/genre/movie/list") ? { genres } : result);
  });
  return calls;
}

test("인기 목록: 한국어 요청, 서버 인증, 장르 및 5점 평점 변환", async () => {
  const calls = mockTmdb();
  const response = await listMovies(request());
  assert.equal(response.status, 200);
  const body: MovieListResponse = await response.json();
  assert.equal(body.data[0].rating, 4.3);
  assert.equal(body.data[0].year, 2014);
  assert.equal(body.data[0].poster, "https://image.tmdb.org/t/p/w500/poster.jpg");
  assert.deepEqual(body.data[0].genres, ["SF", "드라마"]);
  assert.equal(body.data[0].source, "tmdb");
  assert.equal(body.pagination.totalPages, 500);
  assert.equal(calls.length, 2, "목록별 상세 요청 없이 목록과 장르만 조회");
  const popular = calls.find(({ url }) => url.pathname.endsWith("/movie/popular"))!;
  assert.equal(popular.url.searchParams.get("language"), "ko-KR");
  assert.equal(new Headers(popular.init?.headers).get("Authorization"), "Bearer test-token-never-public");
  assert.equal(popular.init?.next?.revalidate, 300);
  assert.ok(!JSON.stringify(body).includes("test-token"));
});

test("검색어를 URL 인코딩하고 2페이지를 조회하며 검색 결과는 캐시하지 않음", async () => {
  const calls = mockTmdb({ ...listing, page: 2 });
  const response = await listMovies(request("?query=%20%EC%98%81%ED%99%94%20%26%20%EA%BF%88%20&page=2"));
  assert.equal(response.status, 200);
  const search = calls.find(({ url }) => url.pathname.endsWith("/search/movie"))!;
  assert.equal(search.url.searchParams.get("query"), "영화 & 꿈");
  assert.equal(search.url.searchParams.get("page"), "2");
  assert.equal(search.url.searchParams.get("include_adult"), "false");
  assert.equal(search.init?.cache, "no-store");
  assert.equal((await response.json()).pagination.page, 2);
});

test("공백 검색어는 인기 영화로 처리", async () => {
  const calls = mockTmdb();
  assert.equal((await listMovies(request("?query=%20%20"))).status, 200);
  assert.ok(calls.some(({ url }) => url.pathname.endsWith("/movie/popular")));
});

test("잘못된 페이지, 중복 파라미터, 긴 검색어는 외부 호출 전에 거부", async () => {
  const calls = mockTmdb();
  for (const query of ["?page=0", "?page=501", "?page=1.5", "?page=NaN", "?page=1e2", "?page=", "?page=1&page=2", "?query=a&query=b", `?query=${"a".repeat(101)}`]) {
    const response = await listMovies(request(query));
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).error.code, "INVALID_QUERY");
  }
  assert.equal(calls.length, 0);
});

test("토큰이 없으면 샘플 데이터를 반환하지 않고 503, 비밀정보를 노출하지 않음", async () => {
  delete process.env.TMDB_READ_ACCESS_TOKEN;
  const calls = mockTmdb();
  const response = await listMovies(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "TMDB_NOT_CONFIGURED");
  assert.equal(calls.length, 0);
});

test("포스터, 개봉일, 평점, 줄거리 누락 처리", async () => {
  mockTmdb({ ...listing, results: [{ ...movie, poster_path: null, release_date: "", vote_count: 0, overview: null, genre_ids: [99999] }] });
  const body: MovieListResponse = await (await listMovies(request())).json();
  assert.equal(body.data[0].poster, null);
  assert.equal(body.data[0].year, null);
  assert.equal(body.data[0].rating, null);
  assert.deepEqual(body.data[0].genres, []);
  assert.equal(body.data[0].description, "아직 등록된 줄거리가 없습니다.");
});

test("빈 검색 결과는 정상적인 200과 빈 배열", async () => {
  mockTmdb({ page: 1, total_pages: 0, total_results: 0, results: [] });
  const response = await listMovies(request("?query=nothing"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [], pagination: { page: 1, totalPages: 0, totalResults: 0 } });
});

test("영화 상세에 감독과 상영 시간을 포함", async () => {
  const calls = mockTmdb(details);
  const response = await movieDetail(new Request("http://localhost/api/movies/157336"), { params: Promise.resolve({ id: "157336" }) });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.director, "크리스토퍼 놀란");
  assert.equal(data.runtime, 169);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("append_to_response"), "credits");
});

test("음수, 소수, 경로 문자열 ID는 외부 호출 전에 거부", async () => {
  const calls = mockTmdb();
  for (const id of ["0", "-1", "1.5", "../../account", "2147483648"]) {
    const response = await movieDetail(request(), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 400);
  }
  assert.equal(calls.length, 0);
});

for (const [upstream, expected, code] of [[401, 502, "TMDB_UPSTREAM_ERROR"], [500, 502, "TMDB_UPSTREAM_ERROR"], [429, 503, "TMDB_RATE_LIMITED"], [404, 404, "MOVIE_NOT_FOUND"]] as const) {
  test(`TMDB ${upstream} 응답을 ${expected}로 변환하고 원본 오류는 숨김`, async () => {
    mock.method(globalThis, "fetch", async () => Response.json({ debug: "test-token-never-public" }, { status: upstream }));
    const response = await movieDetail(request(), { params: Promise.resolve({ id: "1" }) });
    assert.equal(response.status, expected);
    const text = await response.text();
    assert.equal(JSON.parse(text).error.code, code);
    assert.ok(!text.includes("test-token"));
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });
}

test("TMDB 응답 구조가 바뀌면 안전한 502 반환", async () => {
  mockTmdb({ unexpected: "payload" });
  const response = await listMovies(request());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "TMDB_INVALID_RESPONSE");
});

test("잘못된 JSON 응답을 502로 처리", async () => {
  mock.method(globalThis, "fetch", async () => new Response("not json"));
  const response = await listMovies(request());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "TMDB_INVALID_RESPONSE");
});

test("네트워크 장애를 502로 처리", async () => {
  mock.method(globalThis, "fetch", async () => { throw new TypeError("network failure"); });
  const response = await listMovies(request());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "TMDB_UNAVAILABLE");
});

test("타임아웃을 504로 처리", async () => {
  mock.method(globalThis, "fetch", async () => { throw new DOMException("timeout", "TimeoutError"); });
  const response = await listMovies(request());
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "TMDB_TIMEOUT");
});
