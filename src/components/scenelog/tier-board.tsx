"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Hand, X } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { ratingToTier, today, type FilmLog, type Tier } from "@/lib/scene-model";
import { inPeriod, periodLabel, periodYears, sortLogs, watchedDay, type Period, type TierSort } from "@/lib/tier-view";
import { PeriodMenu, SortHelp, SortMenu } from "./tier-controls";
import styles from "./tier-board.module.css";
import strip from "./tool-strip.module.css";

const tiers: Tier[] = ["S", "A", "B", "C", "D"];
const HOLD_MS = 360;
const MOVE_SLOP = 8;

type Drag = { logId: string; poster: string; title: string; x: number; y: number; w: number; h: number; over: Tier | null };

/** Which tier row is under this screen point, if any. */
function tierAt(x: number, y: number): Tier | null {
  const hit = document.elementsFromPoint(x, y).find(el => el instanceof HTMLElement && el.dataset.tierDrop);
  return ((hit as HTMLElement | undefined)?.dataset.tierDrop as Tier | undefined) ?? null;
}

const TIP_KEY = "scenelog-tier-tip-dismissed";
function subscribeTip(listener: () => void) { window.addEventListener("scenelog-tier-tip", listener); return () => window.removeEventListener("scenelog-tier-tip", listener); }
function tipDismissed() { try { return localStorage.getItem(TIP_KEY) === "1"; } catch { return false; } }

export function TierBoard({ movies, logs, onOpen, onMove, disabled = false }: {
  movies: ArchiveMovie[]; logs: FilmLog[]; onOpen: (movie: ArchiveMovie) => void; onMove: (logId: string, tier: Tier) => void; disabled?: boolean;
}) {
  const [titles, setTitles] = useState(false);
  const [sort, setSort] = useState<TierSort>("rating");
  const [period, setPeriod] = useState<Period>({ mode: "all" });
  const [menu, setMenu] = useState<"period" | "sort" | "help" | null>(null);
  const [currentYear] = useState(() => Number(today().slice(0, 4)));
  const tipHidden = useSyncExternalStore(subscribeTip, tipDismissed, () => true);
  const [drag, setDrag] = useState<Drag | null>(null);
  const gesture = useRef<{ id: number; logId: string; from: Tier; startX: number; startY: number; timer: ReturnType<typeof setTimeout> | null; active: boolean; el: HTMLElement } | null>(null);
  const suppressClickUntil = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const closeMenu = useCallback(() => setMenu(null), []);
  const toggle = (name: "period" | "sort" | "help") => setMenu(current => current === name ? null : name);

  // Only films that have a rating or a hand-picked tier are on the board.
  const ranked = logs.filter(l => l.rating !== null || l.tier);
  const counts = new Map<string, number>();
  for (const log of ranked) { const day = watchedDay(log); for (const key of [day.slice(0, 4), day.slice(0, 7)]) counts.set(key, (counts.get(key) ?? 0) + 1); }
  const shown = sortLogs(ranked.filter(l => inPeriod(l, period)), sort);
  const placed = tiers.map(tier => ({
    tier,
    items: shown.filter(l => (l.tier ?? ratingToTier(l.rating)) === tier).flatMap(log => {
      const movie = movies.find(m => m.id === log.movieId);
      return movie ? [{ log, movie }] : [];
    }),
  }));
  function dismissTip() { try { localStorage.setItem(TIP_KEY, "1"); } catch { /* the tip just comes back next time */ } window.dispatchEvent(new Event("scenelog-tier-tip")); }

  function cancelHold() {
    const g = gesture.current;
    if (g?.timer) clearTimeout(g.timer);
    if (g) g.timer = null;
  }
  function start(event: React.PointerEvent<HTMLElement>, log: FilmLog, movie: ArchiveMovie, from: Tier) {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    const el = event.currentTarget;
    gesture.current = { id: event.pointerId, logId: log.id, from, startX: event.clientX, startY: event.clientY, timer: null, active: false, el };
    pointer.current = { x: event.clientX, y: event.clientY };
    // Touch: wait for a long press so scrolling still works. Mouse: a short drag is enough.
    if (event.pointerType !== "mouse") {
      gesture.current.timer = setTimeout(() => lift(movie, log.id), HOLD_MS);
    }
  }
  function lift(movie: ArchiveMovie, logId: string) {
    const g = gesture.current;
    if (!g) return;
    g.active = true; g.timer = null;
    suppressClickUntil.current = Infinity;
    try { g.el.setPointerCapture(g.id); } catch { /* the finger may already be gone */ }
    const box = g.el.getBoundingClientRect();
    navigator.vibrate?.(12);
    setDrag({ logId, poster: movie.poster, title: movie.title, x: pointer.current.x, y: pointer.current.y, w: box.width, h: box.height, over: g.from });
  }
  function move(event: React.PointerEvent<HTMLElement>, movie: ArchiveMovie) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (!g.active) {
      if (Math.hypot(event.clientX - g.startX, event.clientY - g.startY) > MOVE_SLOP) {
        if (event.pointerType === "mouse") lift(movie, g.logId);
        else cancelHold(); // the finger is scrolling the page
      }
      return;
    }
    setDrag(current => current && { ...current, x: event.clientX, y: event.clientY, over: tierAt(event.clientX, event.clientY) });
  }
  function end(event: React.PointerEvent<HTMLElement>, cancelled: boolean) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    cancelHold();
    gesture.current = null;
    if (!g.active) return;
    const target = cancelled ? null : tierAt(event.clientX, event.clientY);
    setDrag(null);
    if (target && target !== g.from) onMove(g.logId, target);
    // The click that follows a drop lands on whatever poster now sits under the pointer; it must not open that record.
    suppressClickUntil.current = event.timeStamp + 400;
  }

  // While a poster is held, the page must not scroll with the finger; near the screen edge it scrolls by itself.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const block = (event: TouchEvent) => { if (event.cancelable) event.preventDefault(); };
    document.addEventListener("touchmove", block, { passive: false });
    let frame = 0;
    const tick = () => {
      const y = pointer.current.y, edge = 90, max = 16;
      const speed = y < edge ? -max * (1 - y / edge) : y > window.innerHeight - edge ? max * (1 - (window.innerHeight - y) / edge) : 0;
      if (speed) {
        window.scrollBy(0, speed);
        setDrag(current => current && { ...current, over: tierAt(pointer.current.x, pointer.current.y) });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { gesture.current = null; suppressClickUntil.current = event.timeStamp + 400; setDrag(null); } };
    window.addEventListener("keydown", escape);
    return () => { document.removeEventListener("touchmove", block); cancelAnimationFrame(frame); window.removeEventListener("keydown", escape); };
  }, [dragging]);
  useEffect(() => () => { if (gesture.current?.timer) clearTimeout(gesture.current.timer); }, []);

  return <div className={styles.board} data-dragging={dragging || undefined}>
    <div className={strip.controls}>
      <PeriodMenu open={menu === "period"} onToggle={() => toggle("period")} onClose={closeMenu} period={period} years={periodYears(ranked, currentYear)} counts={counts} onChange={setPeriod} />
      <SortMenu open={menu === "sort"} onToggle={() => toggle("sort")} onClose={closeMenu} sort={sort} onChange={setSort} />
      <button type="button" className={strip.toggle} aria-pressed={titles} onClick={() => setTitles(value => !value)}>제목 보기</button>
      <SortHelp open={menu === "help"} onToggle={() => toggle("help")} onClose={closeMenu} />
    </div>
    {!tipHidden && <div className={styles.tip}><Hand size={18} aria-hidden="true" /><span>꾹 눌러 끌어서 티어를 옮겨요</span><button type="button" aria-label="안내 닫기" onClick={dismissTip}><X size={18} aria-hidden="true" /></button></div>}
    {period.mode !== "all" && shown.length === 0 && <p className={styles.emptyPeriod}>{periodLabel(period)}에 평가한 영화가 없어요.</p>}
    {placed.map(({ tier, items }) => <section className={styles.row} key={tier} data-tier={tier} data-tier-drop={tier} data-empty={items.length === 0 || undefined} data-over={drag?.over === tier && drag.over !== null || undefined} aria-label={`${tier} 티어 ${items.length}편`}>
      <strong className={styles.letter}>{tier}</strong>
      {items.length > 0
        ? <div className={styles.grid} data-titles={titles || undefined}>{items.map(({ log, movie }) => <div className={styles.film} key={log.id} data-lifted={drag?.logId === log.id || undefined}>
          <button type="button" className={styles.poster} aria-label={`${movie.title} 기록 열기`} onContextMenu={event => event.preventDefault()}
            onPointerDown={event => start(event, log, movie, tier)} onPointerMove={event => move(event, movie)} onPointerUp={event => end(event, false)} onPointerCancel={event => end(event, true)}
            onClick={event => { if (event.timeStamp > suppressClickUntil.current) onOpen(movie); }}>
            <Image width={200} height={300} sizes="(max-width: 640px) 24vw, 140px" src={movie.poster} alt="" draggable={false} />
            <span className={styles.cap}>{movie.title}</span>
          </button>
          <span className={styles.name}>{movie.title}<small>{log.rating !== null ? `★ ${log.rating.toFixed(1)}` : ""}</small></span>
        </div>)}</div>
        : <p className={styles.none}>{dragging ? "여기로 옮기기" : "비어 있어요"}</p>}
    </section>)}
    {drag && <div className={styles.ghost} style={{ width: drag.w, height: drag.h, transform: `translate(${drag.x - drag.w / 2}px, ${drag.y - drag.h * .62}px) scale(1.08) rotate(-2deg)` }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={drag.poster} alt="" />
    </div>}
  </div>;
}
