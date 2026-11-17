"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { requestSocial } from "@/lib/api/social";
import { publishProfile } from "@/lib/api/profile";
import type { CollectionVisibility, OwnProfile } from "@/types/social";
import { AvatarEditor } from "./avatar-editor";
import styles from "./social-settings.module.css";

export function SocialSettings({ profile, error, loading, onRetry, children }: { profile?: OwnProfile; error?: string; loading: boolean; onRetry: () => void; children?: ReactNode }) {
  return <>
    {loading && <p role="status">불러오는 중…</p>}
    {error && <p role="alert" className={styles.error}>{error} <button type="button" onClick={onRetry}>다시 시도</button></p>}
    {profile && <AvatarEditor key={`avatar-${profile.id}`} profile={profile} />}
    {children}
    {profile && <ProfileForm key={profile.id} userId={profile.id} profile={profile} />}
  </>;
}

function ProfileForm({ userId, profile }: { userId: string; profile: OwnProfile }) {
  const [name, setName] = useState(profile.displayName);
  const [shared, setShared] = useState<CollectionVisibility>(profile.collectionVisibility);
  const [saved, setSaved] = useState({ name: profile.displayName, shared: profile.collectionVisibility });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !name.trim()) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await requestSocial<OwnProfile>(userId, "", { method: "PATCH", body: { displayName: name.trim(), collectionVisibility: shared } }, controller.signal);
      if (!controller.signal.aborted) {
        setName(result.displayName); setShared(result.collectionVisibility);
        setSaved({ name: result.displayName, shared: result.collectionVisibility }); setNotice("저장했어요.");
        publishProfile(result);
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "설정을 저장하지 못했습니다.");
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <form className={styles.form} onSubmit={submit}>
    <label className={styles.name}>공개 닉네임<input name="displayName" autoComplete="nickname" value={name} required maxLength={30} disabled={busy} onChange={event => { setName(event.target.value); setNotice(""); }} /></label>
    <fieldset className={styles.sharing} disabled={busy}>
      <legend>컬렉션 공개 범위</legend>
      <div className={styles.visibilityOptions}>{([
        ["private", "나만 보기", "다른 사람에게 보이지 않아요."],
        ["friends", "친구만", "수락한 친구끼리 별점과 리뷰를 볼 수 있어요."],
        ["public", "모두", "친구가 아닌 회원도 볼 수 있어요."],
      ] as const).map(([value, label, description]) => <label key={value} className={styles.visibilityOption}>
        <input type="radio" name="collectionVisibility" value={value} checked={shared === value} onChange={() => { setShared(value); setNotice(""); }} />
        <span><strong>{label}</strong><small>{description}</small></span>
      </label>)}</div>
    </fieldset>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    <button className={styles.save} type="submit" disabled={busy || !name.trim() || (name.trim() === saved.name && shared === saved.shared)}>{busy ? "저장 중…" : "저장"}</button>
  </form>;
}
