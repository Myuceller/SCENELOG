"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Star } from "lucide-react";
import styles from "./precision-rating.module.css";

function caption(value: number) {
  if (value === 0) return "나와는 맞지 않았어요";
  if (value < 2) return "아쉬움이 남아요";
  if (value < 3) return "괜찮았어요";
  if (value < 4) return "좋았어요";
  if (value < 5) return "오래 기억하고 싶어요";
  return "나의 인생 영화";
}

export function PrecisionRating({ value, onChange, label = "내 별점", inline = false, disabled = false }: {
  value: number; onChange: (value: number) => void; label?: string; inline?: boolean; disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  const shown = hover ?? value;
  function adjust(next: number) { if (Number.isFinite(next)) onChange(Math.round(Math.min(5, Math.max(0, next)) * 10) / 10); }
  // Where the finger or pointer is along the star row, in 0.1 steps: touching 3.5 stars in means 3.5.
  function at(clientX: number) {
    const box = row.current?.getBoundingClientRect();
    return box && box.width ? Math.round(Math.min(5, Math.max(0, (clientX - box.left) / box.width * 5)) * 10) / 10 : value;
  }
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    pressed.current = true;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* a stale pointer id only loses capture; the touch still counts */ }
    adjust(at(event.clientX));
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (pressed.current) adjust(at(event.clientX));
    else if (event.pointerType === "mouse" && !disabled) setHover(at(event.clientX));
  }
  function up() { pressed.current = false; }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const next: Record<string, number> = { ArrowRight: value + .1, ArrowUp: value + .1, ArrowLeft: value - .1, ArrowDown: value - .1, PageUp: value + .5, PageDown: value - .5, Home: 0, End: 5 };
    if (event.key in next) { event.preventDefault(); adjust(next[event.key]); }
  }
  const stars = <div ref={row} className={styles.stars} role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-valuemin={0} aria-valuemax={5} aria-valuenow={value} aria-valuetext={`${value.toFixed(1)}점`} aria-disabled={disabled || undefined}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => { pressed.current = false; setHover(null); }} onKeyDown={key}>
    {[1, 2, 3, 4, 5].map(star => <span className={styles.star} key={star}>
      <Star className={styles.outline} fill="currentColor" strokeWidth={0} /><span style={{ clipPath: `inset(0 ${100 - Math.max(0, Math.min(1, shown - star + 1)) * 100}% 0 0)` }}><Star fill="currentColor" strokeWidth={0} /></span>
    </span>)}
  </div>;
  // Enter in the number box confirms the number; it must not submit the whole record form.
  const number = <label className={styles.number}><input aria-label={`${label} 숫자 입력`} data-display type="number" min="0" max="5" step="0.1" inputMode="decimal" disabled={disabled} value={disabled ? "" : draft ?? value.toFixed(1)} placeholder="—" onFocus={() => setDraft(value.toFixed(1))} onChange={event => { setDraft(event.target.value); if (event.target.value !== "") adjust(Number(event.target.value)); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} onBlur={() => setDraft(null)} /><span>/ 5</span></label>;

  if (inline) return <div className={`${styles.inline} ${disabled ? styles.disabled : ""}`}>{stars}<input className={styles.value} aria-label={`${label} 숫자 입력`} data-display type="number" min="0" max="5" step="0.1" inputMode="decimal" disabled={disabled} value={draft ?? value.toFixed(1)} onFocus={event => { setDraft(value.toFixed(1)); event.currentTarget.select(); }} onChange={event => { setDraft(event.target.value); if (event.target.value !== "") adjust(Number(event.target.value)); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} onBlur={() => setDraft(null)} /></div>;
  return <div className={`${styles.control} ${disabled ? styles.disabled : ""}`}>
    <div className={styles.readout}>{number}<span className={styles.caption}>{disabled ? "별점은 천천히 남겨도 좋아요" : caption(shown)}</span></div>
    {stars}
    <div className={styles.fine}><button type="button" className={styles.zero} disabled={disabled} onClick={() => adjust(0)}>0점</button></div>
  </div>;
}
