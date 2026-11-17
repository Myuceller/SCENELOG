"use client";

import { useEffect, useState } from "react";
import { requestSocial, SOCIAL_UPDATED } from "@/lib/api/social";
import type { SocialSummary } from "@/types/social";

export function useFriendRequests(userId: string) {
  const [result, setResult] = useState<{ userId: string; count: number } | null>(null);
  useEffect(() => {
    let active = true;
    let pending: AbortController | undefined;
    function refresh() {
      if (document.visibilityState === "hidden") return;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      void requestSocial<SocialSummary>(userId, "tab=summary", undefined, controller.signal).then(summary => {
        if (active && !controller.signal.aborted) setResult({ userId, count: summary.incomingRequests });
      }).catch(() => { /* Keep the last confirmed count on transient network errors. */ });
    }
    function updated(event: Event) {
      if ((event as CustomEvent<{ userId: string }>).detail?.userId === userId) refresh();
    }
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener(SOCIAL_UPDATED, updated);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false; pending?.abort(); window.clearInterval(timer);
      window.removeEventListener(SOCIAL_UPDATED, updated);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId]);
  return result?.userId === userId ? result.count : 0;
}
