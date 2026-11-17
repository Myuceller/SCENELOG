"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { periodChip, periodLabel, type Period, type TierSort } from "@/lib/tier-view";
import styles from "./tier-board.module.css";
import strip from "./tool-strip.module.css";
import { Popover } from "./tool-strip";

export function PeriodMenu({ open, onToggle, onClose, period, years, counts, onChange }: {
  open: boolean; onToggle: () => void; onClose: () => void; period: Period; years: number[]; counts: Map<string, number>; onChange: (period: Period) => void;
}) {
  return <Popover open={open} onToggle={onToggle} onClose={onClose} label={`기간 ${periodLabel(period)}`}
    button={<><span>{periodChip(period)}</span><ChevronDown size={18} aria-hidden="true" /></>}>
    {/* Remount on each opening so it always starts at the first level. */}
    <PeriodPanel period={period} years={years} counts={counts} onPick={next => { onChange(next); onClose(); }} />
  </Popover>;
}

function PeriodPanel({ period, years, counts, onPick }: { period: Period; years: number[]; counts: Map<string, number>; onPick: (period: Period) => void }) {
  const [level, setLevel] = useState<"root" | "year" | "month">("root");
  const [year, setYear] = useState(period.mode === "all" ? years[0] : period.year);
  const lowest = years[years.length - 1], highest = years[0];
  const count = (key: string) => counts.get(key) ?? 0;

  if (level === "root") return <div className={strip.list}>
    <button type="button" data-current={period.mode === "all" || undefined} onClick={() => onPick({ mode: "all" })}>전체{period.mode === "all" && <Check size={16} aria-hidden="true" />}</button>
    <button type="button" data-current={period.mode === "year" || undefined} onClick={() => setLevel("year")}>연도 기준<span><small>{period.mode === "year" ? `${period.year}년` : ""}</small><ChevronRight size={16} aria-hidden="true" /></span></button>
    <button type="button" data-current={period.mode === "month" || undefined} onClick={() => setLevel("month")}>월 기준<span><small>{period.mode === "month" ? `${period.year}년 ${period.month}월` : ""}</small><ChevronRight size={16} aria-hidden="true" /></span></button>
  </div>;

  const back = <button type="button" className={strip.back} onClick={() => setLevel("root")}><ChevronLeft size={16} aria-hidden="true" />{level === "year" ? "연도 기준" : "월 기준"}</button>;
  if (level === "year") return <div className={strip.list}>{back}
    {years.map(value => <button type="button" key={value} data-current={(period.mode === "year" && period.year === value) || undefined} onClick={() => onPick({ mode: "year", year: value })}>{value}년<small>{count(String(value))}편</small></button>)}
  </div>;

  return <div className={strip.list}>{back}
    <div className={styles.yearStep}>
      <button type="button" aria-label="이전 연도" disabled={year <= lowest} onClick={() => setYear(year - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      <strong>{year}년</strong>
      <button type="button" aria-label="다음 연도" disabled={year >= highest} onClick={() => setYear(year + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
    </div>
    <div className={styles.months}>{Array.from({ length: 12 }, (_, index) => index + 1).map(month => {
      const filled = count(`${year}-${String(month).padStart(2, "0")}`);
      return <button type="button" key={month} data-current={(period.mode === "month" && period.year === year && period.month === month) || undefined} data-empty={filled === 0 || undefined}
        aria-label={`${year}년 ${month}월 ${filled}편`} onClick={() => onPick({ mode: "month", year, month })}>{month}월{filled > 0 && <small>{filled}</small>}</button>;
    })}</div>
  </div>;
}

const sortNames: Record<TierSort, string> = { rating: "별점순", recent: "최근 본 순" };

export function SortMenu({ open, onToggle, onClose, sort, onChange }: {
  open: boolean; onToggle: () => void; onClose: () => void; sort: TierSort; onChange: (sort: TierSort) => void;
}) {
  return <Popover open={open} onToggle={onToggle} onClose={onClose} label={`정렬 ${sortNames[sort]}`}
    button={<><span>{sortNames[sort]}</span><ChevronDown size={18} aria-hidden="true" /></>}>
    <div className={strip.list}>{(["rating", "recent"] as const).map(value => <button type="button" key={value} data-current={sort === value || undefined} onClick={() => { onChange(value); onClose(); }}>{sortNames[value]}{sort === value && <Check size={16} aria-hidden="true" />}</button>)}</div>
  </Popover>;
}

export function SortHelp({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  return <div className={strip.helpWrap}><Popover open={open} onToggle={onToggle} onClose={onClose} label="정렬 도움말" button={<span aria-hidden="true">?</span>}>
    <div className={strip.help}>
      <strong>같은 티어 안의 순서</strong>
      <p><b>별점순</b> 별점이 높은 영화가 앞에 와요. 별점이 같으면 최근에 본 영화가 먼저예요.</p>
      <p><b>최근 본 순</b> 관람일이 가까운 영화가 앞에 와요. 관람일을 모르면 기록한 날로 따져요.</p>
      <p>티어를 직접 옮긴 영화도 같은 기준으로 줄 서요.</p>
    </div>
  </Popover></div>;
}
