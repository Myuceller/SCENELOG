import type { ArchiveMovie } from "./archive-movies";
import type { AccountId, FilmLog } from "./scene-model";

export interface TasteFilm { movie: ArchiveMovie; log: FilmLog }

/** A saved cover applies only to the same user's records on the same date. */
export function getDayCover(logs: FilmLog[], user: AccountId, date: string, selectedId?: string) {
  const entries = logs.filter(log => log.userId === user && log.watchedOn === date);
  return entries.find(log => log.id === selectedId)
    ?? [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
}
