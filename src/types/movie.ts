export type MovieGenre = string;

export interface Movie {
  id: string;
  title: string;
  originalTitle: string;
  year: number | null;
  genres: MovieGenre[];
  /** 0–5점으로 환산한 외부 평점. 평가가 없으면 null입니다. */
  rating: number | null;
  poster: string | null;
  description: string;
  source: "tmdb" | "sample";
}

export interface MovieDetail extends Movie {
  director: string | null;
  runtime: number | null;
}

export interface MovieListResponse {
  data: Movie[];
  pagination: {
    page: number;
    totalPages: number;
    totalResults: number;
  };
}
