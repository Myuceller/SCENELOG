"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { MovieCard } from "@/components/movies/movie-card";
import type { Movie } from "@/types/movie";
import styles from "./movie-list.module.css";

interface MovieListProps {
  movies: Movie[];
}

export function MovieList({ movies }: MovieListProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredMovies = movies.filter((movie) =>
    [movie.title, movie.originalTitle, movie.director].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );

  return (
    <section id="movies" className={styles.section} aria-labelledby="movies-title">
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>THE MOVIE SHELF</p>
          <h2 id="movies-title">어떤 영화로 시작할까요?</h2>
        </div>
        <div className={styles.search} role="search">
          <Search size={18} aria-hidden="true" />
          <label htmlFor="movie-search" className="sr-only">영화 제목 또는 감독 검색</label>
          <input id="movie-search" type="search" placeholder="영화 제목, 감독 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")}><X size={16} /></button>}
        </div>
      </div>
      <p className={styles.count} role="status">{normalizedQuery ? `검색 결과 ${filteredMovies.length}편` : `함께 이야기하고 싶은 영화 ${movies.length}편`}</p>
      {filteredMovies.length > 0 ? (
        <div className={styles.grid}>{filteredMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
      ) : (
        <div className={styles.empty}>
          <Search size={28} aria-hidden="true" />
          <h3>아직 찾는 영화가 없어요</h3>
          <p>다른 영화 제목이나 감독 이름으로 검색해 보세요.</p>
          <button type="button" onClick={() => setQuery("")}>전체 영화 보기</button>
        </div>
      )}
    </section>
  );
}
