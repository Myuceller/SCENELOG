"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { FilmLog } from "@/lib/scene-model";
import { itemHeight, itemsForPage, placeOnSpread, spreadItems, type FilmJournal, type JournalItem } from "@/lib/journal-model";
import { drawJournalPage, loadJournalMedia } from "@/lib/journal-render";
import { journalFontFamily } from "@/lib/journal-fonts";
import styles from "./film-journal.module.css";
export type JournalTool = "select" | "pen" | "marker" | "hand";
type Point = { x: number; y: number };
const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const handleNames = ["왼쪽 위", "위", "오른쪽 위", "오른쪽", "오른쪽 아래", "아래", "왼쪽 아래", "왼쪽"];
export function JournalSpread({ book, start, movies, logs, selected, tool, penColor, penSize, onPlace, onSelect, onDelete, onEditPhoto, locked }: {
  book: FilmJournal; start: number; movies: ArchiveMovie[]; logs: FilmLog[]; selected: string | null; tool: JournalTool; penColor: string; penSize: number; locked?: boolean;
  onPlace: (item: JournalItem) => void; onSelect: (id: string | null, side: number) => void; onDelete: (id: string) => void; onEditPhoto: () => void;
}) {
  const surface = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [draft, setDraft] = useState<JournalItem | null>(null), [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const drag = useRef<{ item: JournalItem; point: Point; mode: string } | null>(null), stroke = useRef<Point[] | null>(null), latest = useRef<JournalItem | null>(null);
  const items = spreadItems(book, start), visibleBook = draft ? placeOnSpread(book, start, draft) : book;
  const editingItem = items.find(item => item.id === editing?.id);
  useEffect(() => {
    let disposed = false;
    void loadJournalMedia(movies, spreadItems(visibleBook, start)).then(images => {
      if (disposed || !canvas.current) return;
      const ctx = canvas.current.getContext("2d")!; ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 900, 600);
      for (let side = 0; side < 2; side++) {
        const page = visibleBook.pages[start + side]; if (!page) continue;
        ctx.save(); ctx.translate(side * 450, 0);
        drawJournalPage(ctx, { ...page, items: itemsForPage(visibleBook, start + side).filter(item => item.id !== editing?.id) }, movies, logs, images, start + side + 1); ctx.restore();
      }
      setError("");
    }).catch(reason => { if (!disposed) setError(reason.message); });
    return () => { disposed = true; };
  }, [visibleBook, start, movies, logs, editing?.id]);
  function point(event: { clientX: number; clientY: number }): Point {
    const rect = surface.current!.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * 2, y: (event.clientY - rect.top) / rect.height };
  }
  function begin(event: PointerEvent<HTMLElement>, item: JournalItem, mode = "move") {
    if (tool !== "select" || locked || event.button !== 0 || editing) return;
    event.preventDefault(); event.stopPropagation(); onSelect(item.id, item.x + item.width / 2 >= 1 ? 1 : 0);
    drag.current = { item, point: point(event), mode }; latest.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    const { item, point: origin, mode } = drag.current, current = point(event);
    let dx = current.x - origin.x, dy = current.y - origin.y;
    let next = { ...item };
    if (mode === "move") { next.x += dx; next.y += dy; }
    else {
      const rad = item.rotation * Math.PI / 180, rx = dx * 450 * Math.cos(rad) + dy * 600 * Math.sin(rad), ry = -dx * 450 * Math.sin(rad) + dy * 600 * Math.cos(rad);
      dx = rx / 450; dy = ry / 600;
      const oldH = itemHeight(item); let width = item.width, height = oldH;
      if (mode.includes("e")) width += dx; if (mode.includes("w")) width -= dx;
      if (mode.includes("s")) height += dy; if (mode.includes("n")) height -= dy;
      width = Math.max(.07, Math.min(1.9, width)); height = Math.max(.025, Math.min(.98, height));
      if (item.kind === "stamp" || item.kind === "photo") {
        const ratio = oldH / item.width;
        if (mode === "n" || mode === "s") width = height / ratio; else height = width * ratio;
        if (height > .98) { height = .98; width = height / ratio; }
      }
      next = { ...item, width, height, x: item.x + (mode.includes("w") ? item.width - width : 0), y: item.y + (mode.includes("n") ? oldH - height : 0) };
    }
    next.x = Math.max(0, Math.min(2 - next.width, next.x)); next.y = Math.max(0, Math.min(1 - itemHeight(next), next.y));
    latest.current = next; setDraft(next);
  }
  function stop() { if (drag.current && latest.current) onPlace(latest.current); drag.current = null; latest.current = null; setDraft(null); }
  function strokeItem(points: Point[]): JournalItem {
    const padX = penSize / 450, padY = penSize / 600;
    const minX = Math.max(0, Math.min(...points.map(p => p.x)) - padX), minY = Math.max(0, Math.min(...points.map(p => p.y)) - padY);
    const width = Math.max(.02, Math.min(2, Math.max(...points.map(p => p.x)) + padX) - minX), height = Math.max(.02, Math.min(1, Math.max(...points.map(p => p.y)) + padY) - minY);
    return { id: latest.current?.id ?? crypto.randomUUID(), kind: "drawing", x: minX, y: minY, width, height, rotation: 0, color: penColor, penWidth: penSize, opacity: tool === "marker" ? .32 : 1, z: Math.max(0, ...items.map(item => item.z ?? 0)) + 1, points: points.map(p => ({ x: (p.x - minX) / width, y: (p.y - minY) / height })) };
  }
  function finishEdit(save: boolean) {
    if (save && editingItem && editing && editing.text !== editingItem.text) onPlace({ ...editingItem, text: editing.text });
    setEditing(null);
  }
  return <div ref={surface} className={styles.spreadEditor} data-tool={tool}>
    <canvas ref={canvas} width={1800} height={1200} aria-label={`${start + 1}–${start + 2}쪽 다이어리 편집 영역`} />
    {!locked && tool === "select" && items.map(original => {
      const item = draft?.id === original.id ? draft : original;
      const label = item.kind === "stamp" ? `${movies.find(movie => movie.id === item.movieId)?.title ?? "영화"} 우표` : item.kind === "text" ? `문장: ${item.text?.slice(0, 30)}` : item.kind === "photo" ? "사진" : "그림";
      return <div key={item.id} role="button" tabIndex={0} aria-label={`${label} 선택`} className={styles.objectBox} data-selected={selected === item.id} style={{ left: `${item.x * 50}%`, top: `${item.y * 100}%`, width: `${item.width * 50}%`, height: `${itemHeight(item) * 100}%`, transform: `rotate(${item.rotation}deg)`, zIndex: selected === item.id ? 10 : 2 }}
        onClick={event => { event.stopPropagation(); onSelect(item.id, item.x + item.width / 2 >= 1 ? 1 : 0); }}
        onDoubleClick={() => item.kind === "text" ? setEditing({ id: item.id, text: item.text ?? "" }) : item.kind === "photo" ? onEditPhoto() : undefined}
        onPointerDown={event => begin(event, item)} onPointerMove={move} onPointerUp={stop} onPointerCancel={() => { drag.current = null; setDraft(null); }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          const step = event.shiftKey ? .05 : .01, dirs: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
          if (dirs[event.key]) { event.preventDefault(); onPlace({ ...item, x: item.x + dirs[event.key].x, y: item.y + dirs[event.key].y }); }
          if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); onDelete(item.id); }
          if (event.key === "Enter" && item.kind === "text") { event.preventDefault(); setEditing({ id: item.id, text: item.text ?? "" }); }
        }}>
        {selected === item.id && !editing && handles.map((handle, index) => <button key={handle} type="button" tabIndex={-1} aria-label={`${handleNames[index]} 크기 조절`} className={styles.resizeHandle} data-handle={handle} onPointerDown={event => begin(event, item, handle)} onPointerMove={event => { event.stopPropagation(); move(event); }} onPointerUp={event => { event.stopPropagation(); stop(); }} />)}
      </div>;
    })}
    {!locked && tool !== "hand" && <div className={styles.inkSurface} data-drawing={tool === "pen" || tool === "marker"} onPointerDown={event => {
      if (event.button !== 0) return;
      const p = point(event); onSelect(null, p.x >= 1 ? 1 : 0);
      if (tool !== "pen" && tool !== "marker") return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); stroke.current = [p]; latest.current = strokeItem([p]); setDraft(latest.current);
    }} onPointerMove={event => {
      if (!stroke.current) return;
      const p = point(event); p.x = Math.max(.01, Math.min(1.99, p.x)); p.y = Math.max(.01, Math.min(.99, p.y));
      const last = stroke.current[stroke.current.length - 1]; if (Math.hypot((p.x - last.x) * 450, (p.y - last.y) * 600) < 1.2) return;
      stroke.current.push(p); latest.current = strokeItem(stroke.current); setDraft(latest.current);
    }} onPointerUp={() => { if (stroke.current && latest.current) onPlace(latest.current); stroke.current = null; latest.current = null; setDraft(null); }} onPointerCancel={() => { stroke.current = null; latest.current = null; setDraft(null); }} />}
    {editing && editingItem && <textarea key={editing.id} autoFocus aria-label="페이지에서 문장 편집" className={styles.inlineText} value={editing.text} maxLength={3000} style={{ left: `${editingItem.x * 50}%`, top: `${editingItem.y * 100}%`, width: `${editingItem.width * 50}%`, height: `${itemHeight(editingItem) * 100}%`, transform: `rotate(${editingItem.rotation}deg)`, fontFamily: journalFontFamily(editingItem.font), fontSize: `${(editingItem.fontSize ?? 25) / 900 * 100}cqw`, color: editingItem.color, textAlign: editingItem.align ?? "left" }} onChange={event => setEditing({ ...editing, text: event.target.value })} onBlur={() => finishEdit(true)} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finishEdit(false); } if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) finishEdit(true); }} />}
    {error && <p className={styles.pageError} role="alert">{error}</p>}
  </div>;
}
