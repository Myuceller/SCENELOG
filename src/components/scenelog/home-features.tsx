"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { latestLogs, ratingToTier, today, type AccountId, type FilmLog } from "@/lib/scene-model";
import { getDayCover } from "@/lib/taste-profile";
import styles from "./home-features.module.css";

const DAYS = 14;

/** The last two weeks ending today (Seoul time), oldest first. */
function recentDays() {
  const end = new Date(`${today()}T00:00:00Z`);
  return Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - (DAYS - 1 - i));
    return day.toISOString().slice(0, 10);
  });
}

/** Two shortcuts at the bottom of the home screen, filled with the user's own records. */
export function HomeFeatures({ movies, logs, user, onDiary, onPrint }: {
  movies: ArchiveMovie[]; logs: FilmLog[]; user: AccountId; onDiary: () => void; onPrint: () => void;
}) {
  const catalog = new Map(movies.map(movie => [movie.id, movie]));
  const days = recentDays().map(date => {
    const log = getDayCover(logs, user, date);
    return { date, day: Number(date.slice(8)), movie: log ? catalog.get(log.movieId) : undefined };
  });
  const favourites = latestLogs(logs, user)
    .flatMap(log => { const movie = catalog.get(log.movieId); return movie && log.rating !== null ? [{ movie, tier: ratingToTier(log.rating), rating: log.rating }] : []; })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
  // Best film in the middle, in front.
  const fan = favourites.length === 3 ? [favourites[1], favourites[0], favourites[2]] : favourites;

  return <section className={styles.features} aria-label="바로가기">
    <article className={styles.card}>
      <h2>한 달의 장면들</h2>
      <p>달력 위에 쌓이는 나의 영화 기록</p>
      <div className={styles.calendar} aria-hidden="true">{days.map(({ date, day, movie }) => movie
        ? <i key={date} data-has><Image src={movie.poster} width={90} height={135} sizes="48px" alt="" /></i>
        : <i key={date}>{day}</i>)}</div>
      <button className={styles.go} onClick={onDiary}>일지 열기<ArrowUpRight size={18} /></button>
    </article>
    <article className={styles.card}>
      <h2>좋아하는 영화를 한 장으로</h2>
      <p>별점과 티어를 프린트로 저장해요</p>
      <div className={styles.fan} aria-hidden="true">{fan.length
        ? fan.map(({ movie, tier }, i) => <div key={movie.id} data-mid={fan.length === 3 && i === 1 || undefined}><Image src={movie.poster} width={150} height={225} sizes="120px" alt="" /><b>{tier}</b></div>)
        : [0, 1, 2].map(i => <div key={i} data-empty data-mid={i === 1 || undefined}><b>{["S", "A", "B"][i]}</b></div>)}</div>
      <button className={styles.go} onClick={onPrint}>프린트룸 열기<ArrowUpRight size={18} /></button>
    </article>
  </section>;
}
