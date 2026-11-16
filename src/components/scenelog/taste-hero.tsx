"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { buildFigureCards } from "@/lib/figure-cards";
import { buildTasteInsights, MIN_RATED } from "@/lib/taste-insights";
import { latestLogs, today, type AccountId, type FilmLog } from "@/lib/scene-model";
import { GlassFigure } from "./glass-figure";
import { TasteDetail } from "./taste-detail";
import styles from "./taste-hero.module.css";

export function TasteHero({ movies, logs, user, onRecord, onOpenMovie, onDiary }: {
  movies: ArchiveMovie[]; logs: FilmLog[]; user: AccountId;
  onRecord: () => void; onOpenMovie: (movie: ArchiveMovie) => void; onDiary: () => void;
}) {
  const month = today().slice(0, 7);
  const [opened, setOpened] = useState<number | null>(null);
  const { insights, ratedCount } = useMemo(() => buildTasteInsights(movies, logs, user), [movies, logs, user]);
  const cards = useMemo(() => buildFigureCards(insights), [insights]);
  const originOf = useCallback((index: number) => document.querySelectorAll(".gf-card")[index]?.getBoundingClientRect() ?? null, []);
  const monthly = logs.filter(log => log.userId === user && log.watchedOn.startsWith(month));
  const monthFilms = latestLogs(monthly, user).sort((a, b) => b.watchedOn.localeCompare(a.watchedOn))
    .flatMap(log => { const movie = movies.find(movie => movie.id === log.movieId); return movie ? [movie] : []; });
  const remaining = Math.max(0, MIN_RATED - ratedCount);

  return <section className={styles.hero} aria-label="나의 영화 취향 분석">
    <div className={styles.title}>
      {insights.length
        ? <><p className={styles.eyebrow}>{ratedCount}편의 별점으로 분석했어요</p><h1>내가 몰랐던 내 취향<br /><em>{insights.length}가지</em>를 찾았어요</h1></>
        : <><p className={styles.eyebrow}>나의 취향 분석</p><h1>기록이 쌓이면,<br /><em>내 취향</em>이 보여요</h1></>}
    </div>
    <GlassFigure cards={cards} onCardClick={setOpened} emptyHint={ratedCount ? `별점 ${remaining}편만 더 남기면 취향 카드가 열려요` : `별점을 ${MIN_RATED}편 남기면 취향 카드가 열려요`} />
    {opened !== null && <TasteDetail insights={insights} index={opened} originOf={originOf} onChange={setOpened} onClose={() => setOpened(null)} onOpenMovie={onOpenMovie} />}
    <div className={styles.actions}>
      <button className={styles.primary} onClick={onRecord}><Plus size={20} />영화 기록하기</button>
      <button className={styles.monthLink} onClick={onDiary}><span>{Number(month.slice(5))}월의 장면 <strong>{monthly.length}회</strong></span><span className={styles.miniShelf}>{monthFilms.slice(0, 4).map(movie => <Image key={movie.id} src={movie.poster} width={40} height={60} sizes="24px" alt="" />)}</span><ArrowRight size={17} /></button>
    </div>
  </section>;
}
