"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { FilmLog, SceneState } from "@/lib/scene-model";
import { applyRecord, fromPersonalArchive, toPersonalArchive } from "@/lib/personal-archive";
import { requestArchive, requestRecord, requestWatchlist } from "@/lib/api/archive";
import { mergeMovieCatalog, type ArchiveMovie } from "@/lib/archive-movies";

type Snapshot = { state: SceneState; revision: number; key: string };
export function useCloudArchive(user: User) {
  const [attempt, setAttempt] = useState(0);
  const userId = user.id;
  const key = `${userId}:${attempt}`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const current = useRef<Snapshot | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const requests = useRef(new Set<AbortController>());
  const session = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    session.current = controller;
    requestArchive(userId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      const next = { state: fromPersonalArchive(userId, result.archive), revision: result.revision, key };
      current.current = next;
      setSnapshot(next);
      setFailure(null);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setFailure({ key, message: error instanceof Error ? error.message : "개인 기록을 불러오지 못했습니다. 서버 연결을 확인한 후 다시 시도해 주세요." });
    });
    const pending = requests.current;
    return () => { controller.abort(); pending.forEach((request) => request.abort()); };
  }, [userId, key]);

  async function persist(write: (previous: Snapshot, signal: AbortSignal) => Promise<Snapshot>): Promise<boolean> {
    const previous = current.current;
    if (!previous || previous.key !== key || busy.current || session.current?.signal.aborted) return false;
    busy.current = true;
    setSaving(true);
    setFailure(null);
    const controller = new AbortController();
    requests.current.add(controller);
    try {
      const next = await write(previous, controller.signal);
      if (controller.signal.aborted) return false;
      current.current = next;
      setSnapshot(next);
      return true;
    } catch (error) {
      if (!controller.signal.aborted) setFailure({ key, message: error instanceof Error ? error.message : "저장하지 못했습니다. 다시 시도해 주세요." });
      return false;
    } finally {
      busy.current = false;
      requests.current.delete(controller);
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  async function update(fn: (state: SceneState) => SceneState): Promise<boolean> {
    return persist(async (previous, signal) => {
      const state = fn(previous.state);
      if (state.userId !== userId) throw new Error("로그인한 계정은 변경할 수 없습니다.");
      // Calendar cover selection and other local view state must not upload the whole library.
      if (state.logs === previous.state.logs && state.watchlist === previous.state.watchlist && state.catalog === previous.state.catalog) {
        return { ...previous, state };
      }
      const result = await requestArchive(userId, signal, { archive: toPersonalArchive(state), revision: previous.revision });
      return { state: fromPersonalArchive(userId, result.archive), revision: result.revision, key };
    });
  }
  async function saveRecord(movie: ArchiveMovie, entry: FilmLog): Promise<boolean> {
    return persist(async (previous, signal) => {
      if (entry.userId !== userId) throw new Error("로그인한 계정은 변경할 수 없습니다.");
      const { userId: owner, ...log } = entry;
      void owner;
      const merged = mergeMovieCatalog(previous.state.catalog ?? [], [movie]).find(item => item.id === movie.id)!;
      const result = await requestRecord(userId, signal, { movie: merged, log, revision: previous.revision });
      return { state: applyRecord(previous.state, result), revision: result.revision, key };
    });
  }
  async function saveWatchlist(movie: ArchiveMovie, saved: boolean): Promise<boolean> {
    return persist(async (previous, signal) => {
      const merged = mergeMovieCatalog(previous.state.catalog ?? [], [movie]).find(item => item.id === movie.id)!;
      const result = await requestWatchlist(userId, signal, saved
        ? { saved: true, movie: merged, revision: previous.revision }
        : { saved: false, movieId: movie.id, revision: previous.revision });
      const state = previous.state;
      const watchlist = state.watchlist.filter(item => item.userId !== userId || item.movieId !== result.movieId);
      // Preserve existing order when the requested saved state is already true.
      const alreadySaved = state.watchlist.some(item => item.userId === userId && item.movieId === result.movieId);
      return { key, revision: result.revision, state: {
        ...state,
        catalog: result.removedMovie ? state.catalog?.filter(item => item.id !== result.movieId)
          : result.movie ? mergeMovieCatalog(state.catalog ?? [], [result.movie]) : state.catalog,
        watchlist: result.saved ? alreadySaved ? state.watchlist : [...watchlist, { userId, movieId: result.movieId }] : watchlist,
      } };
    });
  }
  return {
    state: snapshot?.key === key ? snapshot.state : null, update, saveRecord, saveWatchlist, saving,
    error: failure?.key === key ? failure.message : null,
    reload: () => { if (!busy.current) setAttempt((value) => value + 1); },
  };
}
