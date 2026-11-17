"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { AccountId, FilmLog } from "@/lib/scene-model";
import { viewingArchive } from "@/lib/collection-insights";
import { Popover } from "./tool-strip";
import strip from "./tool-strip.module.css";
import styles from "./collection-views.module.css";

const PAGE_SIZES = [10, 20, 50] as const;
type Sort = "watched" | "record" | "rating" | "count";
const sortNames: Record<Sort, string> = { watched: "본 날짜 순", record: "기록한 순", rating: "별점 높은 순", count: "많이 본 순" };

/** The date shown for a film in the list. A missing viewing date stays missing; it is never replaced by the record date. */
function shownDay(sort: Sort, item: { watchedOn: string; latest: FilmLog }) {
  return sort === "record" ? item.latest.createdAt.slice(0, 10) : item.watchedOn;
}

export function VhsArchive({ movies, logs, user, onOpen, onRewatch }: {
  movies: ArchiveMovie[]; logs: FilmLog[]; user: AccountId;
  onOpen: (movie: ArchiveMovie, entry: FilmLog) => void; onRewatch: (movie: ArchiveMovie) => void;
}) {
  const [rewatchedOnly, setRewatchedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("watched");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [menu, setMenu] = useState<"sort" | "size" | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const resultsRef = useRef<HTMLParagraphElement>(null);
  const items = viewingArchive(movies, logs, user);
  const rewatched = items.filter(item => item.entries.length > 1).length;
  const term = query.trim().toLocaleLowerCase();
  const byRecord = (a: typeof items[number], b: typeof items[number]) => b.latest.createdAt.localeCompare(a.latest.createdAt);
  const visible = items.filter(item => (!rewatchedOnly || item.entries.length > 1) && (!term || [item.movie.title, item.movie.originalTitle, ...item.movie.genres, ...item.entries.map(entry => entry.review)].some(text => text.toLocaleLowerCase().includes(term))))
    .sort((a, b) => sort === "record" ? byRecord(a, b) : sort === "watched" ? b.watchedOn.localeCompare(a.watchedOn) || byRecord(a, b) : sort === "rating" ? (b.latest.rating ?? -1) - (a.latest.rating ?? -1) || byRecord(a, b) : b.entries.length - a.entries.length || byRecord(a, b));

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = visible.slice(start, start + pageSize);
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPage + index);
  function resetPage() { setPage(1); setExpanded(null); }
  function changePage(next: number) {
    setPage(Math.max(1, Math.min(next, totalPages)));
    setExpanded(null);
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: "start" });
  }

  // Date sorts are grouped by month under a heading; rating and count sorts stay one flat list.
  const grouped = sort === "watched" || sort === "record";
  const groups: { key: string; label: string; items: typeof visible }[] = [];
  for (const item of pageItems) {
    const day = shownDay(sort, item);
    const key = grouped ? day.slice(0, 7) : "";
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: !grouped ? "" : key ? `${key.slice(0, 4)}년 ${Number(key.slice(5, 7))}월` : "관람일 미정", items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return <>
    <label className={styles.search}><Search size={18} aria-hidden="true" /><input aria-label="영화 기록 검색" value={query} onChange={event => { setQuery(event.target.value); resetPage(); }} placeholder="영화 제목, 장르, 감상 검색" />{query && <button type="button" onClick={() => { setQuery(""); resetPage(); }}>지우기</button>}</label>
    <div className={strip.controls}>
      <Popover open={menu === "sort"} onToggle={() => setMenu(current => current === "sort" ? null : "sort")} onClose={closeMenu} label={`정렬 ${sortNames[sort]}`}
        button={<><span>{sortNames[sort]}</span><ChevronDown size={18} aria-hidden="true" /></>}>
        <div className={strip.list}>{(Object.keys(sortNames) as Sort[]).map(value => <button type="button" key={value} data-current={sort === value || undefined} onClick={() => { setSort(value); resetPage(); closeMenu(); }}>{sortNames[value]}{sort === value && <Check size={16} aria-hidden="true" />}</button>)}</div>
      </Popover>
      <button type="button" className={strip.toggle} aria-pressed={rewatchedOnly} onClick={() => { setRewatchedOnly(value => !value); resetPage(); }}>다시 본 영화 <b>{rewatched}</b></button>
      <Popover open={menu === "size"} onToggle={() => setMenu(current => current === "size" ? null : "size")} onClose={closeMenu} label={`한 페이지에 ${pageSize}편씩 보기`}
        button={<><span>{pageSize}편씩</span><ChevronDown size={18} aria-hidden="true" /></>}>
        <div className={strip.list}>{PAGE_SIZES.map(size => <button type="button" key={size} data-current={pageSize === size || undefined} onClick={() => { setPageSize(size); resetPage(); closeMenu(); }}>{size}편씩 보기{pageSize === size && <Check size={16} aria-hidden="true" />}</button>)}</div>
      </Popover>
    </div>
    <p ref={resultsRef} tabIndex={-1} className={styles.resultCount} aria-live="polite" aria-atomic="true">전체 {visible.length.toLocaleString("ko-KR")}편{visible.length > 0 && <> 중 {start + 1}–{start + pageItems.length}편 <span>· {currentPage} / {totalPages} 페이지</span></>}</p>

    {groups.map(group => <section className={styles.group} key={group.key || "all"} data-flat={!group.label || undefined} aria-label={group.label || undefined}>
      {group.label && <h3 className={styles.month}>{group.label}<span>{group.items.length}편</span></h3>}
      {group.items.map(item => {
        const { movie, entries, latest } = item;
        const day = shownDay(sort, item);
        const open = expanded === movie.id;
        return <article className={styles.row} key={movie.id}>
          <div className={styles.day}>{day ? <>{day.slice(8, 10)}<small>{Number(day.slice(5, 7))}월</small></> : <>—<small>미정</small></>}</div>
          <Image className={styles.poster} src={movie.poster} width={128} height={192} sizes="64px" alt="" />
          <div className={styles.body}>
            <button type="button" className={styles.title} onClick={() => onOpen(movie, latest)}>{movie.title}</button>
            <div className={styles.meta}><b data-empty={latest.rating === null || undefined}>{latest.rating === null ? "미평가" : `★ ${latest.rating.toFixed(1)}`}</b>
              <button type="button" aria-expanded={open} aria-controls={`log-history-${movie.id}`} onClick={() => setExpanded(open ? null : movie.id)}>{entries.length}회 관람<ChevronDown size={15} aria-hidden="true" /></button></div>
            {latest.review && <p className={styles.review}>{latest.review}</p>}
            {open && <div className={styles.history} id={`log-history-${movie.id}`}>
              {entries.map(entry => <div className={styles.historyRow} key={entry.id}>
                <time>{entry.watchedOn ? entry.watchedOn.replaceAll("-", ".") : "관람일 미정"}</time><span>{entry.rating === null ? "미평가" : `★ ${entry.rating.toFixed(1)}`}</span>
                {entries.length > 1 && entry.review && <p className={entry.spoiler ? styles.spoiler : ""} title={entry.spoiler ? "가리려면 마우스를 올리세요." : undefined}>{entry.review}</p>}
                <button type="button" onClick={() => onOpen(movie, entry)}>수정</button>
              </div>)}
              <button type="button" className={styles.rewatch} onClick={() => onRewatch(movie)}><Plus size={16} aria-hidden="true" />재관람 기록</button>
            </div>}
          </div>
        </article>;
      })}
    </section>)}
    {totalPages > 1 && <nav className={styles.pagination} aria-label="컬렉션 페이지">
      <button type="button" aria-label="이전 페이지" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      {pageNumbers.map(number => <button type="button" key={number} aria-label={`${number}페이지`} aria-current={number === currentPage ? "page" : undefined} onClick={() => changePage(number)}>{number}</button>)}
      <button type="button" aria-label="다음 페이지" disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
    </nav>}
    {!visible.length && <p className={styles.empty}>{query ? "제목이나 감상에 일치하는 기록이 없어요." : rewatchedOnly ? "아직 다시 본 영화가 없어요." : "첫 관람 기록으로 나만의 영화 기록을 시작해보세요."}</p>}
  </>;
}
