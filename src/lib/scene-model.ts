import type { ArchiveMovie } from "./archive-movies";

export const accounts = [
  { id: "guma", name: "guma", initial: "G", color: "#e8e8e8", bio: "장면과 음악을 오래 기억하는 편." },
  { id: "gamja", name: "gamja", initial: "G", color: "#ff4b21", bio: "엔딩 크레딧까지 보고 나와요." },
  { id: "momo", name: "momo", initial: "M", color: "#d0d0d0", bio: "좋은 이야기는 두 번씩." },
] as const;
export type AccountId = (typeof accounts)[number]["id"];
export type ThemeKey = "ost" | "visual" | "story";
export type Tier = "S" | "A" | "B" | "C" | "D";
export const themes: { key: ThemeKey; label: string; english: string; color: string }[] = [
  { key: "ost", label: "OST", english: "SOUND & FEELING", color: "#e5c568" },
  { key: "visual", label: "미장센", english: "IN EVERY FRAME", color: "#bed7df" },
  { key: "story", label: "스토리", english: "BETWEEN THE LINES", color: "#deb0a3" },
];
export interface FilmLog {
  id: string; userId: AccountId; movieId: string; rating: number | null;
  watchedOn: string; review: string; themes: Partial<Record<ThemeKey, number>>;
  tier?: Tier; spoiler: boolean; createdAt: string;
}
export interface Friendship { from: AccountId; to: AccountId; accepted: boolean }
export interface Recommendation { id: string; from: AccountId; to: AccountId[]; movieId: string; note: string; score: number | null; createdAt: string }
export interface FilmGroup { id: string; name: string; members: AccountId[] }
export interface FilmComment { id: string; scope: string; movieId: string; userId: AccountId; body: string; score: number | null; spoiler: boolean; createdAt: string }
export interface SceneState {
  version: 1; userId: AccountId; catalog?: ArchiveMovie[]; logs: FilmLog[]; watchlist: { userId: AccountId; movieId: string }[];
  friends: Friendship[]; recommendations: Recommendation[]; groups: FilmGroup[]; comments: FilmComment[];
}
export const STORAGE_KEY = "scenelog.archive.v1";
export function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function newId() { return crypto.randomUUID(); }
export function ratingToTier(rating: number | null): Tier { return rating !== null && rating >= 4.5 ? "S" : rating !== null && rating >= 4 ? "A" : rating !== null && rating >= 3 ? "B" : rating !== null && rating >= 2 ? "C" : "D"; }
export function latestLogs(logs: FilmLog[], userId: AccountId): FilmLog[] {
  const map = new Map<string, FilmLog>();
  [...logs].filter(log => log.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach(log => map.set(log.movieId, log));
  return [...map.values()];
}
export function friendIds(state: SceneState): AccountId[] {
  return state.friends.filter(f => f.accepted && (f.from === state.userId || f.to === state.userId)).map(f => f.from === state.userId ? f.to : f.from);
}
export function createSeedState(): SceneState {
  const month = today().slice(0, 7);
  const rows: [AccountId, string, number, number, string, number, number, number][] = [
    ["guma", "interstellar", 4.8, 1, "시간이 지나도 첫 관람의 벅참이 그대로 남아 있다.", 5, 4.8, 4.6],
    ["guma", "perfect-days", 4.6, 2, "반복되는 하루에도 새로운 빛이 들어온다.", 4.7, 4.8, 4.3],
    ["guma", "lalaland", 4.3, 4, "마지막 연주가 시작되는 순간, 처음으로 돌아가고 싶었다.", 4.9, 4.6, 4.1],
    ["guma", "grand-budapest", 4.5, 5, "이 색과 구도는 큰 화면으로 한 번 더.", 4.2, 5, 4.4],
    ["gamja", "interstellar", 4.5, 1, "큰 화면으로 다시 보고 싶은 영화.", 4.8, 4.7, 4.3],
    ["gamja", "lalaland", 4.7, 3, "겨울이면 다시 찾게 되는 음악.", 5, 4.6, 4.5],
    ["gamja", "whiplash", 4.8, 4, "마지막 10분 동안 숨을 잊었다.", 5, 4.4, 4.8],
    ["momo", "interstellar", 4.6, 2, "다시 봐도 좋아.", 4.9, 4.5, 4.7],
    ["momo", "past-lives", 4.4, 5, "대사 사이에 머무는 마음들.", 4.1, 4.5, 4.8],
  ];
  return {
    version: 1, userId: "guma",
    logs: rows.map(([userId, movieId, rating, day, review, ost, visual, story], i) => ({ id: `seed-${i}`, userId, movieId, rating, watchedOn: `${month}-${String(day).padStart(2, "0")}`, review, themes: { ost, visual, story }, spoiler: false, createdAt: `${month}-${String(day).padStart(2, "0")}T12:00:00.000Z` })),
    watchlist: [{ userId: "guma", movieId: "whiplash" }, { userId: "guma", movieId: "past-lives" }, { userId: "gamja", movieId: "perfect-days" }],
    friends: [{ from: "guma", to: "gamja", accepted: true }],
    recommendations: [{ id: "rec-seed", from: "gamja", to: ["guma"], movieId: "whiplash", note: "음악 좋아하는 너라면. 마지막 장면은 꼭 같이 얘기하자!", score: 4.8, createdAt: `${month}-04T15:00:00.000Z` }],
    groups: [{ id: "friday", name: "금요일 시네클럽", members: ["guma", "gamja", "momo"] }],
    comments: [{ id: "comment-seed", scope: "group:friday", movieId: "interstellar", userId: "gamja", body: "다들 봤네! 극장에서 다시 볼 기회 있으면 같이 가자.", score: 4.5, spoiler: false, createdAt: `${month}-03T15:00:00.000Z` }],
  };
}
export function validState(value: unknown): value is SceneState {
  if (!value || typeof value !== "object") return false;
  const s = value as SceneState;
  return (!s.catalog || (Array.isArray(s.catalog) && s.catalog.every(m => typeof m.id === "string" && typeof m.title === "string" && typeof m.poster === "string"))) && s.version === 1 && accounts.some(a => a.id === s.userId) && [s.logs, s.watchlist, s.friends, s.recommendations, s.groups, s.comments].every(Array.isArray)
    && s.logs.every(l => typeof l.id === "string" && typeof l.movieId === "string" && typeof l.createdAt === "string" && typeof l.watchedOn === "string" && typeof l.review === "string" && !!l.themes && (l.rating === null || (Number.isFinite(l.rating) && l.rating >= 0 && l.rating <= 5)));
}
