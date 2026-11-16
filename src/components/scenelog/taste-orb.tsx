"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { InsightId, TasteInsight } from "@/lib/taste-insights";
import styles from "./taste-orb.module.css";

const HUES: Record<InsightId, number> = { rank: 350, like: 18, miss: 225, dir: 262, dec: 160, pub: 340, theme: 36, run: 195, week: 290, best: 8 };
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
type Matrix = number[][];
const identity = (): Matrix => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const multiply = (a: Matrix, b: Matrix): Matrix => a.map(row => [0, 1, 2].map(c => row[0] * b[0][c] + row[1] * b[1][c] + row[2] * b[2][c]));
const rotateY = (angle: number): Matrix => [[Math.cos(angle), 0, Math.sin(angle)], [0, 1, 0], [-Math.sin(angle), 0, Math.cos(angle)]];
const rotateX = (angle: number): Matrix => [[1, 0, 0], [0, Math.cos(angle), -Math.sin(angle)], [0, Math.sin(angle), Math.cos(angle)]];
const tint = (id: InsightId) => ({ "--tint": `hsl(${HUES[id]} 70% 62%)`, "--deep": `hsl(${HUES[id]} 70% 36%)`, "--shade": `hsl(${HUES[id]} 60% 14% / .86)`, "--pale": `hsl(${HUES[id]} 80% 92%)`, "--num": `hsl(${HUES[id]} 70% 42%)` }) as CSSProperties;
const percent = (value: number) => `${Math.max(0, Math.min(5, value)) / 5 * 100}%`;

interface Sim {
  matrix: Matrix; yaw: number; pitch: number; dragging: boolean; touched: boolean; moved: number;
  expand: number; expandTarget: number; focus: number; intro: number; visible: boolean; hover: number;
  w: number; h: number; radius: number; focal: number; tileW: number; tileH: number; reduced: boolean;
}

export function TasteOrb({ insights, title, onOpenMovie }: { insights: TasteInsight[]; title: ReactNode; onOpenMovie: (movie: ArchiveMovie) => void }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const detailRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const downTile = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const returnFocus = useRef<number | null>(null);
  const closing = useRef(false);
  const sim = useRef<Sim>({ matrix: multiply(rotateX(-.38), identity()), yaw: 0, pitch: 0, dragging: false, touched: false, moved: 0, expand: 0, expandTarget: 0, focus: -1, intro: 0, visible: true, hover: -1, w: 0, h: 0, radius: 0, focal: 0, tileW: 0, tileH: 0, reduced: false });
  const [open, setOpen] = useState<number | null>(null);
  const [caption, setCaption] = useState(0);
  const [slide, setSlide] = useState(0);
  const count = insights.length;

  const points = useRef<number[][]>([]);
  useEffect(() => {
    points.current = insights.map((_, i) => { const y = i * (2 / count) - 1 + 1 / count, r = Math.sqrt(1 - y * y), a = GOLDEN * i; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
  }, [insights, count]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const s = sim.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (s.reduced) s.intro = 1;
    const measure = () => {
      s.w = hero.clientWidth; s.h = hero.clientHeight;
      const phone = s.w < 700;
      s.tileW = phone ? 88 : 116; s.tileH = Math.round(s.tileW * 1.3);
      s.radius = phone ? Math.min(132, s.w / 2 - 52) : Math.min(260, (s.h - 110) / 2 - 100);
      s.focal = s.radius * 2.7;
      hero.style.setProperty("--tw", `${s.tileW}px`); hero.style.setProperty("--th", `${s.tileH}px`);
    };
    measure();
    const resize = new ResizeObserver(measure); resize.observe(hero);
    const visibility = new IntersectionObserver(([entry]) => { s.visible = entry.isIntersecting; });
    visibility.observe(hero);
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(48, now - previous) / 16.67; previous = now;
      if (!s.visible) return;
      if (!s.dragging) { s.yaw *= Math.pow(.94, dt); s.pitch *= Math.pow(.94, dt); if (!s.touched && !s.expandTarget && !s.reduced) s.yaw += .00055 * dt; }
      if (s.expandTarget) { s.yaw *= .8; s.pitch *= .8; }
      s.matrix = multiply(rotateY(s.yaw * dt), multiply(rotateX(s.pitch * dt), s.matrix));
      s.expand += (s.expandTarget - s.expand) * (s.reduced ? 1 : 1 - Math.pow(.88, dt));
      s.intro = Math.min(1, s.intro + dt * .018);
      const e = 1 - Math.pow(1 - s.intro, 3), cx = s.w / 2, cy = s.w < 700 ? s.h / 2 + 6 : (s.h - 110) / 2 + 24, m = s.matrix;
      points.current.forEach((p, i) => {
        const el = tileRefs.current[i];
        if (!el) return;
        const x = (m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2]) * s.radius, y = (m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2]) * s.radius, z = (m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2]) * s.radius;
        const k = s.focal / (s.focal - z), focus = i === s.focus, push = 1 + .9 * s.expand * (focus ? 0 : 1), depth = (z + s.radius) / (2 * s.radius);
        el.style.transform = `translate(${cx + x * k * push * e - s.tileW / 2}px,${cy + y * k * push * e - s.tileH / 2}px) scale(${k * (.25 + .75 * e)})`;
        el.style.zIndex = String(Math.round(z + s.radius));
        el.style.opacity = String(Math.max(0, (.38 + .62 * depth) * (1 - (focus ? 1 : .88) * s.expand) * Math.min(1, e * 1.6)));
        el.dataset.depth = String(z);
        el.tabIndex = depth > .5 || focus ? 0 : -1;
      });
    };
    frame = requestAnimationFrame(tick);
    // On touch screens there is no hover, so the caption follows whichever card faces the viewer.
    const follow = window.setInterval(() => {
      if (s.expandTarget || s.hover >= 0 || !s.visible) return;
      let front = 0, depth = -Infinity;
      tileRefs.current.forEach((el, i) => { const z = Number(el?.dataset.depth ?? -Infinity); if (z > depth) { depth = z; front = i; } });
      setCaption(front);
    }, 400);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); visibility.disconnect(); window.clearInterval(follow); };
  }, [insights]);

  const openCard = useCallback((index: number) => {
    const s = sim.current;
    closing.current = false;
    s.focus = index; s.expandTarget = 1; returnFocus.current = index;
    setOpen(index); setCaption(index); setSlide(0);
  }, []);

  const closeCard = useCallback(() => {
    const s = sim.current, panel = detailRef.current;
    if (closing.current || open === null) return;
    closing.current = true; s.expandTarget = 0;
    const finish = () => { setOpen(null); s.focus = -1; closing.current = false; tileRefs.current[returnFocus.current ?? 0]?.focus({ preventScroll: true }); };
    if (!panel || s.reduced) { finish(); return; }
    panel.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(-50%,-46%) scale(.92)", opacity: 0 }], { duration: 380, easing: "cubic-bezier(.4,0,.8,.4)", fill: "forwards" }).onfinish = finish;
  }, [open]);

  const step = useCallback((direction: number) => {
    if (open === null) return;
    const next = (open + direction + count) % count;
    sim.current.focus = next; returnFocus.current = next; setOpen(next); setCaption(next); setSlide(direction);
  }, [open, count]);

  // Fly the opened card out of the tile it came from.
  const openedFrom = useRef<number | null>(null);
  useLayoutEffect(() => {
    const panel = detailRef.current;
    if (open === null) { openedFrom.current = null; return; }
    if (!panel || openedFrom.current !== null || sim.current.reduced) { openedFrom.current = open; return; }
    openedFrom.current = open;
    const tile = tileRefs.current[open]?.getBoundingClientRect(), box = panel.getBoundingClientRect();
    if (!tile) return;
    const dx = tile.left + tile.width / 2 - (box.left + box.width / 2), dy = tile.top + tile.height / 2 - (box.top + box.height / 2), scale = Math.max(.18, tile.width / box.width);
    panel.animate([{ transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${scale})`, opacity: 0 }, { opacity: 1, offset: .25 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" });
  }, [open]);

  useEffect(() => {
    if (open === null) return;
    closeRef.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCard();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; };
  }, [open, closeCard, step]);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.expandTarget || (event.pointerType === "mouse" && event.button !== 0)) return;
    s.dragging = true; s.touched = true; s.moved = 0;
    last.current = { x: event.clientX, y: event.clientY };
    const tile = (event.target as HTMLElement).closest<HTMLElement>("[data-tile]");
    downTile.current = tile ? Number(tile.dataset.tile) : null;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (!s.dragging) return;
    const dx = event.clientX - last.current.x, dy = event.clientY - last.current.y;
    last.current = { x: event.clientX, y: event.clientY };
    s.moved += Math.abs(dx) + Math.abs(dy); s.yaw += dx * .0011; s.pitch += -dy * .0011;
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (!s.dragging) return;
    s.dragging = false; delete event.currentTarget.dataset.dragging;
    if (s.moved < 8 && downTile.current !== null && event.type === "pointerup") openCard(downTile.current);
    downTile.current = null;
  };

  const active = open === null ? null : insights[open];
  const current = insights[caption] ?? insights[0];

  return <>
    <div ref={heroRef} className={styles.hero} data-focus={open !== null || undefined} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} role="group" aria-label="나의 취향 분석 카드. 끌어서 돌리고 눌러서 열어 보세요">
      <div className={styles.title}>{title}</div>
      {insights.map((insight, index) => <button key={insight.id} ref={element => { tileRefs.current[index] = element; }} data-tile={index} className={styles.tile} style={tint(insight.id)} aria-label={`${insight.label}: ${insight.name}`} onPointerEnter={event => { if (event.pointerType === "mouse") { sim.current.hover = index; setCaption(index); } }} onPointerLeave={() => { sim.current.hover = -1; }} onClick={event => { if (event.detail === 0) openCard(index); }}>
        {insight.films[0] && <Image className={styles.tileImage} src={insight.films[0].movie.poster} fill sizes="120px" alt="" draggable={false} />}
        <span className={styles.tileLabel}>{insight.short}</span><span className={styles.tileBig}>{insight.big}</span><span className={styles.tileName}>{insight.name}</span>
      </button>)}
      <div className={styles.caption} aria-hidden="true"><div key={current.id} className={styles.captionIn}>{current.label}<small>{current.id === "rank" ? "좋아한 순 · 많이 본 순" : current.name}</small></div></div>
      <div className={styles.hint} aria-hidden="true">DRAG TO EXPLORE · 돌려서 탐색하세요</div>
    </div>
    {active && createPortal(<>
      <div className={styles.veil} onClick={closeCard} />
      <button ref={closeRef} className={styles.close} onClick={closeCard} aria-label="닫기"><X size={20} /></button>
      <div ref={detailRef} className={styles.detail} role="dialog" aria-modal="true" aria-label={active.label}>
        <div className={styles.sheet} data-slide={slide || undefined} key={active.id}>{active.rank ? <RankCard insight={active} /> : <InsightCard insight={active} onOpenMovie={movie => { closeCard(); onOpenMovie(movie); }} />}</div>
        <div className={styles.nav}><button onClick={() => step(-1)} aria-label="이전 카드"><ArrowLeft size={20} /></button><span>{(open ?? 0) + 1} / {count}</span><button onClick={() => step(1)} aria-label="다음 카드"><ArrowRight size={20} /></button></div>
      </div>
    </>, document.body)}
  </>;
}

function InsightCard({ insight, onOpenMovie }: { insight: TasteInsight; onOpenMovie: (movie: ArchiveMovie) => void }) {
  return <article className={styles.card} style={tint(insight.id)}>
    <div className={styles.kicker}>{insight.label}</div>
    <div className={styles.number}><b>{insight.big}</b><span>{insight.name}</span></div>
    <h2>{insight.sentence}</h2>
    {insight.bars ? <div className={styles.mini}>{insight.bars.map((bar, i) => <div key={bar.label} data-top={i === 0 || undefined}><span>{bar.label}</span><i style={{ "--w": percent(bar.average) } as CSSProperties} /><b>{bar.average.toFixed(1)}</b></div>)}</div>
      : insight.compare && <div className={styles.compare}><div className={styles.track}><span className={styles.fillBar} style={{ "--w": percent(insight.compare.value) } as CSSProperties} /><span className={styles.mark} style={{ "--x": percent(insight.compare.base) } as CSSProperties} /></div><div className={styles.compareCaption}><span>{insight.compare.baseLabel} <b>{insight.compare.base.toFixed(1)}</b></span><span>{insight.compare.valueLabel} <b>{insight.compare.value.toFixed(1)}</b></span></div></div>}
    <div className={styles.deck}>{insight.films.slice(0, 3).map(({ movie, log }) => <button key={movie.id} onClick={() => onOpenMovie(movie)} aria-label={`${movie.title} ${log.rating?.toFixed(1)}점 기록 열기`}><Image src={movie.poster} width={120} height={180} sizes="100px" alt="" /></button>)}</div>
    <div className={styles.stats}>{insight.stats.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
  </article>;
}

function RankCard({ insight }: { insight: TasteInsight }) {
  const [mode, setMode] = useState<"liked" | "watched">("liked");
  const rank = insight.rank!;
  const rows = rank[mode];
  return <article className={`${styles.card} ${styles.rank}`}>
    <div className={styles.kicker}>{insight.label}</div>
    <div className={styles.toggle} role="group" aria-label="순위 기준"><span className={styles.thumb} style={{ transform: `translateX(${mode === "liked" ? 0 : 100}%)` }} />{([["liked", "좋아한 순"], ["watched", "많이 본 순"]] as const).map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</div>
    <h2>{mode === "liked" ? "별점으로 본 내 장르 순위" : "시청 편수로 본 내 장르 순위"}</h2>
    <p className={styles.why}>{mode === "liked" ? "평균 별점이 높은 순서예요. 2편 이상 본 장르만 셌어요." : "많이 본 순서예요. 많이 봤다고 다 좋아하는 건 아니에요."}</p>
    <ol key={mode}>{rows.map((row, i) => <li key={row.name} style={{ "--i": i } as CSSProperties}><span className={styles.rankNo}>{i + 1}</span><span>{row.name}</span><span className={styles.rankValue}><b>{mode === "liked" ? `★ ${row.average.toFixed(1)}` : `${row.count}편`}</b> {mode === "liked" ? `${row.count}편` : `★ ${row.average.toFixed(1)}`}</span></li>)}</ol>
    <div className={styles.foot}>{rank.foot}</div>
  </article>;
}
