"use client";

import { useState } from "react";
import { Bookmark, Check, Minus, Plus, Send } from "lucide-react";
import type { ArchiveMovie as Movie } from "@/lib/archive-movies";
import { accounts, friendIds, newId, themes, today, type FilmLog, type SceneState, type ThemeKey, type Tier } from "@/lib/scene-store";
import { Discussion, Modal } from "./ui";
import styles from "./scenelog.module.css";

export function RecordDialog({ movie, entry, initialDate, state, onSave, onClose, onWatchlist, onRecommend, onRewatch, onComment }: {
  movie: Movie; entry?: FilmLog; initialDate?: string; state: SceneState; onSave: (log: FilmLog) => void;
  onClose: () => void; onWatchlist: () => void; onRecommend: () => void; onRewatch: () => void;
  onComment: (body: string, spoiler: boolean) => void;
}) {
  const [rating, setRating] = useState(entry?.rating ?? 4);
  const [unrated, setUnrated] = useState(entry ? entry.rating === null : false);
  const [date, setDate] = useState(entry?.watchedOn ?? initialDate ?? today());
  const [review, setReview] = useState(entry?.review ?? "");
  const [themeScores, setThemeScores] = useState<Partial<Record<ThemeKey, number>>>(entry?.themes ?? {});
  const [spoiler, setSpoiler] = useState(entry?.spoiler ?? false);
  const [tier, setTier] = useState<Tier | "">(entry?.tier ?? "");
  const [tab, setTab] = useState("record");
  const inWatchlist = state.watchlist.some(w => w.userId === state.userId && w.movieId === movie.id);
  const history = state.logs.filter(l => l.userId === state.userId && l.movieId === movie.id);
  function adjust(value: number) { setRating(Math.round(Math.min(5, Math.max(0, value)) * 10) / 10); }
  return <Modal title={movie.title} onClose={onClose} wide>
    <div className={styles.filmIntro}>
      {/* Use the original poster URL, shared with the Canvas PNG exporter. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={movie.poster} alt={`${movie.title} 포스터`} />
      <div><p className={styles.originalTitle}>{movie.originalTitle}</p><p className={styles.muted}>{movie.year ?? "개봉일 미정"} · {movie.director ?? movie.genres.join(" / ")}<br />{movie.genres.join(" / ")}</p><p>{movie.description}</p>
        <div className={styles.buttonRow}><button type="button" className={styles.outlineButton} onClick={onWatchlist}>{inWatchlist ? <Check size={15} /> : <Bookmark size={15} />}{inWatchlist ? "보고 싶은 영화에 저장됨" : "보고 싶은 영화"}</button><button type="button" className={styles.outlineButton} onClick={onRecommend}><Send size={15} /> 친구에게 추천</button></div>
      </div>
    </div>
    <div className={styles.tabs}><button className={tab === "record" ? styles.activeTab : ""} onClick={() => setTab("record")}>나의 기록</button><button className={tab === "talk" ? styles.activeTab : ""} onClick={() => setTab("talk")}>영화 이야기 <small>{state.comments.filter(c => c.scope === "public" && c.movieId === movie.id).length}</small></button></div>
    {tab === "record" ? <form className={styles.recordForm} onSubmit={e => { e.preventDefault(); onSave({ id: entry?.id ?? newId(), userId: state.userId, movieId: movie.id, rating: unrated ? null : rating, watchedOn: date, review: review.trim(), themes: themeScores, tier: tier || undefined, spoiler, createdAt: entry?.createdAt ?? new Date().toISOString() }); }}>
      <div className={styles.between}><label className={styles.fieldLabel} htmlFor="rating-number">이 영화, 나에게는</label><label className={styles.checkLabel}><input type="checkbox" checked={unrated} onChange={e => setUnrated(e.target.checked)} />별점은 나중에</label></div>
      <div className={`${styles.ratingControl} ${unrated ? styles.disabledRating : ""}`}><span className={styles.bigStar}>★</span><button type="button" aria-label="별점 0.1 낮추기" onClick={() => adjust(rating - .1)} disabled={unrated || rating <= 0}><Minus size={20} /></button><input id="rating-number" aria-label="내 별점" type="number" min="0" max="5" step="0.1" value={rating.toFixed(1)} disabled={unrated} onChange={e => { if (e.target.value !== "") adjust(Number(e.target.value)); }} /><span>/ 5.0</span><button type="button" aria-label="별점 0.1 높이기" onClick={() => adjust(rating + .1)} disabled={unrated || rating >= 5}><Plus size={20} /></button></div>
      <input className={styles.range} aria-label="별점 슬라이더" type="range" min="0" max="5" step="0.1" value={rating} disabled={unrated} onChange={e => adjust(Number(e.target.value))} />
      <div className={styles.rangeLabels}><span>0.0</span><span>당신의 취향을 0.1점까지.</span><span>5.0</span></div>
      <div className={styles.twoFields}><label>관람일 <small>선택</small><input aria-label="관람일" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} /><small>기억나지 않으면 비워두세요.</small></label><label>나의 티어 <small>선택</small><select aria-label="나의 티어" value={tier} onChange={e => setTier(e.target.value as Tier | "")}><option value="">별점에 따라 자동 분류</option>{["S", "A", "B", "C", "D"].map(t => <option key={t}>{t}</option>)}</select></label></div>
      <label className={styles.reviewLabel}>기억하고 싶은 이야기 <small>선택</small><textarea aria-label="리뷰" value={review} onChange={e => setReview(e.target.value)} maxLength={5000} placeholder="어떤 장면이 오래 남았나요?" rows={4} /></label>
      <label className={styles.checkLabel}><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} />리뷰에 스포일러가 있어요</label>
      <details className={styles.themeDetails} open={undefined}><summary>테마별로 조금 더 자세히 <span>OST · 미장센 · 스토리</span></summary><p className={styles.muted}>원하는 항목만 기록하세요. 전체 별점과 별도로 저장돼요.</p>{themes.map(t => <div className={styles.themeInput} key={t.key}><label className={styles.checkLabel}><input type="checkbox" checked={themeScores[t.key] !== undefined} onChange={e => setThemeScores(scores => { const next = { ...scores }; if (e.target.checked) next[t.key] = 4; else delete next[t.key]; return next; })} />{t.label}</label><input aria-label={`${t.label} 별점`} type="range" min="0" max="5" step="0.1" disabled={themeScores[t.key] === undefined} value={themeScores[t.key] ?? 4} onChange={e => setThemeScores(scores => ({ ...scores, [t.key]: Number(e.target.value) }))} /><strong>{themeScores[t.key]?.toFixed(1) ?? "—"}</strong></div>)}</details>
      {history.length > 0 && <div className={styles.history}><div className={styles.between}><span>이 영화와의 기록 · {history.length}회</span>{entry && <button type="button" className={styles.textButton} onClick={onRewatch}>＋ 재관람 기록 추가</button>}</div>{history.map(log => <small key={log.id}>{log.watchedOn || "관람일 미정"} · ★ {log.rating?.toFixed(1) ?? "미정"}</small>)}</div>}
      <button className={styles.redButton} type="submit"><Check size={18} />{entry ? "기록 수정하기" : "나의 장면으로 저장"}</button>
    </form> : <Discussion comments={state.comments.filter(c => c.scope === "public" && c.movieId === movie.id)} onSubmit={onComment} />}
  </Modal>;
}

export function RecommendDialog({ movie, state, onClose, onSend }: { movie: Movie; state: SceneState; onClose: () => void; onSend: (to: (typeof accounts)[number]["id"][], note: string) => void }) {
  const friends = friendIds(state);
  const groups = state.groups.filter(g => g.members.includes(state.userId));
  const [target, setTarget] = useState(friends[0] ? `user:${friends[0]}` : groups[0] ? `group:${groups[0].id}` : "");
  const [note, setNote] = useState("");
  return <Modal title="이 영화, 네 생각이 났어." onClose={onClose}>
    <p className={styles.muted}>〈{movie.title}〉 추천을 보내요. · 예시 계정 간 체험</p>
    <form className={styles.recordForm} onSubmit={e => { e.preventDefault(); const recipients = target.startsWith("user:") ? [target.slice(5) as (typeof accounts)[number]["id"]] : groups.find(g => g.id === target.slice(6))?.members.filter(id => id !== state.userId) ?? []; if (recipients.length) onSend(recipients, note); }}>
      <label className={styles.reviewLabel}>누구에게 보낼까요?<select aria-label="추천 받을 친구 또는 그룹" value={target} onChange={e => setTarget(e.target.value)} required><option value="" disabled>친구 또는 그룹 선택</option>{friends.map(id => <option key={id} value={`user:${id}`}>{id}</option>)}{groups.map(g => <option key={g.id} value={`group:${g.id}`}>{g.name} · 그룹</option>)}</select></label>
      <label className={styles.reviewLabel}>추천하는 이유 <small>선택</small><textarea aria-label="추천 메시지" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="너 이 장면 좋아할 것 같아서." rows={4} /></label><button className={styles.redButton} disabled={!target}><Send size={17} />추천 보내기</button>
    </form>
  </Modal>;
}
