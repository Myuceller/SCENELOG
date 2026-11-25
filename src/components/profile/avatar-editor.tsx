"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";
import type { OwnProfile } from "@/types/social";
import { publishProfile, requestProfile } from "@/lib/api/profile";
import { UserAvatar } from "./user-avatar";
import styles from "./social-settings.module.css";

export function AvatarEditor({ profile }: { profile: OwnProfile }) {
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function save(file: File | null) {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(""); setNotice("");
    if (file) setPreview(URL.createObjectURL(file));
    try {
      const result = await requestProfile(profile.id, controller.signal, file);
      if (!controller.signal.aborted) { publishProfile(result); setNotice(file ? "프로필 사진을 바꿨어요." : "기본 아이콘으로 바꿨어요."); }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "사진을 저장하지 못했습니다.");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) { setBusy(false); setPreview(null); }
    }
  }
  function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("3MB 이하의 사진을 선택해 주세요."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("JPG, PNG, WebP 사진을 선택해 주세요."); return; }
    void save(file);
  }
  return <div className={styles.avatarEditor}>
    <div className={styles.avatarRow}><UserAvatar userId={profile.id} name={profile.displayName} size="large" imageUrl={preview ?? profile.avatarUrl} titleId={profile.equippedTitle} />
      <div><div className={styles.photoActions}><button type="button" onClick={() => input.current?.click()} disabled={busy}><Camera size={16} aria-hidden="true" />{busy ? "저장 중…" : "사진 변경"}</button>{profile.avatarUrl && <button type="button" onClick={() => void save(null)} disabled={busy}>사진 삭제</button>}</div><small>JPG, PNG, WebP · 최대 3MB</small></div>
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={select} disabled={busy} aria-label="프로필 사진 선택" />
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
  </div>;
}
