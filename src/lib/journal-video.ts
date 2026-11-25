import type { ArchiveMovie } from "./archive-movies";
import type { FilmLog } from "./scene-model";
import { exportPages, itemsForPage, PAGE_HEIGHT, PAGE_WIDTH, type FilmJournal } from "./journal-model";
import { drawJournalCover, drawJournalPage, loadJournalMedia } from "./journal-render";
import { loadUiFont, uiFontFamily } from "./ui-font";

export type JournalVideoRatio = "square" | "vertical";
export async function makeJournalVideo(book: FilmJournal, movies: ArchiveMovie[], logs: FilmLog[], ratio: JournalVideoRatio, signal: AbortSignal, onProgress: (percent: number) => void) {
  const { Output, BufferTarget, Mp4OutputFormat, CanvasSource, Quality, canEncodeVideo } = await import("mediabunny");
  const width = 1080, height = ratio === "vertical" ? 1920 : 1080, fps = 30;
  if (!await canEncodeVideo("avc", { width, height, frameRate: fps })) throw new Error("이 브라우저에서는 MP4 영상을 만들 수 없어요. 최신 Chrome 또는 Edge에서 다이어리를 열어주세요.");
  const pages = exportPages(book);
  if (!pages.length) throw new Error("우표나 문장을 먼저 한 개 붙여주세요.");
  await Promise.all([document.fonts.ready, loadUiFont(book.title + "SCENELOG / PRIVATE JOURNAL A YEAR IN SCENES. 0123456789")]);
  const images = await loadJournalMedia(movies, pages.flatMap(page => page.items));
  const makeCanvas = () => { const canvas = document.createElement("canvas"); canvas.width = PAGE_WIDTH * 2; canvas.height = PAGE_HEIGHT * 2; return canvas; };
  const sheets = pages.map(page => {
    const canvas = makeCanvas(), ctx = canvas.getContext("2d")!; ctx.scale(2, 2);
    const index = book.pages.findIndex(item => item.id === page.id);
    drawJournalPage(ctx, { ...page, items: itemsForPage(book, index) }, movies, logs, images, index + 1); return canvas;
  });
  if (sheets.length % 2) { const blank = makeCanvas(); const ctx = blank.getContext("2d")!; ctx.fillStyle = "#f1ecdf"; ctx.fillRect(0, 0, blank.width, blank.height); sheets.push(blank); }
  const cover = makeCanvas(); drawJournalCover(cover.getContext("2d")!, book, cover.width, cover.height);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: "avc", quality: new Quality({ bitrate: 6_000_000 }), keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: fps });
  const spreads = sheets.length / 2, coverHold = 1.2, opening = .9, hold = 2.2, turning = .85;
  const duration = coverHold + opening + spreads * hold + Math.max(0, spreads - 1) * turning + .4;
  const frames = Math.ceil(duration * fps);
  try {
    await output.start();
    for (let frame = 0; frame < frames; frame++) {
      if (signal.aborted) throw new DOMException("영상 만들기를 취소했어요.", "AbortError");
      const time = frame / fps;
      ctx.fillStyle = "#303544"; ctx.fillRect(0, 0, width, height);
      ctx.textAlign = "center"; ctx.fillStyle = "#eee9df"; ctx.font = `500 20px ${uiFontFamily}`;
      ctx.fillText("SCENELOG / MY FILM JOURNAL", width / 2, height * .12);
      ctx.font = '500 64px Georgia, serif'; ctx.fillText(String(book.year), width / 2, height * .2);
      ctx.font = `400 22px ${uiFontFamily}`; ctx.fillStyle = "#c9c9ce"; ctx.fillText(book.title, width / 2, height * .87, width * .8);
      ctx.font = `400 14px ${uiFontFamily}`; ctx.fillText("COLLECT SCENES. KEEP YOUR POINT OF VIEW.", width / 2, height * .91);
      const bookWidth = width * .88, pageWidth = bookWidth / 2, bookHeight = pageWidth * PAGE_HEIGHT / PAGE_WIDTH;
      const x = (width - bookWidth) / 2, y = height * .53 - bookHeight / 2;
      ctx.textAlign = "left";
      if (time < coverHold) {
        ctx.save(); ctx.shadowColor = "#0008"; ctx.shadowBlur = 35; ctx.shadowOffsetY = 20;
        ctx.drawImage(cover, width / 2 - pageWidth / 2, y, pageWidth, bookHeight); ctx.restore();
      } else if (time < coverHold + opening) {
        const p = (time - coverHold) / opening;
        drawSpread(ctx, sheets[0], sheets[1], x, y, pageWidth, bookHeight);
        flipLeaf(ctx, cover, sheets[0], x + pageWidth, y, pageWidth, bookHeight, p);
      } else {
        const elapsed = time - coverHold - opening;
        const spread = Math.min(spreads - 1, Math.floor(elapsed / (hold + turning)));
        const within = elapsed - spread * (hold + turning);
        if (within > hold && spread < spreads - 1) {
          drawSpread(ctx, sheets[spread * 2], sheets[(spread + 1) * 2 + 1], x, y, pageWidth, bookHeight);
          flipLeaf(ctx, sheets[spread * 2 + 1], sheets[(spread + 1) * 2], x + pageWidth, y, pageWidth, bookHeight, (within - hold) / turning);
        } else drawSpread(ctx, sheets[spread * 2], sheets[spread * 2 + 1], x, y, pageWidth, bookHeight);
      }
      await source.add(frame / fps, 1 / fps);
      if (frame % 12 === 0) { onProgress(Math.round(frame / frames * 96)); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); }
    }
    source.close(); await output.finalize();
    if (signal.aborted) throw new DOMException("영상 만들기를 취소했어요.", "AbortError");
    onProgress(100);
    return new Blob([output.target.buffer!], { type: "video/mp4" });
  } catch (error) {
    if (output.state !== "finalized" && output.state !== "canceled") await output.cancel();
    throw error;
  }
}
function drawSpread(ctx: CanvasRenderingContext2D, left: HTMLCanvasElement, right: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  ctx.save(); ctx.shadowColor = "#0006"; ctx.shadowBlur = 25; ctx.shadowOffsetY = 18; ctx.fillStyle = "#d8d1c0"; ctx.fillRect(x - 3, y + 3, w * 2 + 6, h + 6); ctx.restore();
  ctx.drawImage(left, x, y, w, h); ctx.drawImage(right, x + w, y, w, h);
  const fold = ctx.createLinearGradient(x + w - 16, 0, x + w + 16, 0);
  fold.addColorStop(0, "#0000"); fold.addColorStop(.5, "#0003"); fold.addColorStop(1, "#0000");
  ctx.fillStyle = fold; ctx.fillRect(x + w - 16, y, 32, h);
}
function flipLeaf(ctx: CanvasRenderingContext2D, front: HTMLCanvasElement, back: HTMLCanvasElement, spineX: number, y: number, w: number, h: number, progress: number) {
  const eased = .5 - Math.cos(Math.PI * Math.min(1, Math.max(0, progress))) / 2;
  const angle = eased * Math.PI, cosine = Math.cos(angle), sine = Math.sin(angle);
  const texture = cosine >= 0 ? front : back;
  const strips = 72;
  for (let strip = 0; strip < strips; strip++) {
    const u = strip / strips, next = (strip + 1) / strips;
    const dx = spineX + u * w * cosine, nx = spineX + next * w * cosine;
    const curl = Math.sin(u * Math.PI) * sine * 28;
    const sx = (cosine >= 0 ? u : 1 - next) * texture.width;
    ctx.drawImage(texture, sx, 0, texture.width / strips, texture.height, Math.min(dx, nx), y - curl, Math.max(1, Math.abs(nx - dx) + .6), h + curl * 1.5);
  }
  ctx.fillStyle = `rgba(35,28,20,${sine * .15})`; ctx.fillRect(spineX + Math.min(0, w * cosine), y, Math.abs(w * cosine), h);
}
