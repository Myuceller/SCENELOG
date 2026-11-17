import "server-only";
import { z } from "zod";
import { ApiError } from "@/server/http/errors";
import { tmdbRequest } from "@/server/tmdb/client";
import { genresSchema, movieListItemSchema } from "@/server/tmdb/schemas";
import { mapMovie } from "@/server/tmdb/mapper";
import type { PersonDetail } from "@/types/person";

const personSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  profile_path: z.string().nullish(),
  movie_credits: z.object({
    cast: z.array(movieListItemSchema.extend({
      character: z.string().nullish(),
      adult: z.boolean().optional(),
    })),
  }),
});

export function parsePersonId(value: string): number {
  const id = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id) || id > 2_147_483_647) {
    throw new ApiError(400, "INVALID_PERSON_ID", "올바른 인물 ID가 아닙니다.");
  }
  return id;
}

export async function getPerson(id: number): Promise<PersonDetail> {
  try {
    const [person, { genres }] = await Promise.all([
      tmdbRequest(`person/${id}`, personSchema, { params: { append_to_response: "movie_credits" }, revalidate: 3_600 }),
      tmdbRequest("genre/movie/list", genresSchema, { revalidate: 86_400 }),
    ]);
    const genreNames = new Map(genres.map(genre => [genre.id, genre.name]));
    const movies = new Map<string, PersonDetail["movies"][number]>();
    const credits = person.movie_credits.cast.filter(movie => !movie.adult).sort((a, b) =>
      (b.release_date ?? "").localeCompare(a.release_date ?? "") || a.id - b.id,
    );
    for (const credit of credits) {
      const movieId = String(credit.id);
      const existing = movies.get(movieId);
      const character = credit.character?.trim() ?? "";
      if (existing) {
        if (character && !existing.character.split(" / ").includes(character)) {
          existing.character = [existing.character, character].filter(Boolean).join(" / ");
        }
      } else {
        movies.set(movieId, {
          ...mapMovie(credit, credit.genre_ids.flatMap(genre => genreNames.has(genre) ? [genreNames.get(genre)!] : [])),
          character,
        });
      }
    }
    return {
      id: person.id,
      name: person.name,
      photo: person.profile_path && /^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(person.profile_path)
        ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : null,
      movies: [...movies.values()],
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new ApiError(404, "PERSON_NOT_FOUND", "인물을 찾을 수 없습니다.");
    }
    throw error;
  }
}
