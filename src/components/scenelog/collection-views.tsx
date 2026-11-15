"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, ChevronDown, RotateCcw, Search, Star } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { AccountId, FilmLog } from "@/lib/scene-model";
import { viewingArchive } from "@/lib/collection-insights";
import styles from "./collection-views.module.css";
import archive from "./scenelog.module.css";
import { FilmJournals } from "./film-journal";

export function StampCollection({ movies, logs, onOpen }: { movies: ArchiveMovie[]; logs: FilmLog[]; onOpen: (movie: ArchiveMovie) => void }) {
  const [filter, setFilter] = useState<"favorites" | "perfect" | "all">("favorites");
  const stamps = logs.filter(log => filter === "all" || (log.rating !== null && log.rating >= (filter === "perfect" ? 5 : 4)));
  return <>
    <FilmJournals movies={movies} />
    <div className={styles.intro}><div><span>THE FAVORITES EDIT</span><h2>좋아한 영화만, 한눈에.</h2><p>한 영화에 한 장의 우표. 최신 별점으로 나의 베스트를 모아요.</p></div><div className={styles.filters} aria-label="우표 모아보기">{([['favorites', '4.0점 이상'], ['perfect', '5.0점'], ['all', '모든 우표']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{id === "favorites" && <Star size={12} />}{label}</button>)}</div></div>
    <div className={archive.stampGrid}>{stamps.map((log, i) => {
      const movie = movies.find(movie => movie.id === log.movieId);
      if (!movie) return null;
      return <button className={archive.stampCard} key={movie.id} onClick={() => onOpen(movie)}><div className={archive.stampTop}>SCENELOG ARCHIVE <span>NO. {String(i + 1).padStart(2, "0")}</span></div><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={movie.poster} alt={`${movie.title} 포스터`} /><div className={archive.stampInfo}><span><strong>{movie.title}</strong><small>{movie.year ?? "개봉일 미정"} · {movie.genres[0] ?? "영화"}</small></span><b>{log.rating?.toFixed(1) ?? "—"}</b></div><span className={archive.stampSeal}>{log.rating === 5 ? <>ALL<br />TIME</> : <>SEEN<br />& KEPT</>}</span></button>;
    })}</div>
    {!stamps.length && logs.length > 0 && <p className={styles.empty}>{filter === "perfect" ? "아직 5.0점을 준 영화는 없어요. 나의 인생 영화가 생기면 이곳에 모일 거예요." : "4.0점 이상을 준 영화가 아직 없어요. 모든 우표에서 지금까지의 기록을 볼 수 있어요."}</p>}
  </>;
}

export function VhsArchive({ movies, logs, user, onOpen, onRewatch }: {
  movies: ArchiveMovie[]; logs: FilmLog[]; user: AccountId;
  onOpen: (movie: ArchiveMovie, entry: FilmLog) => void; onRewatch: (movie: ArchiveMovie) => void;
}) {
  const [rewatchedOnly, setRewatchedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState<"record" | "watched" | "rating" | "count">("record");
  const items = viewingArchive(movies, logs, user);
  const rewatched = items.filter(item => item.entries.length > 1).length;
  const term = query.trim().toLocaleLowerCase();
  const visible = items.filter(item => (!rewatchedOnly || item.entries.length > 1) && (!term || [item.movie.title, item.movie.originalTitle, ...item.movie.genres, ...item.entries.map(entry => entry.review)].some(text => text.toLocaleLowerCase().includes(term))))
    .sort((a, b) => sort === "record" ? b.latest.createdAt.localeCompare(a.latest.createdAt) : sort === "watched" ? b.watchedOn.localeCompare(a.watchedOn) || b.latest.createdAt.localeCompare(a.latest.createdAt) : sort === "rating" ? (b.latest.rating ?? -1) - (a.latest.rating ?? -1) || b.latest.createdAt.localeCompare(a.latest.createdAt) : b.entries.length - a.entries.length || b.latest.createdAt.localeCompare(a.latest.createdAt));
  return <>
    <div className={styles.intro}><div><span>MY FILM LOG</span><h2>기록한 영화, 한눈에.</h2><p>별점과 감상, 관람 횟수와 날짜를 한곳에 모았어요.</p></div><div className={styles.filters}><button aria-pressed={rewatchedOnly} onClick={() => setRewatchedOnly(!rewatchedOnly)}><RotateCcw size={13} />다시 본 영화 <b>{rewatched}</b></button></div></div>
    <div className={styles.feedTools}><label className={styles.search}><Search size={16} /><input aria-label="영화 기록 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="영화 제목, 장르, 감상 검색" />{query && <button type="button" onClick={() => setQuery("")}>지우기</button>}</label><label><span className="sr-only">기록 정렬</span><select aria-label="기록 정렬" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="record">기록한 순</option><option value="watched">영화 본 날짜 순</option><option value="rating">별점 높은 순</option><option value="count">많이 본 순</option></select></label></div>
    <div className={styles.feedGrid}>{visible.map(({ movie, entries, latest, watchedOn }) => {
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
    {!visible.length && <p className={styles.empty}>{query ? "제목이나 감상에 일치하는 기록이 없어요." : rewatchedOnly ? "아직 다시 본 영화가 없어요. 재관람 기록이 쌓이면 여기에 모여요." : "첫 관람 기록으로 나만의 영화 기록을 시작해보세요."}</p>}
  </>;
}
