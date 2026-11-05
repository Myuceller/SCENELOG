"use client";

import { useEffect, useState } from "react";
import { fetchMovies } from "@/lib/api/movies";
import type { MovieListResponse } from "@/types/movie";

type Result = { key: string } & (
  | { status: "success"; data: MovieListResponse }
  | { status: "error"; message: string }
);

export function useMovies(query: string, page: number) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = JSON.stringify([query, page, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    fetchMovies(query, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, status: "success", data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ key, status: "error", message: error instanceof Error ? error.message : "영화 정보를 불러오지 못했습니다." });
        }
      });
    return () => controller.abort();
  }, [query, page, key]);

  return {
    result: result?.key === key ? result : null,
    retry: () => setAttempt((value) => value + 1),
  };
}
