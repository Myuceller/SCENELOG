import type { SceneState } from "./scene-model";
import type { PersonalArchive, RecordResponse } from "@/types/archive";
import { mergeMovieCatalog } from "./archive-movies";

/** Apply the confirmed single-record response without replacing unrelated local records. */
export function applyRecord(state: SceneState, record: RecordResponse): SceneState {
  const log = { ...record.log, userId: state.userId };
  return {
    ...state,
    catalog: mergeMovieCatalog(state.catalog ?? [], [record.movie]),
    logs: state.logs.some(item => item.id === log.id && item.userId === state.userId)
      ? state.logs.map(item => item.id === log.id && item.userId === state.userId ? log : item)
      : [...state.logs, log],
    watchlist: state.watchlist.filter(item => item.userId !== state.userId || item.movieId !== log.movieId),
  };
}

export function toPersonalArchive(state: SceneState): PersonalArchive {
  const logs = state.logs.flatMap(({ userId, ...log }) => userId === state.userId ? [log] : []);
  const watchlist = state.watchlist.filter((item) => item.userId === state.userId).map((item) => item.movieId);
  const ids = new Set([...logs.map((log) => log.movieId), ...watchlist]);
  return { logs, watchlist, catalog: (state.catalog ?? []).filter((movie) => ids.has(movie.id)) };
}
export function fromPersonalArchive(uid: string, archive: PersonalArchive): SceneState {
  return {
    version: 1, userId: uid, logs: archive.logs.map((log) => ({ ...log, userId: uid })),
    watchlist: archive.watchlist.map((movieId) => ({ movieId, userId: uid })), catalog: archive.catalog,
    friends: [], recommendations: [], groups: [], comments: [],
  };
}
