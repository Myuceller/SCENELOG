import { avatarOrnament, type AvatarOrnament } from "./avatar-ornaments";
/** Shared, small catalogue. Conditions are evaluated from saved records on the server. */
export const DEFAULT_TITLE = "first-seat";
type Metric = "member" | "movies" | "reviews" | "days" | "detailed" | "genres" | "rewatches" | "genre" | "months" | "monthStreak";
export type AvatarEffect = "ticket" | "laugh" | "ghost" | "stars" | "bolt" | "heart" | "flower" | "pen" | "calendar" | "sparkle" | "replay" | "gold";
interface Definition {
  id: string; title: string; description: string; condition: string; category: "시작" | "누적 관람" | "취향" | "기록" | "꾸준함";
  ornament?: AvatarOrnament; metric: Metric; target: number; genre?: string; effect: AvatarEffect; mark: string; color: string;
}
const originalAchievements = [
  { id: "first-seat", title: "첫 줄의 관객", description: "당신의 영화 이야기가 시작되는 자리.", condition: "SceneLog 가입", category: "시작", metric: "member", target: 1, effect: "ticket", mark: "✦", color: "#d96736" },
  { id: "first-scene", title: "첫 장면의 주인공", description: "처음 남긴 한 편, 오래 기억할 한 장면.", condition: "첫 영화 시청 기록", category: "시작", metric: "movies", target: 1, effect: "sparkle", mark: "★", color: "#bb8426" },
  { id: "small-cinema", title: "작은 영화관의 주인", description: "서른 편의 장면으로 채운 나만의 상영관.", condition: "서로 다른 영화 30편 시청 기록", category: "기록", metric: "movies", target: 30, effect: "ticket", mark: "30", color: "#b9653f" },
  { id: "hundred-scenes", title: "백 가지 장면", description: "백 편의 영화가 쌓여 당신의 취향이 되었어요.", condition: "서로 다른 영화 100편 시청 기록", category: "기록", metric: "movies", target: 100, effect: "stars", mark: "100", color: "#936fba" },
  { id: "comedy-10", title: "웃음 수집가", description: "웃음이 터지는 순간을 놓치지 않는 사람.", condition: "코미디 영화 10편 시청 기록", category: "취향", metric: "genre", genre: "코미디", target: 10, effect: "laugh", mark: "ㅋㅋ", color: "#ba7723" },
  { id: "comedy-30", title: "코미디 감별사", description: "웃음의 타이밍까지 알아보는 당신에게.", condition: "코미디 영화 30편 시청 기록", category: "취향", metric: "genre", genre: "코미디", target: 30, effect: "laugh", mark: "하하", color: "#c35b32" },
  { id: "horror-10", title: "불 꺼도 괜찮아", description: "무서운 장면 너머의 이야기를 찾아서.", condition: "공포 영화 10편 시청 기록", category: "취향", metric: "genre", genre: "공포", target: 10, effect: "ghost", mark: "유령", color: "#7b68a0" },
  { id: "sf-10", title: "다른 세계의 여행자", description: "스크린 한 장으로 우주 끝까지 다녀왔어요.", condition: "SF 영화 10편 시청 기록", category: "취향", metric: "genre", genre: "SF", target: 10, effect: "stars", mark: "✦", color: "#637ac5" },
  { id: "action-10", title: "심박수 높은 관객", description: "박진감 넘치는 장면 앞에서는 눈도 깜빡이지 않죠.", condition: "액션 영화 10편 시청 기록", category: "취향", metric: "genre", genre: "액션", target: 10, effect: "bolt", mark: "ϟ", color: "#c05e45" },
  { id: "romance-10", title: "설렘 보관함", description: "영화 속 마음들을 차곡차곡 모아두는 사람.", condition: "로맨스 영화 10편 시청 기록", category: "취향", metric: "genre", genre: "로맨스", target: 10, effect: "heart", mark: "♡", color: "#bb6385" },
  { id: "animation-10", title: "상상의 단골손님", description: "그려진 세계에서도 진짜 마음을 발견해요.", condition: "애니메이션 영화 10편 시청 기록", category: "취향", metric: "genre", genre: "애니메이션", target: 10, effect: "flower", mark: "✿", color: "#538a74" },
  { id: "genre-explorer", title: "취향의 탐험가", description: "익숙한 장르 밖에서도 새로운 장면을 만나요.", condition: "5개 장르에서 각각 3편 이상 시청 기록", category: "취향", metric: "genres", target: 5, effect: "stars", mark: "✧", color: "#568e94" },
  { id: "reviews-10", title: "엔딩 뒤의 문장", description: "영화가 끝나면 당신의 이야기가 시작돼요.", condition: "서로 다른 영화 10편에 감상 작성", category: "기록", metric: "reviews", target: 10, effect: "pen", mark: "✎", color: "#717fa3" },
  { id: "calendar-10", title: "달력 속 영화관", description: "평범했던 날짜에 영화 한 편의 기억을.", condition: "서로 다른 관람일 10일에 시청 기록", category: "기록", metric: "days", target: 10, effect: "calendar", mark: "10", color: "#578b72" },
  { id: "calendar-30", title: "장면으로 채운 달력", description: "달력을 펼치면 그날의 영화가 떠올라요.", condition: "서로 다른 관람일 30일에 시청 기록", category: "기록", metric: "days", target: 30, effect: "calendar", mark: "30", color: "#518f8e" },
  { id: "details-10", title: "장면을 읽는 눈", description: "음악, 화면, 이야기까지 세심하게 바라봐요.", condition: "10편에 OST·미장센·스토리 모두 평가", category: "기록", metric: "detailed", target: 10, effect: "sparkle", mark: "✧", color: "#9c7956" },
  { id: "rewatch-3", title: "다시 만난 장면", description: "같은 영화에서도 매번 다른 마음을 발견하죠.", condition: "같은 영화를 서로 다른 관람일에 3회 기록", category: "기록", metric: "rewatches", target: 3, effect: "replay", mark: "↻", color: "#8b739c" },
] as const satisfies readonly Definition[];
// Keep published IDs stable so existing unlocks and equipped avatars survive catalogue updates.
const movieMilestones = [
  [3, "세 편의 취향"], [5, "주말의 작은 상영회"], [10, "열 장의 티켓"], [12, "열두 편의 계절"],
  [20, "스크린과 친해지는 중"], [50, "오십 가지 여운"], [75, "취향이 깊어지는 시간"],
  [200, "이백 번의 엔딩"], [300, "삼백 편의 세계"], [400, "장면의 도서관"], [500, "오백 편의 필름"],
  [600, "스크린의 항해사"], [700, "이야기의 수호자"], [800, "필름의 연대기"], [900, "천 편을 향한 여정"],
  [1000, "황금 필름의 주인"], [1500, "황금빛 시네마"], [2000, "황금 스크린의 전설"],
] as const;
const movieTitles: Definition[] = movieMilestones.map(([target, title]) => ({
  id: `movies-${target}`, title, target, metric: "movies", category: target <= 5 ? "시작" : "누적 관람",
  condition: `서로 다른 영화 ${target.toLocaleString("ko-KR")}편 시청 기록`,
  description: target >= 1000 ? "오랜 시간 쌓아온 당신의 영화 사랑에 황금빛을 더해요." : "빠르게 채우지 않아도 괜찮아요. 한 편씩 쌓인 장면은 모두 당신의 것이니까요.",
  effect: target >= 1000 ? "gold" : "stars", mark: target >= 1000 ? `${target / 1000}K` : String(target),
  color: target >= 1000 ? "#b68216" : target >= 100 ? "#8870aa" : "#b47745",
}));
const genreFamilies = [
  ["comedy", "코미디", "laugh", "ㅋㅋ", "#ba7723", "웃음"],
  ["horror", "공포", "ghost", "유령", "#7b68a0", "오싹함"],
  ["sf", "SF", "stars", "✦", "#637ac5", "우주"],
  ["action", "액션", "bolt", "ϟ", "#c05e45", "스릴 넘치는 장면"],
  ["romance", "로맨스", "heart", "♡", "#bb6385", "설렘"],
  ["animation", "애니메이션", "flower", "✿", "#538a74", "상상"],
  ["drama", "드라마", "pen", "✎", "#9c7956", "삶의 이야기"],
  ["thriller", "스릴러", "bolt", "!", "#826c88", "긴장"],
  ["mystery", "미스터리", "sparkle", "?", "#657c91", "수수께끼"],
  ["crime", "범죄", "ticket", "◇", "#746d82", "사건"],
  ["adventure", "모험", "stars", "✧", "#688c65", "모험"],
  ["fantasy", "판타지", "stars", "✦", "#9771b1", "마법"],
  ["documentary", "다큐멘터리", "pen", "✎", "#638a83", "진짜 세상"],
  ["family", "가족", "heart", "♡", "#b98253", "따뜻함"],
] as const;
const genreTitles: Definition[] = genreFamilies.flatMap(([key, genre, effect, mark, color, theme]) =>
  ([1, 3, 5, 10, 30, 50, 100] as const).map((target, index) => ({
    id: `${key}-${target}`, title: [`${theme}의 첫 장면`, `${theme}과 친해지는 중`, `${theme}의 단골 관객`, `${theme} 수집가`, `${theme} 감별사`, `${theme}의 명인`, `${theme}의 거장`][index],
    description: `${genre} 영화 속 ${theme}, 한 편씩 알아가는 즐거움을 모아요.`,
    condition: `${genre} 영화 ${target}편 시청 기록`, category: "취향", metric: "genre", genre, target, effect, mark, color,
  })));
function recordSeries(metric: Metric, prefix: string, effect: AvatarEffect, color: string, mark: string,
  entries: readonly (readonly [number, string])[], condition: (n: number) => string): Definition[] {
  return entries.map(([target, title]) => ({ id: `${prefix}-${target}`, title, target, metric, effect, color, mark,
    category: metric === "months" || metric === "monthStreak" ? "꾸준함" : "기록", condition: condition(target),
    description: metric === "monthStreak" ? "하루에 한 편 대신, 한 달에 한 번. 당신만의 속도로 영화를 만나요." : "작은 기록도 모이면 소중한 영화 생활의 흔적이 돼요.",
  }));
}
const extraRecords: Definition[] = [
  ...recordSeries("reviews", "reviews", "pen", "#717fa3", "✎", [[1,"첫 감상의 한 줄"],[3,"세 편의 뒷이야기"],[5,"여운을 적는 사람"],[20,"감상 노트"],[30,"엔딩 크레딧의 작가"],[50,"쉰 편의 문장"],[100,"백 편의 영화 에세이"],[200,"나만의 영화 평론집"]], n => `서로 다른 영화 ${n}편에 감상 작성`),
  ...recordSeries("days", "calendar", "calendar", "#578b72", "▦", [[1,"달력의 첫 장면"],[3,"영화가 있던 세 날"],[5,"다섯 날의 기억"],[50,"장면으로 잇는 날짜"],[100,"백 일의 영화 기억"]], n => `서로 다른 관람일 ${n}일에 시청 기록`),
  ...recordSeries("detailed", "details", "sparkle", "#9c7956", "✧", [[1,"세 가지 시선"],[3,"장면을 찬찬히"],[5,"디테일 수집가"],[30,"스크린의 관찰자"],[50,"장면의 해설가"]], n => `${n}편에 OST·미장센·스토리 모두 평가`),
  ...recordSeries("rewatches", "rewatch", "replay", "#8b739c", "↻", [[2,"한 번 더 만나고 싶어서"],[5,"나의 인생 영화"],[10,"언제나 같은 자리"]], n => `같은 영화를 서로 다른 관람일에 ${n}회 기록`),
  ...recordSeries("months", "months", "calendar", "#5d8b83", "月", [[1,"영화가 있던 달"],[3,"세 달의 영화 편지"],[6,"여섯 달의 취향"],[12,"열두 달의 영화 생활"],[24,"스물네 달의 장면"],[36,"서른여섯 달의 필름"],[60,"오래된 영화 습관"]], n => `서로 다른 ${n}개 달에 한 편 이상 시청 기록 (연속이 아니어도 돼요)`),
  ...recordSeries("monthStreak", "monthly-streak", "calendar", "#b7874c", "月", [[3,"매달 만나는 영화"],[6,"반년의 영화 약속"],[12,"일 년의 영화 약속"],[24,"두 해의 영화 동행"]], n => `${n}개월 연속, 매달 한 편 이상 시청 기록`),
];
const originalIds = new Set<string>(originalAchievements.map(item => item.id));
export const achievements: readonly Definition[] = [
  ...originalAchievements.map(item => ({ ...item, category: item.metric === "movies" && item.target >= 10 ? "누적 관람" as const : item.category })),
  ...[...movieTitles, ...genreTitles, ...extraRecords].filter(item => !originalIds.has(item.id)),
].map(item => ({ ...item,
  title: ({ "horror-1": "문틈으로 보는 관객", "horror-3": "자정의 초대장", "horror-5": "촛불 하나의 용기", "horror-30": "공포의 생존자", "horror-50": "심야의 지배자", "horror-100": "악몽의 군주" } as Record<string, string>)[item.id] ?? item.title,
  ornament: avatarOrnament(item) })).sort((a: Definition, b: Definition) => {
  const order = ["시작", "누적 관람", "취향", "기록", "꾸준함"];
  return order.indexOf(a.category) - order.indexOf(b.category) || a.metric.localeCompare(b.metric) || (a.genre ?? "").localeCompare(b.genre ?? "") || a.target - b.target;
});
// Fingerprint the definitions, not a hand-maintained count. Old open tabs must not mix catalogues.
export const achievementCatalogVersion = (() => {
  const source = JSON.stringify([...achievements].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return `titles-${(hash >>> 0).toString(16)}`;
})();
export function summarizeAchievements(collection: AchievementCollection) {
  const ids = new Set(achievements.map(item => item.id));
  const entries = [...new Map(collection.achievements.filter(item => ids.has(item.id)).map(item => [item.id, item])).values()];
  return { unlocked: entries.filter(item => item.unlockedAt).length, total: entries.length };
}
export type AchievementId = string;
export type AchievementDefinition = Definition;
const definitions = new Map(achievements.map(item => [item.id, item]));
export function findAchievement(id?: string | null): AchievementDefinition {
  return definitions.get(id ?? DEFAULT_TITLE) ?? definitions.get(DEFAULT_TITLE)!;
}
export function isAchievementId(id: unknown): id is AchievementId {
  return typeof id === "string" && definitions.has(id);
}
/** Keep a nonzero rare title distinct from 0%, and never round partial ownership up to 100%. */
export function formatOwnershipPercent(holders: number, members: number): string {
  if (members <= 0 || holders <= 0) return "0%";
  if (holders >= members) return "100%";
  const percent = holders / members * 100;
  if (percent < 0.1) return "0.1% 미만";
  return `${Math.min(99.9, Math.round(percent * 10) / 10).toLocaleString("ko-KR")}%`;
}
export interface AchievementFact { movieId: string; watchedOn: string; reviewed: boolean; detailed: boolean; genres: string[] }
export interface AchievementProgress { id: AchievementId; current: number; target: number; unlockedAt: string | null; holderCount: number }
export interface AchievementCollection { catalogVersion: string; equippedTitle: AchievementId; achievements: AchievementProgress[]; population: { totalMembers: number; calculatedAt: string } }

export function evaluateAchievements(facts: AchievementFact[], date: string): Omit<AchievementProgress, "unlockedAt" | "holderCount">[] {
  const movies = new Set<string>(), reviews = new Set<string>(), detailed = new Set<string>(), days = new Set<string>();
  const months = new Set<number>();
  const genres = new Map<string, Set<string>>(), rewatches = new Map<string, Set<string>>();
  for (const fact of facts) {
    if (fact.watchedOn && fact.watchedOn > date) continue;
    movies.add(fact.movieId);
    if (fact.reviewed) reviews.add(fact.movieId);
    if (fact.detailed) detailed.add(fact.movieId);
    if (fact.watchedOn) {
      days.add(fact.watchedOn);
      months.add(Number(fact.watchedOn.slice(0, 4)) * 12 + Number(fact.watchedOn.slice(5, 7)) - 1);
      const dates = rewatches.get(fact.movieId) ?? new Set<string>(); dates.add(fact.watchedOn); rewatches.set(fact.movieId, dates);
    }
    for (const genre of fact.genres) {
      const titles = genres.get(genre) ?? new Set<string>(); titles.add(fact.movieId); genres.set(genre, titles);
    }
  }
  // Longest completed run, not a countdown: missing a month never removes an earned title.
  let monthStreak = 0, run = 0, previous = -Infinity;
  for (const month of [...months].sort((a, b) => a - b)) {
    run = month === previous + 1 ? run + 1 : 1;
    monthStreak = Math.max(monthStreak, run); previous = month;
  }
  const counts = { member: 1, months: months.size, monthStreak, movies: movies.size, reviews: reviews.size, detailed: detailed.size, days: days.size,
    genres: [...genres.values()].filter(titles => titles.size >= 3).length,
    rewatches: Math.max(0, ...[...rewatches.values()].map(dates => dates.size)) };
  return achievements.map(item => ({ id: item.id, target: item.target,
    current: item.metric === "genre" ? genres.get(item.genre ?? "")?.size ?? 0 : counts[item.metric] }));
}
