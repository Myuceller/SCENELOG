"use client";

import { useEffect, useRef, useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import type { FriendshipAction, SocialProfile } from "@/types/social";
import { publishSocialUpdate, requestSocial } from "@/lib/api/social";
import styles from "./friends-tab.module.css";

export function FriendshipActions({ userId, person, allowRemove = false }: { userId: string; person: SocialProfile; allowRemove?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function act(action: FriendshipAction) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError("");
    try {
      await requestSocial(userId, "", { method: "PUT", body: { userId: person.id, action } }, controller.signal);
      if (!controller.signal.aborted) publishSocialUpdate(userId);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "친구 요청을 처리하지 못했어요.");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) { setBusy(false); setConfirmRemove(false); }
    }
  }
  if (person.id === userId) return null;
  return <div className={styles.friendship}>
    <div className={styles.actions} aria-busy={busy}>
      {person.friendship === "none" && <button type="button" className={styles.action} disabled={busy} onClick={() => void act("request")}><UserPlus size={16} aria-hidden="true" />친구 요청</button>}
      {person.friendship === "outgoing" && <><span className={styles.state}>요청 보냄</span><button type="button" className={`${styles.action} ${styles.secondary}`} disabled={busy} onClick={() => void act("cancel")}>요청 취소</button></>}
      {person.friendship === "incoming" && <><button type="button" className={styles.action} disabled={busy} onClick={() => void act("accept")}>수락</button><button type="button" className={`${styles.action} ${styles.secondary}`} disabled={busy} onClick={() => void act("decline")}>거절</button></>}
      {person.friendship === "friends" && <><span className={styles.state}><UserCheck size={16} aria-hidden="true" />친구</span>{allowRemove && (confirmRemove ? <><button type="button" className={`${styles.action} ${styles.danger}`} disabled={busy} onClick={() => void act("remove")}>친구 삭제 확인</button><button type="button" className={`${styles.action} ${styles.secondary}`} disabled={busy} onClick={() => setConfirmRemove(false)}>취소</button></> : <button type="button" className={`${styles.action} ${styles.secondary}`} onClick={() => setConfirmRemove(true)}>친구 삭제</button>)}</>}
    </div>
    {busy && <span className={styles.state} role="status">처리 중…</span>}
    {error && <p className={styles.error} role="alert">{error}<button type="button" onClick={() => publishSocialUpdate(userId)}>새로고침</button></p>}
  </div>;
}
