import type { Movie, MovieDetail } from "@/types/movie";

/** The archive can render list results before the separate detail request finishes. */
export interface ArchiveMovie extends Omit<MovieDetail, "poster"> {
  poster: string;
  detailLoaded: boolean;
}

export function normalizeMovie(movie: Movie | MovieDetail): ArchiveMovie {
  const detail = "director" in movie ? movie : null;
  return {
    ...movie,
    poster: movie.poster || "/images/poster-placeholder.svg",
    director: detail?.director ?? null,
    runtime: detail?.runtime ?? null,
    detailLoaded: "detailLoaded" in movie ? Boolean(movie.detailLoaded) : detail !== null,
  };
}

/** Keep saved movies available across search pages and preserve fetched details. */
export function mergeMovieCatalog(...sources: ArchiveMovie[][]): ArchiveMovie[] {
  const catalog = new Map<string, ArchiveMovie>();
  for (const movie of sources.flat()) {
    const previous = catalog.get(movie.id);
    catalog.set(movie.id, previous?.detailLoaded && !movie.detailLoaded
      ? { ...movie, director: previous.director, runtime: previous.runtime, detailLoaded: true }
      : movie);
  }
  return [...catalog.values()];
}
