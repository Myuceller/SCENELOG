import type { ArchiveMovie } from "./archive-movies";
import { latestLogs, type AccountId, type FilmLog } from "./scene-model";

export const TASTE_THRESHOLD = 4;
const fallbackGenres = ["드라마", "로맨스", "코미디", "SF", "음악", "스릴러", "액션", "애니메이션"];
export interface TasteFilm { movie: ArchiveMovie; log: FilmLog }
export interface TasteFacet {
  name: string;
  films: TasteFilm[];
  ratedCount: number;
  average: number | null;
}

/** One current rating per film; rewatches never inflate a genre's share. */
export function buildTasteProfile(movies: ArchiveMovie[], logs: FilmLog[], user: AccountId, month?: string) {
  const catalog = new Map(movies.map(movie => [movie.id, movie]));
  const records = latestLogs(month ? logs.filter(log => log.watchedOn.startsWith(month)) : logs, user);
  const rated = records.flatMap(log => {
    const movie = catalog.get(log.movieId);
    return movie && log.rating !== null ? [{ movie, log }] : [];
  });
  const favorites = rated.filter(item => item.log.rating! >= TASTE_THRESHOLD)
    .sort((a, b) => b.log.rating! - a.log.rating! || b.log.createdAt.localeCompare(a.log.createdAt));
  const genres = [...new Set([...rated.flatMap(item => item.movie.genres), ...fallbackGenres])];
  const facets: TasteFacet[] = genres.map(name => {
    const matching = rated.filter(item => item.movie.genres.includes(name));
    return {
      name,
      films: favorites.filter(item => item.movie.genres.includes(name)),
      ratedCount: matching.length,
      average: matching.length ? matching.reduce((sum, item) => sum + item.log.rating!, 0) / matching.length : null,
    };
  }).sort((a, b) => b.films.length - a.films.length || b.ratedCount - a.ratedCount || (b.average ?? -1) - (a.average ?? -1));
  return { facets: facets.slice(0, 8), ratedCount: rated.length, favorites, provisional: rated.length < 10 };
}

/** A saved cover applies only to the same user's records on the same date. */
export function getDayCover(logs: FilmLog[], user: AccountId, date: string, selectedId?: string) {
  const entries = logs.filter(log => log.userId === user && log.watchedOn === date);
  return entries.find(log => log.id === selectedId)
    ?? [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
}
