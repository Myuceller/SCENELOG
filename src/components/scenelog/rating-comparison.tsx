"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { ArrowDownRight, X } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { AccountId, FilmLog } from "@/lib/scene-model";
import { ratingPeers } from "@/lib/collection-insights";
import styles from "./rating-comparison.module.css";

export function RatingComparison({ movies, logs, user, movieId, rating }: {
  movies: ArchiveMovie[]; logs: FilmLog[]; user: AccountId; movieId: string; rating: number | null;
}) {
  const peers = ratingPeers(movies, logs, user, movieId, rating);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = peers.find(item => item.log.id === selectedId);
  if (rating === null) return null;

  return <section className={styles.comparison} aria-label="같은 별점의 영화 비교">
    <div className={styles.heading}><div><span>MY RATING REFERENCE</span><h4>내 <b>{rating.toFixed(1)}점</b>은 이런 영화 <small>{peers.length}편</small></h4></div><ArrowDownRight size={23} /></div>
    <p className={styles.description} role="status">{peers.length ? "이 영화에도 같은 마음인가요? 포스터를 눌러 당시 감상과 비교해 보세요." : "아직 같은 점수를 준 다른 영화가 없어요. 이 점수의 첫 기준이 되어줄 영화네요."}</p>
    {peers.length > 0 && <div key={rating.toFixed(1)} className={styles.rail} aria-label={`${rating.toFixed(1)}점으로 평가한 다른 영화`}>
      {peers.map(({ movie, log }, index) => <button type="button" key={movie.id} aria-label={`${movie.title} ${log.rating!.toFixed(1)}점 감상 비교`} aria-pressed={selectedId === log.id} onClick={() => setSelectedId(selectedId === log.id ? null : log.id)} style={{ "--index": Math.min(index, 8) } as CSSProperties}>
        <span className={styles.poster}><Image src={movie.poster} width={160} height={240} sizes="110px" alt="" /><b>{log.rating!.toFixed(1)}</b></span><strong>{movie.title}</strong>
      </button>)}
    </div>}
    {selected && <div className={styles.review} key={selected.log.id}>
      <div><strong>{selected.movie.title}</strong><span>{selected.log.watchedOn || "관람일 미정"}{selected.log.spoiler ? " · 스포일러 포함" : ""}</span><button type="button" aria-label="비교 감상 접기" onClick={() => setSelectedId(null)}><X size={15} /></button></div>
      <p>{selected.log.review || "별점만 남긴 영화예요. 저장된 리뷰는 없어요."}</p>
    </div>}
    {peers.length > 0 && <small className={styles.note}>내 기록만 · 영화별 최신 평가 · 전체 별점 기준</small>}
  </section>;
}
