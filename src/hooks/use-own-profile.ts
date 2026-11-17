"use client";

import { useEffect, useState } from "react";
import { PROFILE_UPDATED, requestProfile } from "@/lib/api/profile";
import type { OwnProfile } from "@/types/social";

export function useOwnProfile(userId?: string) {
  const [result, setResult] = useState<{ userId: string; profile?: OwnProfile; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    requestProfile(userId, controller.signal).then(profile => {
      if (!controller.signal.aborted) setResult({ userId, profile });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ userId, error: error instanceof Error ? error.message : "프로필을 불러오지 못했습니다." });
    });
    function update(event: Event) {
      const profile = (event as CustomEvent<OwnProfile>).detail;
      if (profile.id !== userId) return;
      controller.abort();
      setResult({ userId: userId!, profile });
    }
    window.addEventListener(PROFILE_UPDATED, update);
    return () => { controller.abort(); window.removeEventListener(PROFILE_UPDATED, update); };
  }, [userId, attempt]);
  const current = result?.userId === userId ? result : null;
  return { profile: current?.profile, error: current?.error, loading: !!userId && !current, reload: () => setAttempt(value => value + 1) };
}
