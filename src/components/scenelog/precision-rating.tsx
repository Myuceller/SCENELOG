"use client";

import { useState } from "react";
import { Minus, Plus, Star } from "lucide-react";
import styles from "./precision-rating.module.css";

function caption(value: number) {
  if (value === 0) return "나와는 맞지 않았어요";
  if (value < 2) return "아쉬움이 남아요";
  if (value < 3) return "괜찮았어요";
  if (value < 4) return "좋았어요";
  if (value < 5) return "오래 기억하고 싶어요";
  return "나의 인생 영화";
}

export function PrecisionRating({ value, onChange, label = "내 별점", compact = false, disabled = false }: {
  value: number; onChange: (value: number) => void; label?: string; compact?: boolean; disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = hover ?? value;
  function adjust(next: number) { if (Number.isFinite(next)) onChange(Math.round(Math.min(5, Math.max(0, next)) * 10) / 10); }
  return <div className={`${styles.control} ${compact ? styles.compact : ""} ${disabled ? styles.disabled : ""}`}>
    <div className={styles.starSection}>
      <div className={styles.stars} role="group" aria-label={`${label} 빠른 선택`} onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map(star => <button type="button" key={star} disabled={disabled} aria-label={`${label} ${star}점`} onMouseEnter={() => setHover(star)} onFocus={() => setHover(star)} onBlur={() => setHover(null)} onClick={() => { adjust(star); setHover(null); }}>
          <Star className={styles.outline} fill="currentColor" strokeWidth={0} /><span style={{ clipPath: `inset(0 ${100 - Math.max(0, Math.min(1, shown - star + 1)) * 100}% 0 0)` }}><Star fill="currentColor" strokeWidth={0} /></span>
        </button>)}
      </div>
      {!compact && <div className={styles.caption}><span>{disabled ? "별점은 천천히 남겨도 좋아요" : caption(shown)}</span><button type="button" disabled={disabled} onClick={() => adjust(0)}>0점</button></div>}
    </div>
    <div className={styles.precision}>
      <button type="button" aria-label={`${label} 0.1 낮추기`} disabled={disabled || value <= 0} onClick={() => adjust(value - .1)}><Minus size={compact ? 14 : 17} /></button>
      <label className={styles.number}><input aria-label={label} type="number" min="0" max="5" step="0.1" inputMode="decimal" disabled={disabled} value={disabled ? "" : draft ?? value.toFixed(1)} placeholder="—" onFocus={() => setDraft(value.toFixed(1))} onChange={event => { setDraft(event.target.value); if (event.target.value !== "") adjust(Number(event.target.value)); }} onBlur={() => setDraft(null)} /><span>/ 5</span></label>
      <button type="button" aria-label={`${label} 0.1 높이기`} disabled={disabled || value >= 5} onClick={() => adjust(value + .1)}><Plus size={compact ? 14 : 17} /></button>
    </div>
    {!compact && <p className={styles.hint}>별을 눌러 선택하고, 숫자 또는 ± 버튼으로 0.1점까지.</p>}
  </div>;
}
