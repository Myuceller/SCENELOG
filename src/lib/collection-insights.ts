import type { ArchiveMovie } from "./archive-movies";
import { latestLogs, type AccountId, type FilmLog } from "./scene-model";

export function ratingPeers(movies: ArchiveMovie[], logs: FilmLog[], user: AccountId, currentMovieId: string, rating: number | null) {
  if (rating === null || !Number.isFinite(rating)) return [];
  const catalog = new Map(movies.map(movie => [movie.id, movie]));
  return latestLogs(logs, user)
    .filter(log => log.movieId !== currentMovieId && log.rating !== null && Math.round(log.rating * 10) === Math.round(rating * 10))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap(log => { const movie = catalog.get(log.movieId); return movie ? [{ movie, log }] : []; });
}

export function viewingArchive(movies: ArchiveMovie[], logs: FilmLog[], user: AccountId) {
  const catalog = new Map(movies.map(movie => [movie.id, movie]));
  const groups = new Map<string, FilmLog[]>();
  for (const log of logs) {
    if (log.userId !== user || !catalog.has(log.movieId)) continue;
    const entries = groups.get(log.movieId) ?? [];
    entries.push(log);
    groups.set(log.movieId, entries);
  }
  return [...groups].map(([movieId, entries]) => {
    // Unknown viewing dates stay last. Never present the creation date as a viewing date.
    const ordered = [...entries].sort((a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt));
    const latest = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { movie: catalog.get(movieId)!, entries: ordered, latest, watchedOn: ordered[0].watchedOn };
  }).sort((a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.latest.createdAt.localeCompare(a.latest.createdAt));
}
