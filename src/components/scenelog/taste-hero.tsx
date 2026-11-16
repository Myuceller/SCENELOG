"use client";

import Image from "next/image";
import { useMemo } from "react";
import { ArrowRight, Plus } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { buildTasteInsights, MIN_RATED } from "@/lib/taste-insights";
import { latestLogs, today, type AccountId, type FilmLog } from "@/lib/scene-model";
import { TasteOrb } from "./taste-orb";
import styles from "./taste-hero.module.css";

export function TasteHero({ movies, logs, user, onRecord, onOpenMovie, onDiary }: {
  movies: ArchiveMovie[]; logs: FilmLog[]; user: AccountId;
  onRecord: () => void; onOpenMovie: (movie: ArchiveMovie) => void; onDiary: () => void;
}) {
  const month = today().slice(0, 7);
  const { insights, ratedCount } = useMemo(() => buildTasteInsights(movies, logs, user), [movies, logs, user]);
  const monthly = logs.filter(log => log.userId === user && log.watchedOn.startsWith(month));
  const monthFilms = latestLogs(monthly, user).sort((a, b) => b.watchedOn.localeCompare(a.watchedOn))
    .flatMap(log => { const movie = movies.find(movie => movie.id === log.movieId); return movie ? [movie] : []; });
  const remaining = Math.max(0, MIN_RATED - ratedCount);

  return <section className={styles.hero} aria-label="나의 영화 취향 분석">
    {insights.length ? <TasteOrb insights={insights} onOpenMovie={onOpenMovie} title={<>
      <p className={styles.eyebrow}>{ratedCount}편의 별점으로 분석했어요</p>
      <h1>내가 몰랐던 내 취향<br /><em>{insights.length}가지</em>를 찾았어요</h1>
    </>} /> : <div className={styles.empty}>
      <p className={styles.eyebrow}>나의 취향 분석</p>
      <h1>기록이 쌓이면,<br /><em>내 취향</em>이 보여요</h1>
      <p className={styles.description}>영화에 별점을 남기면 좋아하는 장르·감독·시대, 대중과 엇갈린 영화까지 찾아드려요.</p>
      <div className={styles.progress} role="img" aria-label={`별점 ${ratedCount}편 / ${MIN_RATED}편`}>{Array.from({ length: MIN_RATED }, (_, i) => <i key={i} data-done={i < ratedCount || undefined} />)}</div>
      <p className={styles.remaining}>{ratedCount ? `별점 ${remaining}편만 더 남기면 분석이 열려요` : `별점을 ${MIN_RATED}편 남기면 분석이 열려요`}</p>
    </div>}
    <div className={styles.actions}>
      <button className={styles.primary} onClick={onRecord}><Plus size={20} />영화 기록하기</button>
      <button className={styles.monthLink} onClick={onDiary}><span>{Number(month.slice(5))}월의 장면 <strong>{monthly.length}회</strong></span><span className={styles.miniShelf}>{monthFilms.slice(0, 4).map(movie => <Image key={movie.id} src={movie.poster} width={40} height={60} sizes="24px" alt="" />)}</span><ArrowRight size={17} /></button>
    </div>
  </section>;
}
