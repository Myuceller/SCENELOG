"use client";

import { useState, type CSSProperties } from "react";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { today, useSceneStore } from "@/lib/scene-store";
import { coverColors, createJournal, isFilmJournal, type FilmJournal } from "@/lib/journal-model";
import { JournalStudio } from "./journal-studio";
import styles from "./film-journal.module.css";

export function FilmJournals({ movies }: { movies: ArchiveMovie[] }) {
  const { state, update, storageError } = useSceneStore();
  const [year, setYear] = useState(Number(today().slice(0, 4)));
  const [openYear, setOpenYear] = useState<number | null>(null);
  if (!state) return null;
  const books = Object.values(state.journals?.[state.userId] ?? {}).filter(isFilmJournal).sort((a, b) => b.year - a.year);
  const opened = books.find(book => book.year === openYear);
  const save = (book: FilmJournal) => update(current => ({ ...current, journals: { ...current.journals, [state.userId]: { ...current.journals?.[state.userId], [book.year]: { ...book, updatedAt: new Date().toISOString() } } } }));
  function create() { if (!Number.isInteger(year) || year < 1900 || year > 2200) return; if (!books.some(book => book.year === year)) save(createJournal(year)); setOpenYear(year); }
  return <section className={styles.library} aria-label="연도별 영화 다이어리">
    <div className={styles.libraryHeading}><div><span>MY FILM JOURNALS</span><h2>한 해의 영화, 한 권의 나.</h2><p>기록한 영화는 우표가 되고, 빈 페이지는 나만의 장면이 돼요.</p></div><form onSubmit={event => { event.preventDefault(); create(); }}><label className="sr-only" htmlFor="journal-year">다이어리 연도</label><input id="journal-year" aria-label="다이어리 연도" type="number" min="1900" max="2200" step="1" value={Number.isNaN(year) ? "" : year} onChange={event => setYear(event.target.value === "" ? NaN : Number(event.target.value))} required /><button className={styles.darkButton}><Plus size={15} />{books.some(book => book.year === year) ? "다이어리 열기" : "한 권 만들기"}</button></form></div>
    <div className={styles.bookShelf}>
      {books.map(book => <button className={styles.closedBook} style={{ "--cover": coverColors[book.cover] } as CSSProperties} key={book.year} onClick={() => setOpenYear(book.year)} aria-label={`${book.year}년 다이어리 펼치기`}>
        <span className={styles.coverSmall}>SCENELOG<br />PERSONAL FILM JOURNAL</span><strong>{book.year}</strong><span className={styles.coverTitle}>{book.title}</span><span className={styles.coverPocket}><span><BookOpen size={18} />{book.pages.length} PAGES</span><ArrowRight size={19} /></span>
      </button>)}
      {!books.length && <button className={styles.firstBook} onClick={create} disabled={!Number.isInteger(year) || year < 1900 || year > 2200}><span><BookOpen size={36} strokeWidth={1} /></span><strong>{Number.isFinite(year) ? year : "올해"}년의 첫 페이지</strong><small>책을 만들고, 우표를 붙여보세요.</small><span>다이어리 시작하기 <ArrowUpRightIcon /></span></button>}
    </div>
    {opened && <JournalStudio key={`${state.userId}-${opened.year}`} book={opened} movies={movies} logs={state.logs.filter(log => log.userId === state.userId)} user={state.userId} storageError={storageError} onChange={save} onClose={() => setOpenYear(null)} />}
  </section>;
}
function ArrowUpRightIcon() { return <ArrowRight size={14} />; }

