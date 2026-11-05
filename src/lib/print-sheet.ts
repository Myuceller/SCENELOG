import type { ArchiveMovie as Movie } from "@/lib/archive-movies";
import { ratingToTier, type FilmLog, type ThemeKey, type Tier } from "./scene-model";

export interface PrintItem { movie: Movie; log: FilmLog; score: number | null; tier: Tier }
export function getPrintItems(movies: Movie[], logs: FilmLog[], theme: ThemeKey | "overall", mode: "rating" | "tier"): PrintItem[] {
  const tiers: Tier[] = ["S", "A", "B", "C", "D"];
  const items = logs.flatMap(log => {
    const movie = movies.find(m => m.id === log.movieId);
    const score = theme === "overall" ? log.rating : log.themes[theme];
    return movie && ((score !== null && score !== undefined) || (mode === "tier" && log.tier)) ? [{ movie, log, score: score ?? null, tier: log.tier ?? ratingToTier(log.rating) }] : [];
  });
  return items.sort((a, b) => (mode === "tier" ? tiers.indexOf(a.tier) - tiers.indexOf(b.tier) : 0) || (b.score ?? -1) - (a.score ?? -1) || a.movie.title.localeCompare(b.movie.title));
}
export async function exportPrintSheet(items: PrintItem[], title: string, user: string, mode: "rating" | "tier") {
  await document.fonts.ready;
  const width = 1200;
  const rowHeight = 186;
  const height = 340 + items.length * rowHeight + 120;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지 저장을 지원하지 않는 브라우저예요.");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ff4b21"; ctx.fillRect(0, 0, width, 18);
  const font = '"Pretendard", Arial, sans-serif';
  ctx.fillStyle = "#161616"; ctx.font = `850 76px ${font}`; ctx.fillText("SceneLog.", 76, 130);
  ctx.font = `500 20px ${font}`; ctx.textAlign = "right"; ctx.fillText("PERSONAL FILM ARCHIVE", width - 76, 108); ctx.textAlign = "left";
  ctx.font = `700 42px ${font}`; ctx.fillText(title.slice(0, 36), 76, 214, width - 152);
  ctx.font = `400 22px ${font}`; ctx.fillStyle = "#707070"; ctx.fillText(`${user.toUpperCase()} / ${items.length} FILMS / ${mode === "tier" ? "TIER EDITION" : "RATING EDITION"}`, 76, 262);
  ctx.strokeStyle = "#161616"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(76, 292); ctx.lineTo(width - 76, 292); ctx.stroke();
  for (const [index, item] of items.entries()) {
    const y = 320 + index * rowHeight;
    ctx.fillStyle = mode === "tier" && item.tier === "S" ? "#ff4b21" : "#161616";
    ctx.font = `750 38px ${font}`; ctx.fillText(mode === "tier" ? item.tier : String(index + 1).padStart(2, "0"), 76, y + 81);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("포스터를 읽지 못했어요. 다시 시도해 주세요.")); image.crossOrigin = "anonymous"; image.src = item.movie.poster; });
    const cropWidth = Math.min(img.width, img.height * 2 / 3);
    const cropHeight = cropWidth * 3 / 2;
    ctx.drawImage(img, (img.width - cropWidth) / 2, (img.height - cropHeight) / 2, cropWidth, cropHeight, 170, y, 100, 150);
    ctx.fillStyle = "#161616"; ctx.font = `700 30px ${font}`;
    ctx.fillText(item.movie.title, 310, y + 50, 585);
    ctx.fillStyle = "#777"; ctx.font = `400 20px ${font}`; ctx.fillText(`${item.movie.year ?? "개봉일 미정"} · ${item.movie.director ?? item.movie.genres.join(" / ")}`, 310, y + 86, 585);
    ctx.fillText(item.log.watchedOn || "관람일 미정", 310, y + 119);
    ctx.fillStyle = "#d9360d"; ctx.font = `750 50px ${font}`; ctx.textAlign = "right"; ctx.fillText(item.score?.toFixed(1) ?? "—", width - 76, y + 72); ctx.textAlign = "left";
    ctx.strokeStyle = "#ddd"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(76, y + 168); ctx.lineTo(width - 76, y + 168); ctx.stroke();
  }
  const footerY = height - 63;
  ctx.fillStyle = "#161616"; ctx.font = `500 19px ${font}`; ctx.fillText("COLLECT SCENES. KEEP YOUR POINT OF VIEW.", 76, footerY);
  for (let i = 0; i < 48; i++) ctx.fillRect(width - 228 + i * 3, footerY - 25, i % 3 === 0 ? 2 : 1, 28);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("이미지를 만들지 못했어요.")), "image/png"));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `SceneLog-${user}-${mode}.png`; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
