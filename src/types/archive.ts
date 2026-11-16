import type { ArchiveMovie } from "@/lib/archive-movies";
import type { FilmLog } from "@/lib/scene-model";

export interface PersonalArchive {
  logs: Omit<FilmLog, "userId">[];
  watchlist: string[];
  catalog: ArchiveMovie[];
}
export interface ArchiveResponse { archive: PersonalArchive; revision: number }
export type ArchiveWrite = ArchiveResponse;
export const emptyArchive = (): PersonalArchive => ({ logs: [], watchlist: [], catalog: [] });
