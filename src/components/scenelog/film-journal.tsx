"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { today, useSceneStore } from "@/lib/scene-store";
import { createJournal, isFilmJournal, type FilmJournal } from "@/lib/journal-model";
import { JournalStudio } from "./journal-studio";
import { JournalShelf } from "./journal-shelf";
import styles from "./film-journal.module.css";

export function FilmJournals({ movies }: { movies: ArchiveMovie[] }) {
  const { state, update, storageError } = useSceneStore();
  const thisYear = Number(today().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [openYear, setOpenYear] = useState<number | null>(null);
  if (!state) return null;
  const books = Object.values(state.journals?.[state.userId] ?? {}).filter(isFilmJournal).sort((a, b) => b.year - a.year);
  const opened = books.find(book => book.year === openYear);
  const save = (book: FilmJournal) => update(current => ({ ...current, journals: { ...current.journals, [state.userId]: { ...current.journals?.[state.userId], [book.year]: { ...book, updatedAt: new Date().toISOString() } } } }));
  function create(target: number) { if (!Number.isInteger(target) || target < 1900 || target > 2200) return; if (!books.some(book => book.year === target)) save(createJournal(target)); setOpenYear(target); }
  const first = Math.min(thisYear, ...books.map(book => book.year)) - 4, last = Math.max(thisYear, ...books.map(book => book.year)) + 1;
  const items = Array.from({ length: last - first + 1 }, (_, i) => ({ year: first + i, book: books.find(book => book.year === first + i) }));
  return <section className={styles.library} aria-label="연도별 영화 다이어리">
    <div className={styles.libraryHeading}><div><span>MY FILM JOURNALS</span><h2>한 해의 영화, 한 권의 나.</h2><p>기록한 영화는 우표가 되고, 빈 페이지는 나만의 장면이 돼요.</p></div><form onSubmit={event => { event.preventDefault(); create(year); }}><label className="sr-only" htmlFor="journal-year">다이어리 연도</label><input id="journal-year" aria-label="다이어리 연도" type="number" min="1900" max="2200" step="1" value={Number.isNaN(year) ? "" : year} onChange={event => setYear(event.target.value === "" ? NaN : Number(event.target.value))} required /><button className={styles.darkButton}><Plus size={15} />{books.some(book => book.year === year) ? "다이어리 열기" : "한 권 만들기"}</button></form></div>
    <JournalShelf items={items} initialYear={books[0]?.year ?? thisYear} onOpen={setOpenYear} onCreate={create} />
    {opened && <JournalStudio key={`${state.userId}-${opened.year}`} book={opened} movies={movies} logs={state.logs.filter(log => log.userId === state.userId)} user={state.userId} storageError={storageError} onChange={save} onClose={() => setOpenYear(null)} />}
  </section>;
}
