"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { coverColors, type FilmJournal } from "@/lib/journal-model";
import styles from "./journal-shelf.module.css";

export type ShelfItem = { year: number; book?: FilmJournal };
type Geometry = { H: number; ws: number; d: number; gap: number };

const smooth = (x: number) => x * x * (3 - 2 * x);
const bump = (r: number) => Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * .5;
const measure = (width: number): Geometry => { const d = Math.min(width * .58, 250), H = d / .7; return { H, d, ws: H * .16, gap: H * .035 }; };

function Faces({ item }: { item: ShelfItem }) {
  const { book, year } = item;
  const style = book ? { "--cover": coverColors[book.cover] } as CSSProperties : undefined;
  return <>
    <div className={styles.sp} style={style}><span className={styles.spYear}>{year}</span><span className={styles.spTitle}>{book ? book.title : "비어 있는 해"}</span><span className={styles.spMark}>{book ? "SL" : "+"}</span></div>
    <div className={styles.cv} style={style}>{book
      ? <><span className={styles.cvLabel}>SCENELOG<br />PERSONAL FILM JOURNAL</span><strong className={styles.cvYear}>{year}</strong><span className={styles.cvTitle}>{book.title}</span><span className={styles.cvFoot}><BookOpen size={16} />{book.pages.length} PAGES</span></>
      : <><span className={styles.cvPlus}><Plus size={30} strokeWidth={1.2} /></span><strong className={styles.cvYear}>{year}</strong><span className={styles.cvTitle}>이 해의 첫 페이지</span></>}
    </div>
  </>;
}

export function JournalShelf({ items, initialYear, onOpen, onCreate, onActive, focusYear }: {
  items: ShelfItem[]; initialYear: number; onOpen: (year: number) => void; onCreate: (year: number) => void;
  /** Called with the year of the book at the front of the shelf. */ onActive?: (year: number) => void;
  /** When this year changes, the shelf turns to that book. */ focusYear?: number;
}) {
  const count = items.length, firstYear = items[0].year;
  const shelf = useRef<HTMLDivElement>(null), tapes = useRef<(HTMLDivElement | null)[]>([]);
  const position = useRef({ s: initialYear - firstYear, T: initialYear - firstYear, shown: initialYear - firstYear, lo: firstYear });
  const geometry = useRef<Geometry>(measure(320)), frame = useRef<number | null>(null), last = useRef(0);
  const dragging = useRef(false), reduced = useRef(false), suppress = useRef(false);
  const drag = useRef<{ x: number; T: number; moved: boolean; id: number } | null>(null);
  const [geo, setGeo] = useState<Geometry>(() => measure(320));
  const [active, setActive] = useState(initialYear);

  const apply = useCallback(() => {
    const element = shelf.current; if (!element) return;
    const { H, ws, d, gap } = geometry.current, s = position.current.s, limit = element.clientWidth / 2 + d * 1.2;
    tapes.current.forEach((tape, i) => {
      if (!tape) return;
      const r = i - s, x = r * (ws + gap) + (d - ws + 1.6 * gap) * bump(r);
      if (Math.abs(x) > limit) { tape.style.visibility = "hidden"; return; }
      const open = smooth(Math.max(0, 1 - Math.abs(r)));
      tape.style.visibility = "visible";
      tape.style.transform = `translate3d(${x}px, ${-open * .025 * H}px, ${open * .2 * H}px) rotateZ(${-3 * open}deg) rotateY(${-90 * open}deg)`;
      tape.style.zIndex = String(Math.round(100 - Math.abs(r) * 4));
      tape.style.setProperty("--shade-sp", String(open * .55));
      tape.style.setProperty("--shade-cv", String((1 - open) * .5));
    });
  }, []);

  const run = useCallback(() => {
    if (frame.current !== null) return;
    const tick = (now: number) => {
      const p = position.current, dt = Math.min(.05, (now - last.current) / 1000 || .016);
      last.current = now;
      const k = dragging.current ? 18 : reduced.current ? 1 : 5.2;
      p.s += (p.T - p.s) * (1 - Math.exp(-k * dt)); if (Math.abs(p.T - p.s) < 1e-4) p.s = p.T;
      apply();
      const index = Math.round(p.s); if (index !== p.shown) { p.shown = index; setActive(p.lo + index); }
      frame.current = p.s !== p.T || dragging.current ? requestAnimationFrame(tick) : null;
    };
    last.current = performance.now(); frame.current = requestAnimationFrame(tick);
  }, [apply]);

  useEffect(() => {
    const element = shelf.current!;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new ResizeObserver(() => { geometry.current = measure(element.clientWidth); setGeo(geometry.current); apply(); });
    observer.observe(element);
    return () => { observer.disconnect(); if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; };
  }, [apply]);

  useEffect(() => {
    const p = position.current;
    if (p.lo !== firstYear) { const shift = p.lo - firstYear; p.s += shift; p.T += shift; p.shown += shift; p.lo = firstYear; }
    apply();
  }, [firstYear, count, apply]);

  useEffect(() => { onActive?.(active); }, [active, onActive]);
  useEffect(() => {
    if (focusYear === undefined) return;
    const index = focusYear - firstYear;
    if (index < 0 || index >= count || index === Math.round(position.current.T)) return;
    position.current.T = index; run();
  }, [focusYear, firstYear, count, run]);

  const clamp = (value: number) => Math.max(0, Math.min(count - 1, value));
  const go = (delta: number) => { position.current.T = clamp(Math.round(position.current.T) + delta); run(); };
  const activate = (index: number) => { const item = items[index]; if (item.book) onOpen(item.year); else onCreate(item.year); };
  const clickTape = (index: number) => {
    if (suppress.current) return;
    const r = index - position.current.s;
    if (Math.abs(r) < .5) activate(index); else { position.current.T = clamp(Math.round(position.current.T + r)); run(); }
  };
  const endDrag = () => {
    const current = drag.current; drag.current = null;
    if (!current?.moved) return;
    dragging.current = false; position.current.T = clamp(Math.round(position.current.T));
    suppress.current = true; setTimeout(() => { suppress.current = false; }, 0); run();
  };
  const shown = items.find(item => item.year === active) ?? items[0], shownIndex = items.indexOf(shown);

  return <div className={styles.wrap}>
    <div ref={shelf} className={styles.shelf} role="group" aria-roledescription="carousel" aria-label="연도별 다이어리 책장" tabIndex={0}
      style={{ "--H": `${geo.H}px`, "--ws": `${geo.ws}px`, "--d": `${geo.d}px` } as CSSProperties}
      onPointerDown={event => { if (event.pointerType === "mouse" && event.button !== 0) return; drag.current = { x: event.clientX, T: position.current.T, moved: false, id: event.pointerId }; }}
      onPointerMove={event => {
        const current = drag.current; if (!current || event.pointerId !== current.id) return;
        const dx = event.clientX - current.x;
        if (!current.moved) { if (Math.abs(dx) < 6) return; current.moved = true; dragging.current = true; shelf.current?.setPointerCapture(event.pointerId); }
        position.current.T = clamp(current.T - dx / (geometry.current.ws + geometry.current.gap)); run();
      }}
      onPointerUp={endDrag} onPointerCancel={endDrag}
      onKeyDown={event => {
        if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
        else if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
        else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(clamp(Math.round(position.current.T))); }
      }}>
      <div className={styles.stage}>
        {items.map((item, i) => <div key={item.year} ref={element => { tapes.current[i] = element; }} className={styles.tape} data-empty={item.book ? undefined : "true"} onClick={() => clickTape(i)}><Faces item={item} /></div>)}
      </div>
    </div>
    <div className={styles.caption} aria-live="polite">
      <div key={shown.year} className={styles.captionIn}>
        <strong>{shown.year}</strong>
        <span>{shown.book ? shown.book.title : "아직 쓰지 않은 한 해"}</span>
        {shown.book && <small>{shown.book.pages.length}쪽</small>}
      </div>
    </div>
    <div className={styles.controls}>
      <button type="button" aria-label="이전 해" disabled={shownIndex <= 0} onClick={() => go(-1)}><ChevronLeft size={20} /></button>
      <button type="button" className={styles.primary} onClick={() => activate(shownIndex)}>{shown.book ? <><BookOpen size={17} />다이어리 열기</> : <><Plus size={17} />{shown.year}년 만들기</>}</button>
      <button type="button" aria-label="다음 해" disabled={shownIndex >= count - 1} onClick={() => go(1)}><ChevronRight size={20} /></button>
    </div>
  </div>;
}
