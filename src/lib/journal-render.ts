import type { ArchiveMovie } from "./archive-movies";
import type { FilmLog } from "./scene-model";
import { PAGE_WIDTH, PAGE_HEIGHT, paperColors, coverColors, itemHeight, type FilmJournal, type JournalPage, type JournalItem } from "./journal-model";
import { loadJournalPhotos } from "./journal-assets";
import { journalFontFamily, loadJournalFonts } from "./journal-fonts";
import { loadUiFont, uiFontFamily } from "./ui-font";

export type PosterImages = Map<string, HTMLImageElement>;
const posterCache = new Map<string, Promise<HTMLImageElement>>();
export async function loadJournalPosters(movies: ArchiveMovie[], movieIds: string[]): Promise<PosterImages> {
  const { getImageProps } = await import("next/image");
  return new Map(await Promise.all([...new Set(movieIds)].map(async id => {
    const movie = movies.find(movie => movie.id === id);
    if (!movie) throw new Error("다이어리에 붙인 영화 정보를 찾지 못했어요.");
    if (!posterCache.has(movie.poster)) {
      const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image(); image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => { posterCache.delete(movie.poster); reject(new Error(`〈${movie.title}〉 포스터를 읽지 못했어요. 다시 시도해 주세요.`)); };
        image.src = getImageProps({ src: movie.poster, alt: "", width: 600, height: 900 }).props.src;
      });
      posterCache.set(movie.poster, promise);
    }
    return [id, await posterCache.get(movie.poster)!] as const;
  })));
}
export const TEXT_LINE_HEIGHT = 1.38;
const sans = uiFontFamily;
const serif = 'Georgia, "Batang", serif';
export async function loadJournalMedia(movies: ArchiveMovie[], items: JournalItem[]) {
  const movieIds = new Set(items.flatMap(item => item.movieId ? [item.movieId] : []));
  const [posters, photos] = await Promise.all([loadJournalPosters(movies, [...movieIds]), loadJournalPhotos(items), loadJournalFonts(items),
    loadUiFont("SCENELOG / MY COLLECTION 0123456789.-" + movies.filter(movie => movieIds.has(movie.id)).map(movie => movie.title).join(""))]);
  return new Map([...posters, ...photos]);
}
export function fittedTextHeight(item: JournalItem) {
  const ctx = document.createElement("canvas").getContext("2d")!;
  const size = item.fontSize ?? 25; ctx.font = `400 ${size}px ${journalFontFamily(item.font)}`;
  let rows = 1, line = "";
  for (const character of item.text ?? "") {
    if (character === "\n" || ctx.measureText(line + character).width > item.width * PAGE_WIDTH) { rows++; line = character === "\n" ? "" : character; } else line += character;
  }
  return Math.min(1, (rows * size * TEXT_LINE_HEIGHT + 4) / PAGE_HEIGHT);
}
function wrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) {
  let line = "", row = 0;
  for (const character of text) {
    if (character === "\n" || ctx.measureText(line + character).width > width) {
      ctx.fillText(line, x, y + row * lineHeight); line = character === "\n" ? "" : character;
      if (++row >= maxLines) return;
    } else line += character;
  }
  if (row < maxLines) ctx.fillText(line, x, y + row * lineHeight);
}
export function drawJournalPage(ctx: CanvasRenderingContext2D, page: JournalPage, movies: ArchiveMovie[], logs: FilmLog[], images: PosterImages, pageNumber: number) {
  const w = PAGE_WIDTH, h = PAGE_HEIGHT;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = paperColors[page.paper]; ctx.fillRect(0, 0, w, h);
  if (page.paper === "grid") {
    ctx.lineWidth = .45; ctx.strokeStyle = "#b1b5a72b";
    for (let x = 0; x < w; x += 18) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  // Fixed fine paper flecks are reproducible in the editor and in exports.
  ctx.fillStyle = "#5b493d08";
  for (let i = 0; i < 900; i++) ctx.fillRect((i * 137.7) % w, (i * 71.37) % h, .7, .7);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  for (const item of page.items) drawItem(ctx, item, movies, logs, images);
  ctx.restore();
  ctx.fillStyle = "#888073"; ctx.font = `9px ${sans}`; ctx.textAlign = "center";
  ctx.fillText(String(pageNumber).padStart(2, "0"), w / 2, h - 15); ctx.textAlign = "left";
}
function drawItem(ctx: CanvasRenderingContext2D, item: JournalItem, movies: ArchiveMovie[], logs: FilmLog[], images: PosterImages) {
  const width = item.width * PAGE_WIDTH, height = itemHeight(item) * PAGE_HEIGHT;
  const x = item.x * PAGE_WIDTH, y = item.y * PAGE_HEIGHT;
  ctx.save(); ctx.translate(x + width / 2, y + height / 2); ctx.rotate(item.rotation * Math.PI / 180); ctx.translate(-width / 2, -height / 2);
  if (item.kind === "text") {
    const size = item.fontSize ?? 25;
    ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
    ctx.fillStyle = item.color ?? "#242424"; ctx.font = `400 ${size}px ${journalFontFamily(item.font)}`;
    ctx.textAlign = item.align ?? "left";
    const lineHeight = size * TEXT_LINE_HEIGHT, metrics = ctx.measureText("가A");
    const ascent = metrics.fontBoundingBoxAscent ?? size, descent = metrics.fontBoundingBoxDescent ?? 0;
    // Match the CSS line box (half-leading above the glyphs) so the editor textarea and the canvas share one baseline.
    const baseline = (lineHeight - (ascent + descent)) / 2 + ascent;
    wrappedText(ctx, item.text ?? "", item.align === "center" ? width / 2 : item.align === "right" ? width : 0, baseline, width, lineHeight, Math.max(1, Math.ceil(height / lineHeight)));
  } else if (item.kind === "photo") {
    const image = images.get(item.assetId ?? "");
    if (image) {
      ctx.beginPath();
      if (item.cutout?.length) { item.cutout.forEach((point, index) => index ? ctx.lineTo(point.x * width, point.y * height) : ctx.moveTo(point.x * width, point.y * height)); ctx.closePath(); }
      else if (item.mask === "circle") ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      else ctx.roundRect(0, 0, width, height, item.mask === "rounded" ? Math.min(width, height) * .1 : 0);
      ctx.clip();
      const crop = item.crop ?? { x: 0, y: 0, width: 1, height: 1 };
      ctx.drawImage(image, crop.x * image.width, crop.y * image.height, crop.width * image.width, crop.height * image.height, 0, 0, width, height);
    }
  } else if (item.kind === "drawing") {
    ctx.strokeStyle = item.color ?? "#242424"; ctx.fillStyle = ctx.strokeStyle; ctx.globalAlpha = item.opacity ?? 1;
    ctx.lineWidth = item.penWidth ?? 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); (item.points ?? []).forEach((point, index) => index ? ctx.lineTo(point.x * width, point.y * height) : ctx.moveTo(point.x * width, point.y * height));
    ctx.stroke();
    if (item.points?.length === 1) { ctx.beginPath(); ctx.arc(item.points[0].x * width, item.points[0].y * height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const movie = movies.find(movie => movie.id === item.movieId), image = images.get(item.movieId ?? "");
    const log = logs.find(log => log.id === item.logId);
    // Draw on a transparent layer so the perforations are real holes, not painted dots.
    const stamp = document.createElement("canvas"); stamp.width = Math.ceil(width * 2); stamp.height = Math.ceil(height * 2);
    const s = stamp.getContext("2d")!; s.scale(2, 2); s.fillStyle = "#fffdf7"; s.fillRect(0, 0, width, height);
    s.globalCompositeOperation = "destination-out";
    for (let p = 5; p < width; p += 10) { s.beginPath(); s.arc(p, 0, 2.3, 0, Math.PI * 2); s.arc(p, height, 2.3, 0, Math.PI * 2); s.fill(); }
    for (let p = 5; p < height; p += 10) { s.beginPath(); s.arc(0, p, 2.3, 0, Math.PI * 2); s.arc(width, p, 2.3, 0, Math.PI * 2); s.fill(); }
    s.globalCompositeOperation = "source-over";
    const pad = Math.max(7, width * .055), photoH = height - pad * 2 - 24;
    if (image) {
      const crop = Math.min(image.width / (width - pad * 2), image.height / photoH);
      const sw = (width - pad * 2) * crop, sh = photoH * crop;
      s.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, pad, pad, width - pad * 2, photoH);
    } else { s.fillStyle = "#d9d8d0"; s.fillRect(pad, pad, width - pad * 2, photoH); }
    s.fillStyle = "#282824"; s.font = `650 ${Math.max(7, width * .055)}px ${sans}`;
    s.fillText(movie?.title ?? "영화 우표", pad, height - 18, width - pad * 2 - 24);
    s.font = `500 6.5px ${sans}`; s.fillStyle = "#8c887c"; s.fillText("SCENELOG / " + (log?.watchedOn || "MY COLLECTION"), pad, height - 8, width - pad * 2);
    if (log?.rating !== null && log?.rating !== undefined) { s.textAlign = "right"; s.fillStyle = "#dc4828"; s.font = `750 11px ${sans}`; s.fillText(log.rating.toFixed(1), width - pad, height - 18); }
    ctx.shadowColor = "#29241b30"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2; ctx.drawImage(stamp, 0, 0, width, height);
  }
  ctx.restore();
}
export function drawJournalCover(ctx: CanvasRenderingContext2D, book: FilmJournal, width: number, height: number) {
  ctx.fillStyle = coverColors[book.cover]; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff09"; for (let y = 0; y < height; y += 3) ctx.fillRect(0, y, width, .6);
  ctx.fillStyle = "#00000025"; ctx.fillRect(0, 0, width * .035, height);
  ctx.strokeStyle = "#ffffff40"; ctx.lineWidth = 1; ctx.strokeRect(width * .12, height * .09, width * .76, height * .82);
  ctx.fillStyle = "#fff7df"; ctx.textAlign = "center"; ctx.font = `500 ${width * .035}px ${sans}`; ctx.fillText("SCENELOG / PRIVATE JOURNAL", width / 2, height * .19);
  ctx.font = `500 ${width * .25}px ${serif}`; ctx.fillText(String(book.year), width / 2, height * .47);
  ctx.font = `550 ${width * .047}px ${sans}`; ctx.fillText(book.title, width / 2, height * .57, width * .7);
  ctx.font = `400 ${width * .028}px ${sans}`; ctx.fillText("A YEAR IN SCENES.", width / 2, height * .81); ctx.textAlign = "left";
}
