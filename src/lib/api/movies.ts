import type { ApiErrorResponse } from "@/types/api";
import type { MovieListResponse } from "@/types/movie";

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
