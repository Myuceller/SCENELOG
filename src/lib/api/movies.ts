import type { ApiErrorResponse } from "@/types/api";
import type { MovieDetail, MovieListResponse } from "@/types/movie";

/** 브라우저는 같은 도메인의 Next.js API만 호출합니다. */
export async function fetchMovies(query: string, page: number, signal: AbortSignal): Promise<MovieListResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("query", query);
  const response = await fetch(`/api/movies?${params}`, { signal });
  if (!response.ok) {
    const body: ApiErrorResponse = await response.json();
    throw new Error(body.error?.message || "영화 정보를 불러오지 못했습니다.");
  }
  return response.json() as Promise<MovieListResponse>;
}

/** Load details only when the user opens a movie. */
export async function fetchMovieDetail(id: string, signal: AbortSignal): Promise<MovieDetail> {
  const response = await fetch(`/api/movies/${encodeURIComponent(id)}`, { signal });
  if (!response.ok) {
    const body: ApiErrorResponse = await response.json();
    throw new Error(body.error?.message || "영화 상세를 불러오지 못했습니다.");
  }
  const body: { data: MovieDetail } = await response.json();
  return body.data;
}
