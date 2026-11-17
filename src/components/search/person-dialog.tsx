"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Film, Star, UserRound } from "lucide-react";
import { Modal } from "@/components/scenelog/ui";
import { normalizeMovie, type ArchiveMovie } from "@/lib/archive-movies";
import type { PersonDetail } from "@/types/person";
import type { PersonSearchResult } from "@/types/search";
import styles from "./person-dialog.module.css";

const PAGE_SIZE = 24;

export function PersonDialog({ person, onClose, onMovie }: {
  person: PersonSearchResult;
  onClose: () => void;
  onMovie: (movie: ArchiveMovie) => void;
}) {
  const [retry, setRetry] = useState(0);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [result, setResult] = useState<{ key: string; data?: PersonDetail; error?: string } | null>(null);
  const key = `${person.id}:${retry}`;
  const current = result?.key === key ? result : null;
  const detail = current?.data;
  const photo = detail ? detail.photo : person.photo;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const response = await fetch(`/api/people/${person.id}`, { signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "출연작을 불러오지 못했어요.");
      if (!controller.signal.aborted) setResult({ key, data: body.data });
    }
    void load().catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : "출연작을 불러오지 못했어요." });
    });
    return () => controller.abort();
  }, [person.id, key]);

  return <Modal title="인물 상세" wide onClose={onClose}>
    <div className={styles.profile}>
      {photo ? <Image className={styles.photo} src={photo} alt="" width={96} height={120} sizes="96px" /> : <span className={styles.photo}><UserRound size={36} aria-hidden="true" /></span>}
      <div><h3>{detail?.name ?? person.name}</h3>{person.originalName !== (detail?.name ?? person.name) && <p>{person.originalName}</p>}<p>{person.department}</p></div>
    </div>
    <div className={styles.heading}><h3>출연 영화{detail && <span>{detail.movies.length}편</span>}</h3><span>최신 개봉순</span></div>
    {!current && <p className={styles.status} role="status">출연작을 불러오는 중…</p>}
    {current?.error && <div className={styles.status} role="alert"><p>{current.error}</p><button type="button" className={styles.more} onClick={() => setRetry(value => value + 1)}>다시 시도</button></div>}
    {detail && <>
      {!detail.movies.length && <p className={styles.status}>등록된 출연 영화가 없어요.</p>}
      <ul className={styles.movies}>{detail.movies.slice(0, visible).map(movie => <li key={movie.id}>
        <button type="button" className={styles.movie} onClick={() => { onClose(); onMovie(normalizeMovie(movie)); }} aria-label={`${movie.title} 상세 보기`}>
          <span className={styles.poster}>{movie.poster ? <Image src={movie.poster} alt="" fill sizes="(max-width: 600px) 40vw, 180px" /> : <Film size={32} aria-hidden="true" />}</span>
          <span className={styles.movieTitle}>{movie.title}</span>
          <span className={styles.meta}>{movie.year ?? "개봉일 미정"}{movie.rating !== null && <span className={styles.rating} aria-label={`TMDB 평점 5점 만점에 ${movie.rating}점`}><Star size={12} fill="currentColor" aria-hidden="true" />{movie.rating.toFixed(1)}</span>}</span>
          {movie.character && <span className={styles.character}>{movie.character}</span>}
        </button>
      </li>)}</ul>
      {visible < detail.movies.length && <button type="button" className={styles.more} onClick={() => setVisible(count => count + PAGE_SIZE)}>더 보기 ({Math.min(visible, detail.movies.length)} / {detail.movies.length})</button>}
    </>}
  </Modal>;
}
