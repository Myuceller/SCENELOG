import type { FilmLog, AccountId } from "./scene-model";
import { newId } from "./id";

export type JournalPaper = "ivory" | "grid" | "white";
export type JournalCover = "ink" | "orange" | "blue";
export type JournalFont = "sans" | "serif" | "gowun" | "gaegu" | "pen" | "jua";
export type CropRect = { x: number; y: number; width: number; height: number };
export interface JournalItem {
  id: string; kind: "stamp" | "text" | "photo" | "drawing"; x: number; y: number; width: number; rotation: number;
  movieId?: string; logId?: string; text?: string; font?: JournalFont; fontSize?: number; color?: string;
  height?: number; align?: "left" | "center" | "right"; z?: number;
  assetId?: string; crop?: CropRect; mask?: "rect" | "rounded" | "circle"; cutout?: { x: number; y: number }[];
  points?: { x: number; y: number }[]; penWidth?: number; opacity?: number;
}
export interface JournalPage { id: string; paper: JournalPaper; items: JournalItem[] }
export interface FilmJournal { year: number; title: string; cover: JournalCover; pages: JournalPage[]; updatedAt: string }
export const PAGE_WIDTH = 450;
export const PAGE_HEIGHT = 600;
export const coverColors: Record<JournalCover, string> = { ink: "#292b29", orange: "#e84b29", blue: "#344463" };
export const paperColors: Record<JournalPaper, string> = { ivory: "#f1ecdf", grid: "#f5f2e9", white: "#faf9f5" };

export function createJournal(year: number, id: () => string = newId): FilmJournal {
  return { year, title: "나의 영화 다이어리", cover: "ink", pages: Array.from({ length: 4 }, () => ({ id: id(), paper: "ivory", items: [] })), updatedAt: new Date().toISOString() };
}
export function journalStampLogs(logs: FilmLog[], user: AccountId, year?: number) {
  const latest = new Map<string, FilmLog>();
  logs.filter(log => log.userId === user && (year === undefined || log.watchedOn.startsWith(`${year}-`)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach(log => latest.set(log.movieId, log));
  return [...latest.values()].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
}
export function itemHeight(item: JournalItem) {
  return item.kind === "stamp" ? item.width * PAGE_WIDTH * 1.63 / PAGE_HEIGHT : item.height ?? .29;
}
export function moveJournalItem(item: JournalItem, x: number, y: number): JournalItem {
  return { ...item, x: Math.max(0, Math.min(1 - item.width, x)), y: Math.max(0, Math.min(1 - itemHeight(item), y)) };
}
export function addJournalItem(book: FilmJournal, pageId: string, item: JournalItem) {
  return { ...book, pages: book.pages.map(page => page.id === pageId ? { ...page, items: [...page.items, moveJournalItem(item, item.x, item.y)] } : page) };
}
export function updateJournalItem(book: FilmJournal, pageId: string, itemId: string, patch: Partial<JournalItem>) {
  return { ...book, pages: book.pages.map(page => page.id === pageId ? { ...page, items: page.items.map(item => item.id === itemId ? { ...item, ...patch } : item) } : page) };
}
/** Coordinates use one page as the unit. An item can straddle the spine. */
export function spreadItems(book: FilmJournal, start: number) {
  return book.pages.slice(start, start + 2).flatMap((page, side) => page.items.map(item => ({ ...item, x: item.x + side }))).sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
}
export function placeOnSpread(book: FilmJournal, start: number, item: JournalItem) {
  const moved = { ...item, x: Math.max(0, Math.min(2 - item.width, item.x)), y: Math.max(0, Math.min(1 - itemHeight(item), item.y)) };
  const side = moved.x + moved.width / 2 >= 1 && book.pages[start + 1] ? 1 : 0;
  return { ...book, pages: book.pages.map((page, index) => {
    const items = page.items.filter(existing => existing.id !== moved.id);
    return { ...page, items: index === start + side ? [...items, { ...moved, x: moved.x - side }] : items };
  }) };
}
export function itemsForPage(book: FilmJournal, index: number) {
  const start = Math.floor(index / 2) * 2;
  return spreadItems(book, start).map(item => ({ ...item, x: item.x - (index - start) }));
}
export function exportPages(book: FilmJournal, skipEmpty = true) {
  // Preserve the two-page composition, including an intentionally empty facing page.
  const pages: JournalPage[] = [];
  for (let i = 0; i < book.pages.length; i += 2) {
    const pair = book.pages.slice(i, i + 2);
    if (!skipEmpty || pair.some(page => page.items.length)) pages.push(...pair);
  }
  return pages;
}
export function isFilmJournal(value: unknown): value is FilmJournal {
  if (!value || typeof value !== "object") return false;
  const book = value as FilmJournal;
  return Number.isInteger(book.year) && typeof book.title === "string" && ["ink", "orange", "blue"].includes(book.cover)
    && Array.isArray(book.pages) && book.pages.length >= 2 && book.pages.every(page => typeof page.id === "string" && ["ivory", "grid", "white"].includes(page.paper)
      && Array.isArray(page.items) && page.items.every(item => typeof item.id === "string" && ["stamp", "text", "photo", "drawing"].includes(item.kind)
        && [item.x, item.y, item.width, item.rotation].every(Number.isFinite) && item.width > 0 && item.width <= 2
        && (item.height === undefined || Number.isFinite(item.height) && item.height > 0 && item.height <= 1)
        && (item.kind === "stamp" ? typeof item.movieId === "string" : item.kind === "text" ? typeof item.text === "string" : item.kind === "photo" ? typeof item.assetId === "string" : Array.isArray(item.points) && item.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)))));
}
