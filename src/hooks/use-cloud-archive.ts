"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { SceneState } from "@/lib/scene-model";
import { fromPersonalArchive, toPersonalArchive } from "@/lib/personal-archive";
import { requestArchive } from "@/lib/api/archive";

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

  async function update(fn: (state: SceneState) => SceneState): Promise<boolean> {
    const previous = current.current;
    if (!previous || previous.key !== key || busy.current || session.current?.signal.aborted) return false;
    busy.current = true;
    setSaving(true);
    setFailure(null);
    const controller = new AbortController();
    requests.current.add(controller);
    try {
      const state = fn(previous.state);
      if (state.userId !== userId) throw new Error("로그인한 계정은 변경할 수 없습니다.");
      const result = await requestArchive(userId, controller.signal, { archive: toPersonalArchive(state), revision: previous.revision });
      if (controller.signal.aborted) return false;
      const next = { state: fromPersonalArchive(userId, result.archive), revision: result.revision, key };
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
  return {
    state: snapshot?.key === key ? snapshot.state : null, update, saving,
    error: failure?.key === key ? failure.message : null,
    reload: () => { if (!busy.current) setAttempt((value) => value + 1); },
  };
}
