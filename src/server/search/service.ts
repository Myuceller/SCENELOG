import "server-only";
import { z } from "zod";
import { tmdbRequest } from "@/server/tmdb/client";
import { getMovies } from "@/server/movies/service";
import { listSocial, type SocialActor } from "@/server/social/repository";
import type { PersonSearchResult, SearchCategory, SearchGroup, SearchResponse } from "@/types/search";

const peopleSchema = z.object({
  page: z.number().int().positive(), total_pages: z.number().int().nonnegative(), total_results: z.number().int().nonnegative(),
  results: z.array(z.object({
    id: z.number().int().positive(), name: z.string(), original_name: z.string().optional(),
    profile_path: z.string().nullish(), known_for_department: z.string().optional(),
    known_for: z.array(z.object({ media_type: z.string().optional(), title: z.string().optional() })).default([]),
  })),
});
const departments: Record<string, string> = { Acting: "배우", Directing: "감독", Writing: "작가", Production: "제작", Camera: "촬영", Sound: "음향", Editing: "편집", Art: "미술", "Visual Effects": "시각효과" };

async function searchPeople(query: string, page: number): Promise<SearchGroup<PersonSearchResult>> {
  const data = await tmdbRequest("search/person", peopleSchema, { params: { query, page: String(page), include_adult: "false" }, revalidate: false });
  return {
    items: data.results.map(person => ({
      id: person.id, name: person.name, originalName: person.original_name ?? person.name,
      photo: person.profile_path && /^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(person.profile_path) ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : null,
      department: departments[person.known_for_department ?? ""] ?? person.known_for_department ?? "영화인",
      knownFor: person.known_for.filter(work => work.media_type === "movie" && work.title).map(work => work.title!),
    })),
    total: data.total_results, page: data.page, hasNext: page < Math.min(data.total_pages, 500),
  };
}

async function group<T>(work: () => Promise<SearchGroup<T>>, page: number, message: string): Promise<SearchGroup<T>> {
  try { return await work(); }
  catch { return { items: [], total: null, page, hasNext: false, error: message }; }
}

export async function searchAll(actor: SocialActor, query: string, category: SearchCategory, page: number): Promise<SearchResponse> {
  const [movies, people, users] = await Promise.all([
    category === "all" || category === "movie" ? group(async () => {
      const result = await getMovies({ query, page });
      return { items: result.data, total: result.pagination.totalResults, page, hasNext: page < result.pagination.totalPages };
    }, page, "영화 검색을 불러오지 못했어요. 다시 시도해 주세요.") : null,
    category === "all" || category === "person" ? group(() => searchPeople(query, page), page, "인물 검색을 불러오지 못했어요. 다시 시도해 주세요.") : null,
    category === "all" || category === "user" ? group(async () => {
      const result = await listSocial(actor, "discover", query, page);
      return { items: result.users, total: null, page, hasNext: result.hasNext };
    }, page, "유저 검색을 불러오지 못했어요. 다시 시도해 주세요.") : null,
  ]);
  return { movies, people, users };
}
