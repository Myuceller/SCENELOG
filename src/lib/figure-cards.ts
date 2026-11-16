import type { TasteInsight } from "./taste-insights";

export interface FigureCard { label: string; title: string; lines: string[] }

/**
 * A short teaser of each analysis card for the figure's fanned-out row. The figure draws every line on a single
 * line, so only the headline number and the short stats go here; the full sentence lives in the opened card.
 */
export function buildFigureCards(insights: TasteInsight[]): FigureCard[] {
  return insights.map(insight => ({
    label: insight.label,
    title: insight.name,
    lines: [
      insight.big,
      ...(insight.rank ? insight.rank.liked.slice(1, 3).map((row, i) => `${i + 2}위 ${row.name}`) : insight.stats.map(([label, value]) => `${label} ${value}`)),
    ].slice(0, 4),
  }));
}
