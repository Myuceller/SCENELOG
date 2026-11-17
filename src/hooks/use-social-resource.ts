"use client";

import { useEffect, useState } from "react";
import { requestSocial, SOCIAL_UPDATED } from "@/lib/api/social";

export function useSocialResource<T>(userId: string, query: string | null, revision: number | string = 0) {
  const [refresh, setRefresh] = useState(0);
  const key = JSON.stringify([userId, query, revision, refresh]);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null);
  useEffect(() => {
    function updated(event: Event) {
      if ((event as CustomEvent<{ userId: string }>).detail?.userId === userId) setRefresh(value => value + 1);
    }
    function focused() { setRefresh(value => value + 1); }
    window.addEventListener(SOCIAL_UPDATED, updated);
    window.addEventListener("focus", focused);
    return () => { window.removeEventListener(SOCIAL_UPDATED, updated); window.removeEventListener("focus", focused); };
  }, [userId]);
  useEffect(() => {
    if (query === null) return;
    const controller = new AbortController();
    requestSocial<T>(userId, query, undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : "정보를 불러오지 못했습니다." });
    });
    return () => controller.abort();
  }, [userId, query, key]);
  const current = result?.key === key ? result : null;
  return { data: current?.data, error: current?.error, loading: query !== null && !current };
}
