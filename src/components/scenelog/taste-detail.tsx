"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { TasteInsight } from "@/lib/taste-insights";
import styles from "./taste-detail.module.css";

const percent = (value: number) => `${Math.max(0, Math.min(5, value)) / 5 * 100}%`;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The opened analysis card: flies out of the figure's card, pages with arrows or swipes, closes with Esc or the backdrop. */
export function TasteDetail({ insights, index, originOf, onChange, onClose, onOpenMovie }: {
  insights: TasteInsight[]; index: number; originOf: (index: number) => DOMRect | null;
  onChange: (index: number) => void; onClose: () => void; onOpenMovie: (movie: ArchiveMovie) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const touchStart = useRef<number | null>(null);
  const [slide, setSlide] = useState(0);
  const count = insights.length;
  const active = insights[index];

  // Fly out of the card that was tapped (first paint only; paging uses the slide animation).
  useLayoutEffect(() => {
    const element = panel.current, origin = originOf(index);
    if (!element || !origin || reducedMotion()) return;
    const box = element.getBoundingClientRect();
    const dx = origin.left + origin.width / 2 - (box.left + box.width / 2), dy = origin.top + origin.height / 2 - (box.top + box.height / 2), scale = Math.max(.18, origin.width / box.width);
    element.animate([{ transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${scale})`, opacity: 0 }, { opacity: 1, offset: .25 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const element = panel.current;
    if (!element || reducedMotion()) { onClose(); return; }
    element.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(-50%,-46%) scale(.92)", opacity: 0 }], { duration: 380, easing: "cubic-bezier(.4,0,.8,.4)", fill: "forwards" }).onfinish = onClose;
  }, [onClose]);

  const step = useCallback((direction: number) => { setSlide(direction); onChange((index + direction + count) % count); }, [index, count, onChange]);

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Capture phase + stopPropagation keeps Esc/arrows from also reaching the figure underneath.
    const onKey = (event: KeyboardEvent) => {
      if (!["Escape", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.stopPropagation();
      if (event.key === "Escape") close(); else step(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); document.body.style.overflow = previousOverflow; };
  }, [close, step]);

  if (!active) return null;
  return createPortal(<>
    <div className={styles.veil} onClick={close} />
    <button ref={closeButton} className={styles.close} onClick={close} aria-label="닫기"><X size={20} /></button>
    <div ref={panel} className={styles.detail} role="dialog" aria-modal="true" aria-label={active.label}
      onTouchStart={event => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={event => { const start = touchStart.current; touchStart.current = null; if (start === null) return; const dx = event.changedTouches[0].clientX - start; if (Math.abs(dx) > 70) step(dx < 0 ? 1 : -1); }}>
      <div className={styles.sheet} data-slide={slide || undefined} key={active.id}>{active.rank ? <RankCard insight={active} /> : <InsightCard insight={active} onOpenMovie={movie => { close(); onOpenMovie(movie); }} />}</div>
      <div className={styles.nav}><button onClick={() => step(-1)} aria-label="이전 카드"><ArrowLeft size={20} /></button><span>{index + 1} / {count}</span><button onClick={() => step(1)} aria-label="다음 카드"><ArrowRight size={20} /></button></div>
    </div>
  </>, document.body);
}

function InsightCard({ insight, onOpenMovie }: { insight: TasteInsight; onOpenMovie: (movie: ArchiveMovie) => void }) {
  const lead = insight.films[0]?.movie;
  return <article className={styles.card} style={{ "--hue": insight.hue } as CSSProperties}>
    <div className={styles.hero}>
      {lead && !lead.poster.includes("placeholder") && <Image src={lead.poster} fill sizes="400px" alt="" />}
      <div className={styles.kicker}>{insight.label}</div>
      <div className={styles.number}><b>{insight.big}</b><span>{insight.name}</span></div>
    </div>
    <div className={styles.body}>
      <h2>{insight.sentence}</h2>
      {insight.bars ? <div className={styles.mini}>{insight.bars.map((bar, i) => <div key={bar.label} data-top={i === 0 || undefined}><span>{bar.label}</span><i style={{ "--w": percent(bar.average) } as CSSProperties} /><b>{bar.average.toFixed(1)}</b></div>)}</div>
        : insight.compare && <div className={styles.compare}><div className={styles.track}><span className={styles.fillBar} style={{ "--w": percent(insight.compare.value) } as CSSProperties} /><span className={styles.mark} style={{ "--x": percent(insight.compare.base) } as CSSProperties} /></div><div className={styles.compareCaption}><span>{insight.compare.baseLabel} <b>{insight.compare.base.toFixed(1)}</b></span><span>{insight.compare.valueLabel} <b>{insight.compare.value.toFixed(1)}</b></span></div></div>}
      <div className={styles.more}>{insight.films.slice(0, 3).map(({ movie, log }, i) => <button key={movie.id} style={{ "--i": i } as CSSProperties} onClick={() => onOpenMovie(movie)} aria-label={`${movie.title} ${log.rating?.toFixed(1)}점 기록 열기`}><Image src={movie.poster} width={120} height={180} sizes="120px" alt="" /><small><span>{movie.title}</span><b>★{log.rating?.toFixed(1)}</b></small></button>)}</div>
      <div className={styles.chips}>{insight.stats.map(([label, value]) => <span key={label}>{label}<b>{value}</b></span>)}</div>
    </div>
  </article>;
}

function RankCard({ insight }: { insight: TasteInsight }) {
  const [mode, setMode] = useState<"liked" | "watched">("liked");
  const rank = insight.rank!;
  const rows = rank[mode];
  return <article className={`${styles.card} ${styles.rank}`}><div className={styles.body}>
    <div className={styles.kicker}>{insight.label}</div>
    <div className={styles.toggle} role="group" aria-label="순위 기준"><span className={styles.thumb} style={{ transform: `translateX(${mode === "liked" ? 0 : 100}%)` }} />{([["liked", "좋아한 순"], ["watched", "많이 본 순"]] as const).map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</div>
    <h2>{mode === "liked" ? "별점으로 본 내 장르 순위" : "시청 편수로 본 내 장르 순위"}</h2>
    <p className={styles.why}>{mode === "liked" ? "평균 별점이 높은 순서예요. 2편 이상 본 장르만 셌어요." : "많이 본 순서예요. 많이 봤다고 다 좋아하는 건 아니에요."}</p>
    <ol key={mode}>{rows.map((row, i) => <li key={row.name} style={{ "--i": i } as CSSProperties}><span className={styles.rankNo}>{i + 1}</span><span>{row.name}</span><span className={styles.rankValue}><b>{mode === "liked" ? `★ ${row.average.toFixed(1)}` : `${row.count}편`}</b> {mode === "liked" ? `${row.count}편` : `★ ${row.average.toFixed(1)}`}</span></li>)}</ol>
    <div className={styles.foot}>{rank.foot}</div>
  </div></article>;
}
