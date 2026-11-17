import type { Movie } from "./movie";

export interface PersonDetail {
  id: number;
  name: string;
  photo: string | null;
  movies: (Movie & { character: string })[];
}
