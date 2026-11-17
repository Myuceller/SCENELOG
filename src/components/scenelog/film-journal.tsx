"use client";

import { useCallback, useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { today, type FilmLog } from "@/lib/scene-model";
import { useAccountJournals } from "@/hooks/use-account-journals";
import { createJournal, isFilmJournal, type FilmJournal } from "@/lib/journal-model";
import { JournalStudio } from "./journal-studio";
import { JournalShelf } from "./journal-shelf";
import { Popover } from "./tool-strip";
import strip from "./tool-strip.module.css";
import styles from "./film-journal.module.css";

export function FilmJournals({ movies, logs, user }: { movies: ArchiveMovie[]; logs: FilmLog[]; user: string }) {
  const { books: storedBooks, save, storageError } = useAccountJournals(user);
  const thisYear = Number(today().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [menu, setMenu] = useState<"year" | "help" | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const books = Object.values(storedBooks).filter(isFilmJournal).sort((a, b) => b.year - a.year);
  const opened = books.find(book => book.year === openYear);
  function create(target: number) { if (!Number.isInteger(target) || target < 1900 || target > 2200) return; if (!books.some(book => book.year === target) && !save(createJournal(target))) return; setOpenYear(target); }
  const first = Math.min(thisYear, ...books.map(book => book.year)) - 4, last = Math.max(thisYear, ...books.map(book => book.year)) + 1;
  const items = Array.from({ length: last - first + 1 }, (_, i) => ({ year: first + i, book: books.find(book => book.year === first + i) }));
  const exists = books.some(book => book.year === year);
  return <section className={styles.library} aria-label="연도별 영화 다이어리">
    <h2 className={styles.libraryTitle}>한 해의 영화, 한 권의 나.</h2>
    <div className={strip.controls}>
      <Popover open={menu === "year"} onToggle={() => setMenu(current => current === "year" ? null : "year")} onClose={closeMenu} label={`다이어리 연도 ${year}년`} button={<><span>{year}년</span><ChevronDown size={18} aria-hidden="true" /></>}>
        <YearPanel year={year} books={books} onChange={setYear} onPick={value => { setYear(value); closeMenu(); }} />
      </Popover>
      <button type="button" className={`${strip.toggle} ${strip.action}`} onClick={() => create(year)}>{exists ? <><BookOpen size={16} aria-hidden="true" />다이어리 열기</> : <><Plus size={16} aria-hidden="true" />새 다이어리</>}</button>
      <div className={strip.helpWrap}><Popover open={menu === "help"} onToggle={() => setMenu(current => current === "help" ? null : "help")} onClose={closeMenu} label="다이어리 도움말" button={<span aria-hidden="true">?</span>}>
        <div className={strip.help}>
          <strong>다이어리</strong>
          <p>기록한 영화는 우표가 되고, 빈 페이지는 나만의 장면이 돼요.</p>
          <p>책장을 좌우로 밀어서 넘기고, 표지를 눌러 열어요.</p>
        </div>
      </Popover></div>
    </div>
    {storageError && <p role="alert">다이어리를 저장하거나 불러오지 못했어요. 브라우저 저장 공간을 확인한 뒤 새로고침해 주세요.</p>}
    <JournalShelf items={items} initialYear={books[0]?.year ?? thisYear} onOpen={setOpenYear} onCreate={create} onActive={setYear} focusYear={year} />
    {opened && <JournalStudio key={`${user}-${opened.year}`} book={opened} movies={movies} logs={logs.filter(log => log.userId === user)} user={user} storageError={storageError} onChange={save} onClose={() => setOpenYear(null)} />}
  </section>;
}

/** Pick the year to create or open: step with the arrows, type any year, or jump to a diary that already exists. */
function YearPanel({ year, books, onChange, onPick }: { year: number; books: FilmJournal[]; onChange: (year: number) => void; onPick: (year: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const step = (delta: number) => onChange(Math.min(2200, Math.max(1900, year + delta)));
  return <div>
    <div className={strip.yearBox}>
      <button type="button" aria-label="이전 연도" disabled={year <= 1900} onClick={() => step(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      <input aria-label="연도 직접 입력" data-display inputMode="numeric" value={draft ?? String(year)} onFocus={event => { setDraft(String(year)); event.currentTarget.select(); }}
        onChange={event => { const text = event.target.value.replace(/\D/g, "").slice(0, 4); setDraft(text); const value = Number(text); if (text.length === 4 && value >= 1900 && value <= 2200) onChange(value); }}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} onBlur={() => setDraft(null)} />
      <button type="button" aria-label="다음 연도" disabled={year >= 2200} onClick={() => step(1)}><ChevronRight size={18} aria-hidden="true" /></button>
    </div>
    {books.length > 0 && <>
      <p className={strip.panelLabel}>만든 다이어리</p>
      <div className={strip.list}>{books.map(book => <button type="button" key={book.year} data-current={book.year === year || undefined} onClick={() => onPick(book.year)}>{book.year}년<small>{book.title}</small>{book.year === year && <Check size={16} aria-hidden="true" />}</button>)}</div>
    </>}
  </div>;
}
