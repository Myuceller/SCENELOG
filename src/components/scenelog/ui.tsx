"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Send, X } from "lucide-react";
import { accounts, type AccountId, type FilmComment } from "@/lib/scene-store";
import styles from "./scenelog.module.css";

export function Avatar({ id, small = false }: { id: AccountId; small?: boolean }) {
  const account = accounts.find(a => a.id === id)!;
  return <span className={`${styles.avatar} ${small ? styles.smallAvatar : ""}`} style={{ background: account.color }} aria-label={account.name}>{account.initial}<i /></span>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className={styles.empty}><span>＋</span><h3>{title}</h3><p>{children}</p></div>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const el = ref.current; el?.showModal(); return () => { el?.close(); }; }, []);
  return <dialog ref={ref} className={`${styles.dialog} ${wide ? styles.wideDialog : ""}`} aria-labelledby={titleId} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose(); } }}>
    <div className={styles.dialogTop}><span className={styles.eyebrow}>SCENELOG / PERSONAL ARCHIVE</span><button type="button" className={styles.iconButton} onClick={onClose} aria-label="닫기"><X size={22} /></button></div>
    <h2 id={titleId} className={styles.dialogTitle}>{title}</h2>{children}
  </dialog>;
}
export function Discussion({ comments, onSubmit }: { comments: FilmComment[]; onSubmit: (body: string, spoiler: boolean) => void }) {
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  return <div className={styles.discussion}>
    {comments.length === 0 && <Empty title="첫 이야기를 남겨주세요">기억에 남은 장면부터 시작해도 좋아요.</Empty>}
    {comments.map(c => <article className={styles.comment} key={c.id}>
      <Avatar id={c.userId} small /><div><div className={styles.commentMeta}><strong>{c.userId}</strong><span>★ {c.score?.toFixed(1) ?? "별점 미정"}</span><small>작성 당시</small></div>
        {c.spoiler && !revealed.includes(c.id) ? <button className={styles.spoilerButton} onClick={() => setRevealed(v => [...v, c.id])}>스포일러가 포함된 이야기 · 펼쳐보기</button> : <p>{c.body}</p>}</div>
    </article>)}
    <form onSubmit={e => { e.preventDefault(); if (!body.trim()) return; onSubmit(body.trim(), spoiler); setBody(""); setSpoiler(false); }} className={styles.commentForm}>
      <label className="sr-only" htmlFor="comment-body">영화에 대한 이야기</label><textarea id="comment-body" placeholder="같은 영화, 다른 생각. 당신의 이야기는?" value={body} maxLength={2000} onChange={e => setBody(e.target.value)} required />
      <div className={styles.between}><label className={styles.checkLabel}><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} /> 스포일러 포함</label><button className={styles.blackButton} disabled={!body.trim()}><Send size={15} /> 이야기 남기기</button></div>
    </form>
  </div>;
}
