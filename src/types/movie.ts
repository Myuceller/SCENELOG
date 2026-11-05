export type MovieGenre = "드라마" | "로맨스" | "SF" | "코미디" | "음악";

export interface Movie {
  id: string;
  title: string;
  originalTitle: string;
  year: number;
  director: string;
  genres: MovieGenre[];
  /** 0–5점, 소수점 첫째 자리까지 표시합니다. */
  rating: number;
  poster: string;
  description: string;
}
