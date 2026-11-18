import type { FilmLog } from "./scene-model";

export type Period = { mode: "all" } | { mode: "year"; year: number } | { mode: "month"; year: number; month: number };
export type TierSort = "rating" | "recent";

/** The day a film counts as watched: the watched date, or the day it was recorded when the date is unknown. */
export function watchedDay(log: FilmLog): string {
  return (log.watchedOn || log.createdAt).slice(0, 10);
}

export function inPeriod(log: FilmLog, period: Period): boolean {
  if (period.mode === "all") return true;
  const day = watchedDay(log);
  if (Number(day.slice(0, 4)) !== period.year) return false;
  return period.mode === "year" || Number(day.slice(5, 7)) === period.month;
}

export function periodLabel(period: Period): string {
  if (period.mode === "all") return "전체";
  return period.mode === "year" ? `${period.year}년` : `${period.year}년 ${period.month}월`;
}

/** Short form for the toolbar button, where width is tight: 2026.03 instead of 2026년 3월. */
export function periodChip(period: Period): string {
  return period.mode === "month" ? `${period.year}.${String(period.month).padStart(2, "0")}` : periodLabel(period);
}

/** Years that have records, newest first, always including `currentYear`. */
export function periodYears(logs: FilmLog[], currentYear: number): number[] {
  const years = new Set<number>([currentYear]);
  for (const log of logs) { const year = Number(watchedDay(log).slice(0, 4)); if (year > 0) years.add(year); }
  return [...years].sort((a, b) => b - a);
}

/** Order inside a tier: "rating" puts higher ratings first and breaks ties by the more recently watched film. */
export function sortLogs(logs: FilmLog[], sort: TierSort): FilmLog[] {
  const recent = (a: FilmLog, b: FilmLog) => watchedDay(b).localeCompare(watchedDay(a)) || b.createdAt.localeCompare(a.createdAt);
  return [...logs].sort((a, b) => sort === "recent" ? recent(a, b) : (b.rating ?? -1) - (a.rating ?? -1) || recent(a, b));
}
