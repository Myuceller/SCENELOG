"use client";

import { useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { MovieCard } from "@/components/movies/movie-card";
import { useMovies } from "@/hooks/use-movies";
import styles from "./movie-list.module.css";

export function MovieList() {
  const [input, setInput] = useState("");
  const [criteria, setCriteria] = useState({ query: "", page: 1 });
  const { result, retry } = useMovies(criteria.query, criteria.page);
  const loading = result === null;
  const data = result?.status === "success" ? result.data : null;

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = input.trim();
    if (query === criteria.query && criteria.page === 1) retry();
    else setCriteria({ query, page: 1 });
  }

  function reset() {
    setInput("");
    setCriteria({ query: "", page: 1 });
  }

  return (
    <section id="movies" className={styles.section} aria-labelledby="movies-title">
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>THE MOVIE SHELF</p>
          <h2 id="movies-title">어떤 영화로 시작할까요?</h2>
        </div>
        <form className={styles.search} role="search" onSubmit={search}>
          <Search size={18} aria-hidden="true" />
          <label htmlFor="movie-search" className="sr-only">영화 제목 검색</label>
          <input id="movie-search" type="search" placeholder="영화 제목 검색" maxLength={100} value={input} onChange={(event) => setInput(event.target.value)} />
          {(input || criteria.query) && <button type="button" aria-label="검색 초기화" onClick={reset}><X size={16} /></button>}
          <button type="submit" className={styles.searchSubmit}>검색</button>
        </form>
      </div>
      <p className={styles.count} role="status">
        {loading ? "영화를 불러오는 중입니다…" : data ? `${criteria.query ? `“${criteria.query}” 검색 결과` : "TMDB 인기 영화"} · ${data.pagination.totalResults.toLocaleString("ko-KR")}편` : "영화 정보를 불러오지 못했습니다."}
      </p>
      <div aria-busy={loading}>
        {loading && <div className={styles.empty}><p>잠시만 기다려 주세요.</p></div>}
        {result?.status === "error" && (
          <div className={styles.empty} role="alert">
            <h3>영화를 불러올 수 없어요</h3>
            <p>{result.message}</p>
            <button type="button" onClick={retry}>다시 시도</button>
          </div>
        )}
        {data && (data.data.length > 0 ? (
          <div className={styles.grid}>{data.data.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
        ) : (
          <div className={styles.empty}>
            <Search size={28} aria-hidden="true" />
            <h3>찾는 영화가 없어요</h3>
            <p>다른 영화 제목으로 검색해 보세요.</p>
            <button type="button" onClick={reset}>인기 영화 보기</button>
          </div>
        ))}
      </div>
      {data && data.pagination.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="영화 목록 페이지">
          <button type="button" disabled={criteria.page <= 1} onClick={() => setCriteria((value) => ({ ...value, page: value.page - 1 }))}>이전</button>
          <span>{criteria.page} / {data.pagination.totalPages}</span>
          <button type="button" disabled={criteria.page >= data.pagination.totalPages} onClick={() => setCriteria((value) => ({ ...value, page: value.page + 1 }))}>다음</button>
        </nav>
      )}
    </section>
  );
}
