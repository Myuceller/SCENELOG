/** Lightweight decoration metadata; icons are rendered separately in the avatar component. */
const genreSymbols = {
  "공포": ["Eye", "Moon", "Flame", "Ghost", "Skull", "Crown"],
  "코미디": ["Smile", "Drama", "PartyPopper", "Laugh", "Sparkles", "Crown"],
  "SF": ["Star", "Telescope", "Rocket", "Orbit", "Atom", "Crown"],
  "액션": ["Zap", "Flame", "Swords", "Shield", "Trophy", "Crown"],
  "로맨스": ["Flower2", "Heart", "Feather", "HeartHandshake", "Gem", "Crown"],
  "애니메이션": ["Palette", "Flower2", "WandSparkles", "Sparkles", "Star", "Crown"],
  "드라마": ["Feather", "BookOpen", "Heart", "Clapperboard", "Trophy", "Crown"],
  "스릴러": ["Eye", "Search", "Zap", "Fingerprint", "Skull", "Crown"],
  "미스터리": ["Search", "KeyRound", "Eye", "Fingerprint", "Gem", "Crown"],
  "범죄": ["Search", "Fingerprint", "KeyRound", "Shield", "Swords", "Crown"],
  "모험": ["Compass", "Map", "Mountain", "Globe", "Trophy", "Crown"],
  "판타지": ["Star", "WandSparkles", "Moon", "Gem", "Sparkles", "Crown"],
  "다큐멘터리": ["Eye", "Camera", "Mic", "Globe", "BookOpen", "Crown"],
  "가족": ["House", "Flower2", "Armchair", "HeartHandshake", "Heart", "Crown"],
} as const;
const recordSymbols = ["Feather", "PenLine", "BookOpen", "Clapperboard", "Trophy", "Crown"] as const;
export type AvatarSymbol = (typeof genreSymbols)[keyof typeof genreSymbols][number] | typeof recordSymbols[number] | "Ticket" | "Film" | "CalendarDays" | "RotateCcw";
export type AvatarFrame = "simple" | "dashed" | "diamond" | "double" | "laurel" | "royal";
export type AvatarMetal = "bronze" | "silver" | "gold";
export interface AvatarOrnament { metal?: AvatarMetal; level: number; label: string; frame: AvatarFrame; symbol?: AvatarSymbol; echo?: AvatarSymbol; color: string }
const frames: AvatarFrame[] = ["simple", "dashed", "diamond", "double", "laurel", "royal"];
const labels = ["첫 만남", "발견", "애호가", "숙련자", "달인", "거장"];
function shade(hex: string, level: number) {
  const amount = [0.18, 0.08, 0, -0.1, -0.23, -0.36][level];
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  return `#${channels.map(value => Math.round(amount > 0 ? value + (255 - value) * amount : value * (1 + amount)).toString(16).padStart(2, "0")).join("")}`;
}
export function avatarOrnament(item: { metric: string; target: number; genre?: string; effect: string; color: string }): AvatarOrnament {
  const thresholds = item.metric === "genre" ? [1, 3, 5, 10, 30, 100]
    : item.metric === "movies" ? [1, 10, 30, 100, 300, 1000]
    : item.metric === "months" || item.metric === "monthStreak" ? [1, 3, 6, 12, 24, 60]
    : item.metric === "rewatches" ? [1, 2, 3, 5, 10, 20] : [1, 3, 5, 10, 30, 100];
  const index = Math.max(0, thresholds.findLastIndex(target => item.target >= target));
  const family = genreSymbols[item.genre as keyof typeof genreSymbols];
  let symbol: AvatarSymbol | undefined;
  if (family) symbol = family[index];
  else if (item.metric === "reviews" || item.metric === "detailed") symbol = recordSymbols[index];
  const metal: AvatarMetal | undefined = item.effect === "gold" ? "gold"
    : item.metric !== "genre" || item.target < 10 ? undefined
    : item.target >= 100 ? "gold" : item.target >= 50 ? "silver" : "bronze";
  const metalColors = { bronze: "#ad6d3b", silver: "#7b8c9d", gold: "#b68216" };
  const metalLabels = { bronze: "브론즈", silver: "실버", gold: "골드" };
  // A gold crown frames the genre's own symbol instead of replacing every genre with a crown.
  if (family && metal === "gold") symbol = family[3];
  // Numeric movie milestones and calendar badges retain their own counts.
  return { metal, level: index + 1, label: metal ? `${metalLabels[metal]} · ${item.target === 50 ? "명인" : labels[index]}` : labels[index], frame: frames[index], symbol,
    echo: family ? family[index >= 4 ? 3 : 0] : undefined,
    color: metal ? metalColors[metal] : shade(item.color, index) };
}
