"use client";

import Image from "next/image";
import { Check, ArrowUpRight } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { getDayCover } from "@/lib/taste-profile";
import { today, type AccountId, type FilmLog } from "@/lib/scene-model";
import styles from "./film-calendar.module.css";

interface CalendarData { logs: FilmLog[]; movies: ArchiveMovie[]; user: AccountId; covers?: Record<string, string> }

export function FilmCalendar({ month, logs, movies, user, covers, onDay }: CalendarData & { month: string; onDay: (day: string) => void }) {
  const [year, number] = month.split("-").map(Number);
  const firstDay = new Date(year, number - 1, 1).getDay();
  const days = new Date(year, number, 0).getDate();
  return <div className={styles.calendar}>
    <div className={styles.weekdays}>{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(day => <span key={day}>{day}</span>)}</div>
    <div className={styles.grid}>
      {Array.from({ length: Math.ceil((firstDay + days) / 7) * 7 }, (_, index) => {
        const day = index - firstDay + 1;
        if (day < 1 || day > days) return <div className={styles.empty} key={index} />;
        const date = `${month}-${String(day).padStart(2, "0")}`;
        const entries = logs.filter(log => log.userId === user && log.watchedOn === date);
        const cover = getDayCover(logs, user, date, covers?.[date]);
        const movie = movies.find(movie => movie.id === cover?.movieId);
        return <button key={index} className={`${styles.day} ${movie ? styles.hasPoster : ""} ${date === today() ? styles.today : ""}`} aria-label={`${number}월 ${day}일 ${entries.length}편 기록${movie ? `, 대표 포스터 ${movie.title}` : ""}`} onClick={() => onDay(date)}>
          {movie && <span className={styles.poster}><Image src={movie.poster} alt={`${movie.title} 포스터`} fill sizes="(max-width: 600px) 14vw, 180px" /><span className={styles.shade} /></span>}
          <span className={styles.number}>{day}</span>
          {entries.length > 1 && <span className={styles.more}>+{entries.length - 1}</span>}
          {movie && cover && <><span className={styles.caption}><strong>{movie.title}</strong><span>★ {cover.rating?.toFixed(1) ?? "—"}</span></span><span className={styles.tooltip}><strong>{movie.title} <span>★ {cover.rating?.toFixed(1) ?? "미평가"}</span></strong><span>{cover.review || "이날의 기록을 열어보세요."}</span>{entries.length > 1 && <small>총 {entries.length}편 · 눌러서 대표 포스터 변경</small>}</span></>}
        </button>;
      })}
    </div>
  </div>;
}

export function DayRecords({ date, logs, movies, user, covers, onCover, onOpen }: CalendarData & {
  date: string; onCover: (logId: string) => void; onOpen: (movie: ArchiveMovie, log: FilmLog) => void;
}) {
  const entries = logs.filter(log => log.userId === user && log.watchedOn === date);
  const cover = getDayCover(logs, user, date, covers?.[date]);
  return <div className={styles.records}>
    {entries.length > 1 && <p className={styles.helper}>달력에 보여줄 대표 포스터를 골라주세요. 선택하지 않으면 가장 최근에 기록한 영화가 보여요.</p>}
    <fieldset><legend className="sr-only">이 날짜의 대표 포스터</legend>
      {entries.map(log => {
        const movie = movies.find(movie => movie.id === log.movieId);
        if (!movie) return null;
        return <div className={`${styles.record} ${cover?.id === log.id ? styles.chosen : ""}`} key={log.id}>
          <button className={styles.openRecord} onClick={() => onOpen(movie, log)} aria-label={`${movie.title} 기록 수정`}><Image src={movie.poster} width={90} height={135} sizes="64px" alt="" /><span><strong>{movie.title}</strong><b>★ {log.rating?.toFixed(1) ?? "미평가"}</b><span>{log.review || "아직 남긴 리뷰가 없어요."}</span><small>기록 수정 <ArrowUpRight size={12} /></small></span></button>
          {entries.length > 1 ? <label className={styles.coverChoice}><input type="radio" name="calendar-cover" aria-label={`${movie.title} 대표 포스터로 설정`} checked={cover?.id === log.id} onChange={() => onCover(log.id)} /><span className={styles.check}>{cover?.id === log.id && <Check size={11} />}</span>{cover?.id === log.id ? "대표 포스터" : "대표로 설정"}</label> : <span className={styles.onlyCover}>달력 포스터</span>}
        </div>;
      })}
    </fieldset>
  </div>;
}
