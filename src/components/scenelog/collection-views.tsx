"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Search, Star } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { AccountId, FilmLog } from "@/lib/scene-model";
import { viewingArchive } from "@/lib/collection-insights";
import styles from "./collection-views.module.css";

const PAGE_SIZES = [10, 20, 50] as const;

export function VhsArchive({ movies, logs, user, onOpen, onRewatch }: {
  movies: ArchiveMovie[]; logs: FilmLog[]; user: AccountId;
  onOpen: (movie: ArchiveMovie, entry: FilmLog) => void; onRewatch: (movie: ArchiveMovie) => void;
}) {
  const [rewatchedOnly, setRewatchedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState<"record" | "watched" | "rating" | "count">("record");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const resultsRef = useRef<HTMLParagraphElement>(null);
  const items = viewingArchive(movies, logs, user);
  const rewatched = items.filter(item => item.entries.length > 1).length;
  const term = query.trim().toLocaleLowerCase();
  const visible = items.filter(item => (!rewatchedOnly || item.entries.length > 1) && (!term || [item.movie.title, item.movie.originalTitle, ...item.movie.genres, ...item.entries.map(entry => entry.review)].some(text => text.toLocaleLowerCase().includes(term))))
    .sort((a, b) => sort === "record" ? b.latest.createdAt.localeCompare(a.latest.createdAt) : sort === "watched" ? b.watchedOn.localeCompare(a.watchedOn) || b.latest.createdAt.localeCompare(a.latest.createdAt) : sort === "rating" ? (b.latest.rating ?? -1) - (a.latest.rating ?? -1) || b.latest.createdAt.localeCompare(a.latest.createdAt) : b.entries.length - a.entries.length || b.latest.createdAt.localeCompare(a.latest.createdAt));
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
  return <>
    <div className={styles.intro}><div><span>MY FILM LOG</span><h2>기록한 영화, 한눈에.</h2><p>별점과 감상, 관람 횟수와 날짜를 한곳에 모았어요.</p></div><div className={styles.filters}><button aria-pressed={rewatchedOnly} onClick={() => { setRewatchedOnly(!rewatchedOnly); resetPage(); }}><RotateCcw size={13} />다시 본 영화 <b>{rewatched}</b></button></div></div>
    <div className={styles.feedTools}>
      <label className={styles.search}><Search size={16} /><input aria-label="영화 기록 검색" value={query} onChange={event => { setQuery(event.target.value); resetPage(); }} placeholder="영화 제목, 장르, 감상 검색" />{query && <button type="button" onClick={() => { setQuery(""); resetPage(); }}>지우기</button>}</label>
      <div className={styles.selectGroup}>
        <label className={styles.selectControl}>
          <span className="sr-only">페이지당 영화 수</span>
          <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); resetPage(); }}>{PAGE_SIZES.map(size => <option key={size} value={size}>{size}편씩 보기</option>)}</select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
        <label className={styles.selectControl}>
          <span className="sr-only">기록 정렬</span>
          <select value={sort} onChange={event => { setSort(event.target.value as typeof sort); resetPage(); }}><option value="record">기록한 순</option><option value="watched">영화 본 날짜 순</option><option value="rating">별점 높은 순</option><option value="count">많이 본 순</option></select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
      </div>
    </div>
    <p ref={resultsRef} tabIndex={-1} className={styles.resultCount} aria-live="polite" aria-atomic="true">전체 {visible.length.toLocaleString("ko-KR")}편{visible.length > 0 && <> 중 {start + 1}–{start + pageItems.length}편 <span>· {currentPage} / {totalPages} 페이지</span></>}</p>
    <div className={styles.feedGrid}>{pageItems.map(({ movie, entries, latest, watchedOn }) => {
      const open = expanded === movie.id;
      return <article className={styles.filmCard} key={movie.id}>
        <Image className={styles.filmPoster} src={movie.poster} width={164} height={246} sizes="(max-width: 520px) 57px, 82px" alt={`${movie.title} 포스터`} />
        <div className={styles.filmInfo}><span>{movie.year ?? "개봉일 미정"}<i>·</i>{movie.genres.slice(0, 2).join(" · ") || "영화"}</span><button className={styles.filmTitle} onClick={() => onOpen(movie, latest)}>{movie.title}</button><small>{movie.originalTitle}</small></div>
        <p className={styles.filmReview}>{latest.review || "아직 남긴 감상이 없어요."}</p>
        <div className={styles.filmStats}><span><Star size={12} fill="currentColor" />{latest.rating?.toFixed(1) ?? "미평가"}</span><span><RotateCcw size={11} />{entries.length}회</span></div>
        <p className={styles.filmDate}><time>{watchedOn ? `마지막 관람 ${watchedOn.replaceAll("-", ".")}` : "관람일 미정"}</time><i>·</i><time>기록 {latest.createdAt.slice(0, 10).replaceAll("-", ".")}</time></p>
        <div className={styles.filmCardActions}><button onClick={() => onOpen(movie, latest)}>기록 수정 <ArrowUpRight size={12} /></button><button onClick={() => onRewatch(movie)}><RotateCcw size={12} /> 재관람 기록</button><button aria-expanded={open} aria-controls={`log-history-${movie.id}`} onClick={() => setExpanded(open ? null : movie.id)}>{open ? "관람 기록 접기" : `전체 관람 기록 ${entries.length}개`} <ChevronDown size={13} /></button></div>
        {open && <div className={styles.historyRows} id={`log-history-${movie.id}`}>{entries.map(entry => <div className={styles.historyRow} key={entry.id}><time>{entry.watchedOn || "관람일 미정"}</time><span>★ {entry.rating?.toFixed(1) ?? "미평가"}</span><p className={entry.spoiler ? styles.spoiler : ""} title={entry.spoiler ? "가리려면 마우스를 올리세요." : undefined}>{entry.review || "이 관람에는 아직 감상을 남기지 않았어요."}</p><button onClick={() => onOpen(movie, entry)}>이 기록 수정</button></div>)}</div>}
      </article>;
    })}</div>
    {totalPages > 1 && <nav className={styles.pagination} aria-label="컬렉션 페이지">
      <button type="button" aria-label="이전 페이지" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      {pageNumbers.map(number => <button type="button" key={number} aria-label={`${number}페이지`} aria-current={number === currentPage ? "page" : undefined} onClick={() => changePage(number)}>{number}</button>)}
      <button type="button" aria-label="다음 페이지" disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
    </nav>}
    {!visible.length && <p className={styles.empty}>{query ? "제목이나 감상에 일치하는 기록이 없어요." : rewatchedOnly ? "아직 다시 본 영화가 없어요. 재관람 기록이 쌓이면 여기에 모여요." : "첫 관람 기록으로 나만의 영화 기록을 시작해보세요."}</p>}
  </>;
}
