import type { Movie } from "./movie";
import type { SocialProfile } from "./social";

export type SearchCategory = "all" | "movie" | "person" | "user";
export interface PersonSearchResult {
  id: number;
  name: string;
  originalName: string;
  photo: string | null;
  department: string;
  knownFor: string[];
}
export interface SearchGroup<T> {
  items: T[];
  total: number | null;
  page: number;
  hasNext: boolean;
  error?: string;
}
export interface SearchResponse {
  movies: SearchGroup<Movie> | null;
  people: SearchGroup<PersonSearchResult> | null;
  users: SearchGroup<SocialProfile> | null;
}
