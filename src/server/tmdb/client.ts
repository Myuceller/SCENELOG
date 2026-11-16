import "server-only";
import type { z } from "zod";
import { ApiError } from "@/server/http/errors";

const TMDB_BASE_URL = "https://api.themoviedb.org/3/";
const REQUEST_TIMEOUT_MS = 8_000;

interface TmdbRequestOptions {
  params?: Record<string, string>;
  /** false면 검색 결과를 서버 캐시에 저장하지 않습니다. */
  revalidate: number | false;
}

export async function tmdbRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  { params = {}, revalidate }: TmdbRequestOptions,
): Promise<T> {
  // 빌드 시가 아닌 실제 요청 시 읽어 토큰 없이도 빌드할 수 있게 합니다.
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new ApiError(503, "TMDB_NOT_CONFIGURED", "영화 서비스를 준비 중입니다. 잠시 후 다시 시도해 주세요.");
  }

  const url = new URL(path, TMDB_BASE_URL);
  url.search = new URLSearchParams({ language: "ko-KR", ...params }).toString();
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
      ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
    });

    if (!response.ok) {
      if (response.status === 404) throw new ApiError(404, "MOVIE_NOT_FOUND", "영화를 찾을 수 없습니다.");
      if (response.status === 429) throw new ApiError(503, "TMDB_RATE_LIMITED", "영화 서비스가 혼잡합니다. 잠시 후 다시 시도해 주세요.");
      throw new ApiError(502, "TMDB_UPSTREAM_ERROR", "영화 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }

    const data = schema.safeParse(await response.json());
    if (!data.success) throw new ApiError(502, "TMDB_INVALID_RESPONSE", "영화 서비스의 응답을 처리하지 못했습니다.");
    return data.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal.aborted || (error instanceof Error && error.name === "TimeoutError")) {
      throw new ApiError(504, "TMDB_TIMEOUT", "영화 정보를 불러오는 데 시간이 오래 걸립니다. 다시 시도해 주세요.");
    }
    if (error instanceof SyntaxError) {
      throw new ApiError(502, "TMDB_INVALID_RESPONSE", "영화 서비스의 응답을 처리하지 못했습니다.");
    }
    throw new ApiError(502, "TMDB_UNAVAILABLE", "영화 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
