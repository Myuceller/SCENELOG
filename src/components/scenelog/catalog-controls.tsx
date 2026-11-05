"use client";

import type { MovieListResponse } from "@/types/movie";
import styles from "./scenelog.module.css";

export type LibraryMode = "tmdb" | "sample";
type CatalogResult = null | { status: "error"; message: string } | { status: "success"; data: MovieListResponse };

export function CatalogMode({ mode, onChange }: { mode: LibraryMode; onChange: (mode: LibraryMode) => void }) {
  return <div className={styles.catalogMode}>
    <div className={styles.segmented}>
      <button type="button" aria-pressed={mode === "tmdb"} className={mode === "tmdb" ? styles.selectedSegment : ""} onClick={() => onChange("tmdb")}>TMDB 영화</button>
      <button type="button" aria-pressed={mode === "sample"} className={mode === "sample" ? styles.selectedSegment : ""} onClick={() => onChange("sample")}>예시 영화 체험</button>
    </div>
    <span>{mode === "tmdb" ? "인기 영화와 제목 검색" : "예시 영화 6편 · 체험용 별점"}</span>
  </div>;
}

export function CatalogFeedback({ result, onRetry, onDemo }: { result: CatalogResult; onRetry: () => void; onDemo: () => void }) {
  if (result?.status === "success") return null;
  return <div className={styles.catalogFeedback} role={result?.status === "error" ? "alert" : "status"} aria-busy={!result}>
    {result?.status === "error" ? <>
      <strong>영화를 불러올 수 없어요.</strong><p>{result.message}</p>
      <div className={styles.buttonRow}><button className={styles.blackButton} onClick={onRetry}>다시 시도</button><button className={styles.outlineButton} onClick={onDemo}>예시 영화로 체험하기</button></div>
    </> : <p>영화를 불러오고 있어요…</p>}
  </div>;
}

export function CatalogPagination({ result, page, onChange }: { result: CatalogResult; page: number; onChange: (page: number) => void }) {
  if (result?.status !== "success" || result.data.pagination.totalPages <= 1) return null;
  return <nav className={styles.catalogPagination} aria-label="영화 목록 페이지">
    <button className={styles.outlineButton} disabled={page <= 1} onClick={() => onChange(page - 1)}>이전 페이지</button>
    <span>{page} / {result.data.pagination.totalPages}</span>
    <button className={styles.outlineButton} disabled={page >= result.data.pagination.totalPages} onClick={() => onChange(page + 1)}>다음 페이지</button>
  </nav>;
}
