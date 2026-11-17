"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Plus, Send, Music2, Frame, AlignLeft, ChevronDown, X } from "lucide-react";
import type { ArchiveMovie as Movie } from "@/lib/archive-movies";
import { friendIds, newId, themes, today, type AccountId, type FilmLog, type SceneState, type ThemeKey, type Tier } from "@/lib/scene-store";
import { Discussion, Modal } from "./ui";
import { RatingComparison } from "./rating-comparison";
import { PrecisionRating } from "./precision-rating";
import design from "./record-design.module.css";
import styles from "./scenelog.module.css";

/** Date field: a menu with quick picks, the native calendar, and "don't remember" (an empty date). */
function WatchedDate({ value, max, onChange }: { value: string; max: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [open]);
  const yesterday = (() => { const day = new Date(`${max}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - 1); return day.toISOString().slice(0, 10); })();
  const pick = (next: string) => { onChange(next); setOpen(false); };
  return <div className={design.dateField} ref={wrap}>
    <button type="button" className={design.control} aria-haspopup="menu" aria-expanded={open} aria-label={`관람일 ${value || "기억나지 않음"}`} onClick={() => setOpen(current => !current)}><span>{value || "기억나지 않음"}</span><CalendarDays size={18} aria-hidden="true" /></button>
    <input ref={picker} className={design.hiddenDate} type="date" tabIndex={-1} aria-hidden="true" value={value} max={max} onChange={event => onChange(event.target.value)} />
    {open && <div className={design.dateMenu} role="menu">
      <button type="button" role="menuitem" data-current={value === max || undefined} onClick={() => pick(max)}>오늘</button>
      <button type="button" role="menuitem" data-current={value === yesterday || undefined} onClick={() => pick(yesterday)}>어제</button>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); try { picker.current?.showPicker(); } catch { picker.current?.focus(); } }}>날짜 직접 선택</button>
      <button type="button" role="menuitem" data-current={!value || undefined} onClick={() => pick("")}>기억나지 않음</button>
    </div>}
  </div>;
}

/** Tier field: the same dropdown look as the date menu. An empty tier means "sort automatically by rating". */
function TierMenu({ value, onChange }: { value: Tier | ""; onChange: (value: Tier | "") => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [open]);
  const pick = (next: Tier | "") => { onChange(next); setOpen(false); };
  return <div className={design.dateField} ref={wrap}>
    <button type="button" className={design.control} aria-haspopup="menu" aria-expanded={open} aria-label={`나의 티어 ${value || "자동 분류"}`} onClick={() => setOpen(current => !current)}><span>{value || "자동 분류"}</span><ChevronDown size={18} aria-hidden="true" /></button>
    {open && <div className={design.dateMenu} data-align="end" role="menu">
      <button type="button" role="menuitemradio" aria-checked={value === ""} data-current={value === "" || undefined} onClick={() => pick("")}>별점에 따라 자동 분류</button>
      {(["S", "A", "B", "C", "D"] as const).map(tier => <button type="button" role="menuitemradio" aria-checked={value === tier} data-current={value === tier || undefined} key={tier} onClick={() => pick(tier)}>{tier}</button>)}
    </div>}
  </div>;
}

/** Long TMDB synopses fold to three lines; the toggle only appears when the text really overflows. */
function Description({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setOverflows(el.scrollHeight - el.clientHeight > 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, open]);
  if (!text) return null;
  return <div className={design.description}>
    <p ref={ref} className={open ? undefined : design.clamped}>{text}</p>
    {(overflows || open) && <button type="button" className={design.moreButton} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? "접기" : "더보기"}</button>}
  </div>;
}

export function RecordDialog({ movie, movies, personal = false, saving = false, saveError, entry, initialDate, state, onSave, onClose, onRecommend, onRewatch, onComment }: {
  movie: Movie; movies: Movie[]; personal?: boolean; saving?: boolean; saveError?: string | null; entry?: FilmLog; initialDate?: string; state: SceneState; onSave: (log: FilmLog) => void;
  onClose: () => void; onRecommend: () => void; onRewatch: () => void;
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
  const history = state.logs.filter(l => l.userId === state.userId && l.movieId === movie.id);
  return <Modal title={movie.title} onClose={onClose} wide>
    <div className={styles.filmIntro}>
      {/* Use the original poster URL, shared with the Canvas PNG exporter. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={movie.poster} alt={`${movie.title} 포스터`} />
      <div><p className={styles.originalTitle}>{movie.originalTitle}</p><p className={styles.muted}>{movie.year ?? "개봉일 미정"} · {movie.director ?? movie.genres.join(" / ")}<br />{movie.genres.join(" / ")}</p><Description text={movie.description} />
        {!personal && <div className={styles.buttonRow}><button type="button" className={styles.outlineButton} onClick={onRecommend}><Send size={15} /> 친구에게 추천</button></div>}
      </div>
    </div>
    <div className={styles.tabs}><button className={tab === "record" ? styles.activeTab : ""} onClick={() => setTab("record")}>나의 기록</button>{!personal && <button className={tab === "talk" ? styles.activeTab : ""} onClick={() => setTab("talk")}>영화 이야기 <small>{state.comments.filter(c => c.scope === "public" && c.movieId === movie.id).length}</small></button>}</div>
    {tab === "record" ? <form className={styles.recordForm} onSubmit={e => { e.preventDefault(); onSave({ id: entry?.id ?? newId(), userId: state.userId, movieId: movie.id, rating: unrated ? null : rating, watchedOn: date, review: review.trim(), themes: themeScores, tier: tier || undefined, spoiler, createdAt: entry?.createdAt ?? new Date().toISOString() }); }}>
      <div className={design.ratingHeading}><h3>이 영화, 어땠나요?</h3><label className={design.later}><span>별점은 나중에</span><input type="checkbox" role="switch" checked={unrated} onChange={e => setUnrated(e.target.checked)} /><i aria-hidden="true" /></label></div>
      <PrecisionRating value={rating} onChange={setRating} disabled={unrated} />
      <RatingComparison movies={movies} logs={state.logs} user={state.userId} movieId={movie.id} rating={unrated ? null : rating} />
      <div className={design.fields}><div className={design.field}><span className={design.fieldLabel}>관람일</span><WatchedDate value={date} max={today()} onChange={setDate} /></div><div className={design.field}><span className={design.fieldLabel}>나의 티어</span><TierMenu value={tier} onChange={setTier} /></div></div>
      <label className={design.field}><span className={design.fieldLabel}>기억하고 싶은 이야기</span><textarea className={design.textarea} aria-label="리뷰" value={review} onChange={e => setReview(e.target.value)} maxLength={5000} placeholder="어떤 장면이 오래 남았나요?" rows={4} /></label>
      <label className={design.switchRow}><span>리뷰에 스포일러가 있어요</span><input type="checkbox" role="switch" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} /><i aria-hidden="true" /></label>
      <details className={design.themeDetails} open><summary>장면을 더 자세히 <small>선택</small><ChevronDown size={18} /></summary><p>음악, 화면, 이야기를 따로 평가해요.</p><div className={design.themeRows}>{themes.map(t => {
        const Icon = { ost: Music2, visual: Frame, story: AlignLeft }[t.key];
        const enabled = themeScores[t.key] !== undefined;
        const toggle = () => setThemeScores(scores => { const next = { ...scores }; if (next[t.key] === undefined) next[t.key] = 4; else delete next[t.key]; return next; });
        return <div className={design.themeRow} key={t.key}><span className={design.themeName}><Icon size={18} aria-hidden="true" />{t.label}</span>{enabled
          ? <><PrecisionRating inline label={t.label + " 별점"} value={themeScores[t.key]!} onChange={value => setThemeScores(scores => ({ ...scores, [t.key]: value }))} /><button type="button" className={design.themeClear} aria-label={t.label + " 평가 지우기"} onClick={toggle}><X size={16} /></button></>
          : <button type="button" className={design.themeAdd} onClick={toggle}><Plus size={14} />평가 남기기</button>}</div>;
      })}</div></details>
      {history.length > 0 && <div className={design.history}><div className={styles.between}><span>이 영화와의 기록 · {history.length}회</span>{entry && <button type="button" className={styles.textButton} onClick={onRewatch}>＋ 재관람 기록 추가</button>}</div>{history.map(log => <small key={log.id}>{log.watchedOn || "관람일 미정"} · ★ {log.rating?.toFixed(1) ?? "미정"}</small>)}</div>}
      {saveError && <p role="alert">{saveError}</p>}
      <button className={`${styles.blackButton} ${design.submit}`} type="submit" disabled={saving}><Check size={18} />{saving ? "저장 중…" : entry ? "기록 수정하기" : "나의 장면으로 저장"}</button>
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
