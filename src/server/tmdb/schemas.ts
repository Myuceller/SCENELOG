import "server-only";
import { z } from "zod";

const genreSchema = z.object({ id: z.number().int(), name: z.string() });
const movieSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  original_title: z.string(),
  release_date: z.string().nullish(),
  overview: z.string().nullish(),
  poster_path: z.string().nullish(),
  vote_average: z.number().min(0).max(10),
  vote_count: z.number().int().nonnegative(),
});

export const genresSchema = z.object({ genres: z.array(genreSchema) });
export const movieListItemSchema = movieSchema.extend({ genre_ids: z.array(z.number().int()) });
export const movieListSchema = z.object({
  page: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
  total_results: z.number().int().nonnegative(),
  results: z.array(movieListItemSchema),
});
export const movieDetailSchema = movieSchema.extend({
  genres: z.array(genreSchema),
  runtime: z.number().int().nonnegative().nullable(),
  credits: z.object({ crew: z.array(z.object({ job: z.string(), name: z.string() })) }),
});

export type TmdbMovie = z.infer<typeof movieSchema>;
export type TmdbMovieDetail = z.infer<typeof movieDetailSchema>;
