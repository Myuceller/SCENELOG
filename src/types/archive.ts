import type { ArchiveMovie } from "@/lib/archive-movies";
import type { FilmLog } from "@/lib/scene-model";

export interface PersonalArchive {
  logs: Omit<FilmLog, "userId">[];
  watchlist: string[];
  catalog: ArchiveMovie[];
}
export interface ArchiveResponse { archive: PersonalArchive; revision: number }
export type ArchiveWrite = ArchiveResponse;
export interface RecordWrite {
  movie: ArchiveMovie;
  log: Omit<FilmLog, "userId">;
  revision: number;
}
export type RecordResponse = RecordWrite;
export type WatchlistWrite = { revision: number } & (
  { saved: true; movie: ArchiveMovie } | { saved: false; movieId: string }
);
export interface WatchlistResponse { revision: number; saved: boolean; movieId: string; movie?: ArchiveMovie; removedMovie: boolean }
export const emptyArchive = (): PersonalArchive => ({ logs: [], watchlist: [], catalog: [] });
