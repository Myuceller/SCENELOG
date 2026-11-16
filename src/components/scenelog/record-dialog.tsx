"use client";

import { useState } from "react";
import { Bookmark, Check, Plus, Send, Music2, Frame, AlignLeft, ChevronDown } from "lucide-react";
import type { ArchiveMovie as Movie } from "@/lib/archive-movies";
import { friendIds, newId, themes, today, type AccountId, type FilmLog, type SceneState, type ThemeKey, type Tier } from "@/lib/scene-store";
import { Discussion, Modal } from "./ui";
import { RatingComparison } from "./rating-comparison";
import { PrecisionRating } from "./precision-rating";
import design from "./record-design.module.css";
import styles from "./scenelog.module.css";

export function RecordDialog({ movie, movies, personal = false, saving = false, saveError, entry, initialDate, state, onSave, onClose, onWatchlist, onRecommend, onRewatch, onComment }: {
  movie: Movie; movies: Movie[]; personal?: boolean; saving?: boolean; saveError?: string | null; entry?: FilmLog; initialDate?: string; state: SceneState; onSave: (log: FilmLog) => void;
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
  return <Modal title={movie.title} onClose={onClose} wide>
    <div className={styles.filmIntro}>
      {/* Use the original poster URL, shared with the Canvas PNG exporter. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={movie.poster} alt={`${movie.title} 포스터`} />
      <div><p className={styles.originalTitle}>{movie.originalTitle}</p><p className={styles.muted}>{movie.year ?? "개봉일 미정"} · {movie.director ?? movie.genres.join(" / ")}<br />{movie.genres.join(" / ")}</p><p>{movie.description}</p>
        <div className={styles.buttonRow}><button type="button" className={styles.outlineButton} onClick={onWatchlist} disabled={saving}>{inWatchlist ? <Check size={15} /> : <Bookmark size={15} />}{inWatchlist ? "보고 싶은 영화에 저장됨" : "보고 싶은 영화"}</button>{!personal && <button type="button" className={styles.outlineButton} onClick={onRecommend}><Send size={15} /> 친구에게 추천</button>}</div>
      </div>
    </div>
    <div className={styles.tabs}><button className={tab === "record" ? styles.activeTab : ""} onClick={() => setTab("record")}>나의 기록</button>{!personal && <button className={tab === "talk" ? styles.activeTab : ""} onClick={() => setTab("talk")}>영화 이야기 <small>{state.comments.filter(c => c.scope === "public" && c.movieId === movie.id).length}</small></button>}</div>
    {tab === "record" ? <form className={styles.recordForm} onSubmit={e => { e.preventDefault(); onSave({ id: entry?.id ?? newId(), userId: state.userId, movieId: movie.id, rating: unrated ? null : rating, watchedOn: date, review: review.trim(), themes: themeScores, tier: tier || undefined, spoiler, createdAt: entry?.createdAt ?? new Date().toISOString() }); }}>
      <div className={design.ratingHeading}><div><span>나의 감상</span><h3>이 영화, 어땠나요?</h3></div><label className={design.later}><input type="checkbox" checked={unrated} onChange={e => setUnrated(e.target.checked)} />별점은 나중에</label></div>
      <PrecisionRating value={rating} onChange={setRating} disabled={unrated} />
      <RatingComparison movies={movies} logs={state.logs} user={state.userId} movieId={movie.id} rating={unrated ? null : rating} />
      <div className={styles.twoFields}><label>관람일 <small>선택</small><input aria-label="관람일" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} /><small>기억나지 않으면 비워두세요.</small></label><label>나의 티어 <small>선택</small><select aria-label="나의 티어" value={tier} onChange={e => setTier(e.target.value as Tier | "")}><option value="">별점에 따라 자동 분류</option>{["S", "A", "B", "C", "D"].map(t => <option key={t}>{t}</option>)}</select></label></div>
      <label className={styles.reviewLabel}>기억하고 싶은 이야기 <small>선택</small><textarea aria-label="리뷰" value={review} onChange={e => setReview(e.target.value)} maxLength={5000} placeholder="어떤 장면이 오래 남았나요?" rows={4} /></label>
      <label className={styles.checkLabel}><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} />리뷰에 스포일러가 있어요</label>
      <details className={design.themeDetails} open><summary>장면을 더 자세히 <small>선택</small><ChevronDown size={17} /></summary><p>음악, 화면, 이야기. 마음이 간 부분만 골라주세요. 전체 별점과 별도로 저장돼요.</p><div className={design.themeGrid}>{themes.map(t => {
        const Icon = { ost: Music2, visual: Frame, story: AlignLeft }[t.key];
        const enabled = themeScores[t.key] !== undefined;
        const toggle = () => setThemeScores(scores => { const next = { ...scores }; if (next[t.key] === undefined) next[t.key] = 4; else delete next[t.key]; return next; });
        return <div className={design.themeCard} data-active={enabled} key={t.key}><div className={design.themeTop}><Icon size={16} /><strong>{t.label}</strong><label><input type="checkbox" aria-label={t.label + " 평가 사용"} checked={enabled} onChange={toggle} /><span /></label></div>{enabled ? <PrecisionRating compact label={t.label + " 별점"} value={themeScores[t.key]!} onChange={value => setThemeScores(scores => ({ ...scores, [t.key]: value }))} /> : <button type="button" className={design.themeEmpty} onClick={toggle}><Plus size={14} />평가 남기기</button>}</div>;
      })}</div></details>
      {history.length > 0 && <div className={styles.history}><div className={styles.between}><span>이 영화와의 기록 · {history.length}회</span>{entry && <button type="button" className={styles.textButton} onClick={onRewatch}>＋ 재관람 기록 추가</button>}</div>{history.map(log => <small key={log.id}>{log.watchedOn || "관람일 미정"} · ★ {log.rating?.toFixed(1) ?? "미정"}</small>)}</div>}
      {saveError && <p role="alert">{saveError}</p>}
      <button className={styles.redButton} type="submit" disabled={saving}><Check size={18} />{saving ? "저장 중…" : entry ? "기록 수정하기" : "나의 장면으로 저장"}</button>
    </form> : <Discussion comments={state.comments.filter(c => c.scope === "public" && c.movieId === movie.id)} onSubmit={onComment} />}
  </Modal>;
}

export function RecommendDialog({ movie, state, onClose, onSend }: { movie: Movie; state: SceneState; onClose: () => void; onSend: (to: AccountId[], note: string) => void }) {
  const friends = friendIds(state);
  const groups = state.groups.filter(g => g.members.includes(state.userId));
  const [target, setTarget] = useState(friends[0] ? `user:${friends[0]}` : groups[0] ? `group:${groups[0].id}` : "");
  const [note, setNote] = useState("");
  return <Modal title="이 영화, 네 생각이 났어." onClose={onClose}>
    <p className={styles.muted}>〈{movie.title}〉 추천을 보내요. · 예시 계정 간 체험</p>
    <form className={styles.recordForm} onSubmit={e => { e.preventDefault(); const recipients = target.startsWith("user:") ? [target.slice(5) as AccountId] : groups.find(g => g.id === target.slice(6))?.members.filter(id => id !== state.userId) ?? []; if (recipients.length) onSend(recipients, note); }}>
      <label className={styles.reviewLabel}>누구에게 보낼까요?<select aria-label="추천 받을 친구 또는 그룹" value={target} onChange={e => setTarget(e.target.value)} required><option value="" disabled>친구 또는 그룹 선택</option>{friends.map(id => <option key={id} value={`user:${id}`}>{id}</option>)}{groups.map(g => <option key={g.id} value={`group:${g.id}`}>{g.name} · 그룹</option>)}</select></label>
      <label className={styles.reviewLabel}>추천하는 이유 <small>선택</small><textarea aria-label="추천 메시지" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="너 이 장면 좋아할 것 같아서." rows={4} /></label><button className={styles.redButton} disabled={!target}><Send size={17} />추천 보내기</button>
    </form>
  </Modal>;
}
