import Image from "next/image";
import { Star } from "lucide-react";
import type { Movie } from "@/types/movie";
import styles from "./movie-card.module.css";

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.poster}>
        {movie.poster ? (
          <Image src={movie.poster} alt={`${movie.title} 포스터`} fill sizes="(max-width: 600px) 44vw, (max-width: 960px) 29vw, 180px" />
        ) : <span className={styles.noPoster}>포스터 준비 중</span>}
      </div>
      <div className={styles.heading}>
        <h3>{movie.title}</h3>
        <span className={styles.rating} aria-label={movie.rating === null ? "평가 없음" : `${movie.source === "tmdb" ? "TMDB" : "샘플"} 평점 5점 만점에 ${movie.rating}점`}>
          <Star size={13} fill="currentColor" aria-hidden="true" />{movie.rating?.toFixed(1) ?? "—"}
        </span>
      </div>
      <p className={styles.meta}>{movie.year ?? "개봉일 미정"}{movie.genres.length > 0 && ` · ${movie.genres.join(" / ")}`}</p>
      <p className={styles.description}>{movie.description}</p>
    </article>
  );
}
