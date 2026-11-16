import "server-only";
import { tmdbRequest } from "@/server/tmdb/client";
import { mapMovie, mapMovieDetail } from "@/server/tmdb/mapper";
import { genresSchema, movieDetailSchema, movieListSchema } from "@/server/tmdb/schemas";
import type { MovieDetail, MovieListResponse } from "@/types/movie";
import type { MovieListParams } from "./validation";

export async function getMovies({ query, page }: MovieListParams): Promise<MovieListResponse> {
  const [result, { genres }] = await Promise.all([
    tmdbRequest(query ? "search/movie" : "movie/popular", movieListSchema, {
      params: { page: String(page), ...(query ? { query, include_adult: "false" } : {}) },
      revalidate: query ? false : 300,
    }),
    tmdbRequest("genre/movie/list", genresSchema, { revalidate: 86_400 }),
  ]);
  const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));
  return {
    data: result.results.map((movie) => mapMovie(movie, movie.genre_ids.flatMap((id) => genreNames.has(id) ? [genreNames.get(id)!] : []))),
    pagination: { page: result.page, totalPages: Math.min(result.total_pages, 500), totalResults: result.total_results },
  };
}

export async function getMovie(id: number): Promise<MovieDetail> {
  const movie = await tmdbRequest(`movie/${id}`, movieDetailSchema, {
    params: { append_to_response: "credits" },
    revalidate: 3_600,
  });
  return mapMovieDetail(movie);
}
