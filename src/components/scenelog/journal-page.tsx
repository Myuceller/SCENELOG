"use client";
import { useEffect, useRef, useState } from "react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { FilmLog } from "@/lib/scene-model";
import { itemsForPage, type FilmJournal, type JournalPage } from "@/lib/journal-model";
import { drawJournalPage, loadJournalMedia } from "@/lib/journal-render";
import styles from "./film-journal.module.css";
export function JournalPageView({ page, number, movies, logs, book }: { page: JournalPage; number: number; movies: ArchiveMovie[]; logs: FilmLog[]; book?: FilmJournal; readonly?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    const visible = book ? { ...page, items: itemsForPage(book, number - 1) } : page;
    void loadJournalMedia(movies, visible.items).then(images => {
      if (disposed || !canvas.current) return;
      const ctx = canvas.current.getContext("2d")!; ctx.setTransform(2, 0, 0, 2, 0, 0);
      drawJournalPage(ctx, visible, movies, logs, images, number); setError("");
    }).catch(error => { if (!disposed) setError(error.message); });
    return () => { disposed = true; };
  }, [page, number, movies, logs, book]);
  return <div className={styles.paper}><canvas ref={canvas} width={900} height={1200} aria-label={`${number}쪽`} />{error && <p className={styles.pageError} role="alert">{error}</p>}</div>;
}
