import "server-only";
import { z } from "zod";
import { ApiError } from "@/server/http/errors";

const pageSchema = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().min(1).max(500));
const idSchema = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(2_147_483_647));
const querySchema = z.string().trim().max(100);

export interface MovieListParams {
  page: number;
  query: string;
}

export function parseMovieListParams(params: URLSearchParams): MovieListParams {
  const page = pageSchema.safeParse(params.get("page") ?? "1");
  const query = querySchema.safeParse(params.get("query") ?? "");
  if (params.getAll("page").length > 1 || params.getAll("query").length > 1 || !page.success || !query.success) {
    throw new ApiError(400, "INVALID_QUERY", "페이지는 1~500, 검색어는 100자 이내로 입력해 주세요.");
  }
  return { page: page.data, query: query.data };
}

export function parseMovieId(value: string): number {
  const id = idSchema.safeParse(value);
  if (!id.success) {
    throw new ApiError(400, "INVALID_MOVIE_ID", "올바른 영화 ID를 입력해 주세요.");
  }
  return id.data;
}
