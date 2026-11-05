import "server-only";
import type { Movie, MovieDetail } from "@/types/movie";
import type { TmdbMovie, TmdbMovieDetail } from "./schemas";

export function mapMovie(movie: TmdbMovie, genres: string[]): Movie {
  const year = movie.release_date?.match(/^(\d{4})-\d{2}-\d{2}$/)?.[1];
  // TMDB 파일 경로만 허용합니다. 누락되거나 잘못된 경로는 UI의 대체 표시로 처리합니다.
  const poster = movie.poster_path && /^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(movie.poster_path)
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;

  return {
    id: String(movie.id),
    title: movie.title || movie.original_title,
    originalTitle: movie.original_title,
    year: year ? Number(year) : null,
    genres,
    rating: movie.vote_count > 0 ? Math.round(movie.vote_average * 5) / 10 : null,
    poster,
    description: movie.overview?.trim() || "아직 등록된 줄거리가 없습니다.",
    source: "tmdb",
  };
}

export function mapMovieDetail(movie: TmdbMovieDetail): MovieDetail {
  return {
    ...mapMovie(movie, movie.genres.map((genre) => genre.name)),
    director: movie.credits.crew.filter((person) => person.job === "Director").map((person) => person.name).join(", ") || null,
    runtime: movie.runtime || null,
  };
}
