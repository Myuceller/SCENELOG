import type { ArchiveMovie } from "./archive-movies";
import { josa } from "./korean";
import { latestLogs, type AccountId, type FilmLog, type ThemeKey } from "./scene-model";
import type { TasteFilm } from "./taste-profile";

/** Fewer ratings than this and any "pattern" would be a coincidence. */
export const MIN_RATED = 3;
/** Pseudo-count that pulls small groups toward the overall mean so one lucky film cannot win. */
const SHRINK = 2;
const LONG_MOVIE = 130;

export interface RankRow { name: string; count: number; average: number }
export interface TasteInsight {
  /** Unique and stable: it keys the card in lists and animations. */
  id: string;
  /** Colour of the card, 0-360. */
  hue: number;
  /** Full title shown on the opened card. */
  label: string;
  /** Short title shown on the sphere tile. */
  short: string;
  big: string;
  name: string;
  sentence: string;
  /** `base` is drawn as a marker, `value` as the filled bar. */
  compare?: { base: number; value: number; baseLabel: string; valueLabel: string };
  bars?: { label: string; average: number }[];
  rank?: { liked: RankRow[]; watched: RankRow[]; foot: string };
  films: TasteFilm[];
  stats: [string, string][];
}

export interface Group { name: string; films: TasteFilm[]; count: number; average: number; score: number }
/** Everything an analysis may need, computed once per call. Only rated films are in `rated`. */
export interface InsightContext {
  rated: TasteFilm[];
  /** Mean of all current ratings. */
  overall: number;
  genres: Group[];
  /** Genres seen at least twice, best-liked first. */
  likedGenres: Group[];
  /** All genres, most-watched first. */
  watchedGenres: Group[];
}
/**
 * One analysis. Return the cards it produced, or nothing when the evidence is too thin — never invent a result.
 * To add an analysis: write a builder and add it to `ANALYSES`; the figure's card row and the opened card pick it up.
 */
export type InsightBuilder = (context: InsightContext) => TasteInsight[];

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const one = (value: number) => value.toFixed(1);
const byRating = (films: TasteFilm[]) => [...films].sort((a, b) => b.log.rating! - a.log.rating! || b.log.createdAt.localeCompare(a.log.createdAt));
const star = (value: number) => `★ ${one(value)}`;
const best = (films: TasteFilm[]) => `${films[0].movie.title} ★${one(films[0].log.rating!)}`;

/** Group films by any key(s), with an average and a small-sample-safe score. */
export function groupFilms(films: TasteFilm[], keys: (film: TasteFilm) => (string | null)[], overall: number): Group[] {
  const map = new Map<string, TasteFilm[]>();
  for (const film of films) {
    for (const key of new Set(keys(film))) {
      if (key === null) continue;
      map.set(key, [...(map.get(key) ?? []), film]);
    }
  }
  return [...map].map(([name, members]) => {
    const average = mean(members.map(film => film.log.rating!));
    return { name, films: byRating(members), count: members.length, average, score: (members.length * average + SHRINK * overall) / (members.length + SHRINK) };
  });
}

function weekday(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return Number.isNaN(day) ? null : day;
}

const vsAverage = (context: InsightContext, value: number, valueLabel: string) => ({ base: context.overall, value, baseLabel: "내 평균", valueLabel });
const rowOf = (item: Group): RankRow => ({ name: item.name, count: item.count, average: item.average });

const genreRank: InsightBuilder = context => {
  const { likedGenres, watchedGenres } = context;
  if (!likedGenres.length) return [];
  const top = likedGenres[0], most = watchedGenres[0];
  return [{
    id: "rank", hue: 350, label: "나의 장르 순위", short: "장르 순위", big: "1위", name: top.name,
    sentence: "", films: top.films, stats: [],
    rank: {
      liked: likedGenres.slice(0, 5).map(rowOf), watched: watchedGenres.slice(0, 5).map(rowOf),
      foot: most.name !== top.name ? `${josa(most.name, "은", "는")} 가장 많이 봤지만, 가장 좋아한 건 ${josa(top.name, "이에요", "예요")}.` : `가장 많이 본 ${josa(top.name, "이", "가")} 가장 좋아한 장르이기도 해요.`,
    },
  }];
};

const favouriteGenre: InsightBuilder = context => {
  const top = context.likedGenres[0];
  if (!top) return [];
  return [{
    id: "like", hue: 18, label: "가장 좋아하는 장르", short: "최애 장르", big: one(top.average), name: top.name,
    sentence: `${josa(top.name, "을", "를")} 볼 때 가장 후하게 점수를 줘요`,
    compare: vsAverage(context, top.average, top.name),
    films: top.films, stats: [["평균 별점", star(top.average)], ["최고작", best(top.films)]],
  }];
};

const watchedButLessLiked: InsightBuilder = context => {
  const miss = context.genres.filter(item => item.count >= 3 && item.average < context.overall - 0.4).sort((a, b) => b.count - a.count)[0];
  if (!miss) return [];
  return [{
    id: "miss", hue: 225, label: "많이 봤지만 덜 좋아한 장르", short: "덜 맞는 장르", big: `${miss.count}편`, name: miss.name,
    sentence: `${josa(miss.name, "은", "는")} ${miss.count}편이나 봤지만 평균 ★${one(miss.average)}이에요`,
    compare: vsAverage(context, miss.average, miss.name),
    films: miss.films, stats: [["평균 별점", star(miss.average)], ["그래도 최고작", best(miss.films)]],
  }];
};

const favouriteDirector: InsightBuilder = context => {
  const director = groupFilms(context.rated, film => [film.movie.director], context.overall).filter(item => item.count >= 2).sort((a, b) => b.score - a.score)[0];
  if (!director) return [];
  return [{
    id: "dir", hue: 262, label: "자꾸 고르게 되는 감독", short: "단골 감독", big: `${director.count}편`, name: director.name,
    sentence: `${director.name} 영화를 ${director.count}번 골랐고, 평균 ★${one(director.average)}을 줬어요`,
    compare: vsAverage(context, director.average, "이 감독"),
    films: director.films, stats: [["평균 별점", star(director.average)], ["최고작", best(director.films)]],
  }];
};

const favouriteDecade: InsightBuilder = context => {
  const decade = groupFilms(context.rated, film => [film.movie.year === null ? null : `${Math.floor(film.movie.year / 10) * 10}년대`], context.overall).filter(item => item.count >= 2).sort((a, b) => b.score - a.score)[0];
  if (!decade) return [];
  return [{
    id: "dec", hue: 160, label: "후하게 점수 주는 시대", short: "후한 시대", big: one(decade.average), name: decade.name,
    sentence: `${decade.name} 영화에 유독 점수가 후해요`,
    compare: vsAverage(context, decade.average, decade.name),
    films: decade.films, stats: [["평균 별점", star(decade.average)], ["최고작", best(decade.films)]],
  }];
};

const againstThePublic: InsightBuilder = context => {
  const gaps = context.rated.flatMap(film => film.movie.rating === null ? [] : [{ film, diff: film.log.rating! - film.movie.rating }])
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || b.diff - a.diff);
  if (!gaps.length || Math.abs(gaps[0].diff) < 0.4) return [];
  const { film, diff } = gaps[0];
  return [{
    id: "pub", hue: 340, label: "대중과 가장 엇갈린 영화", short: "대중과 차이", big: `${diff > 0 ? "+" : "−"}${one(Math.abs(diff))}`, name: film.movie.title,
    sentence: `대중은 ★${one(film.movie.rating!)}, 나는 ★${one(film.log.rating!)}을 줬어요`,
    compare: { base: film.movie.rating!, value: film.log.rating!, baseLabel: "대중", valueLabel: "나" },
    films: gaps.slice(0, 3).map(item => item.film),
    stats: [["내 별점", star(film.log.rating!)], ["대중 평점", star(film.movie.rating!)]],
  }];
};

const themeLabels: [ThemeKey, string][] = [["ost", "음악"], ["visual", "미장센"], ["story", "스토리"]];
const generousTheme: InsightBuilder = context => {
  const themes = themeLabels.flatMap(([key, label]) => {
    const scored = context.rated.filter(film => film.log.themes[key] !== undefined);
    return scored.length >= MIN_RATED ? [{ key, label, scored, average: mean(scored.map(film => film.log.themes[key]!)) }] : [];
  }).sort((a, b) => b.average - a.average);
  if (themes.length < 2) return [];
  const top = themes[0], low = themes[themes.length - 1];
  const ranked = [...top.scored].sort((a, b) => b.log.themes[top.key]! - a.log.themes[top.key]!);
  return [{
    id: "theme", hue: 36, label: "가장 후하게 주는 점수", short: "후한 점수", big: one(top.average), name: top.label,
    sentence: `${low.label}보다 ${top.label}에 ${one(top.average - low.average)}점 더 후해요`,
    bars: themes.map(item => ({ label: item.label, average: item.average })),
    films: ranked.slice(0, 3), stats: [["평균 점수", star(top.average)], [`${top.label} 최고작`, `${ranked[0].movie.title} ★${one(ranked[0].log.themes[top.key]!)}`]],
  }];
};

const runtimeTaste: InsightBuilder = context => {
  const timed = context.rated.filter(film => film.movie.runtime !== null && film.movie.runtime > 0);
  const short = timed.filter(film => film.movie.runtime! < LONG_MOVIE), long = timed.filter(film => film.movie.runtime! >= LONG_MOVIE);
  if (short.length < 2 || long.length < 2) return [];
  const shortAverage = mean(short.map(film => film.log.rating!)), longAverage = mean(long.map(film => film.log.rating!));
  if (Math.abs(shortAverage - longAverage) < 0.15) return [];
  const shortWins = shortAverage > longAverage, winners = byRating(shortWins ? short : long), winAverage = Math.max(shortAverage, longAverage);
  return [{
    id: "run", hue: 195, label: "취향에 맞는 러닝타임", short: "러닝타임", big: one(winAverage), name: shortWins ? `${LONG_MOVIE}분 미만` : `${LONG_MOVIE}분 이상`,
    sentence: shortWins ? `${LONG_MOVIE}분이 넘는 영화(★${one(longAverage)})보다 짧은 영화에 더 후해요` : `${LONG_MOVIE}분 미만 영화(★${one(shortAverage)})보다 긴 영화에 더 후해요`,
    compare: vsAverage(context, winAverage, shortWins ? "짧은 영화" : "긴 영화"),
    films: winners, stats: [["평균 별점", star(winAverage)], ["최고작", best(winners)]],
  }];
};

const weekendOrWeekday: InsightBuilder = context => {
  const dated = context.rated.filter(film => weekday(film.log.watchedOn) !== null);
  const weekend = dated.filter(film => [0, 6].includes(weekday(film.log.watchedOn)!)), weekdays = dated.filter(film => ![0, 6].includes(weekday(film.log.watchedOn)!));
  if (weekend.length < 2 || weekdays.length < 2) return [];
  const weekendAverage = mean(weekend.map(film => film.log.rating!)), weekdayAverage = mean(weekdays.map(film => film.log.rating!));
  if (Math.abs(weekendAverage - weekdayAverage) < 0.15) return [];
  const weekendWins = weekendAverage > weekdayAverage, winners = byRating(weekendWins ? weekend : weekdays), winAverage = Math.max(weekendAverage, weekdayAverage), name = weekendWins ? "주말" : "평일";
  return [{
    id: "week", hue: 290, label: "언제 볼 때 더 좋아할까", short: "언제 볼 때", big: one(winAverage), name,
    sentence: `${name}에 본 영화에 더 후해요 (${weekendWins ? "평일" : "주말"}은 ★${one(Math.min(weekendAverage, weekdayAverage))})`,
    compare: { base: Math.min(weekendAverage, weekdayAverage), value: winAverage, baseLabel: weekendWins ? "평일" : "주말", valueLabel: name },
    films: winners, stats: [[`${name} 평균`, star(winAverage)], [`${name} 최고작`, best(winners)]],
  }];
};

const bestFilm: InsightBuilder = context => {
  const ranked = byRating(context.rated), top = ranked[0];
  return [{
    id: "best", hue: 8, label: "가장 높게 준 영화", short: "최고의 한 편", big: one(top.log.rating!), name: top.movie.title,
    sentence: `가장 높게 준 영화는 ${josa(top.movie.title, "이에요", "예요")}`,
    compare: vsAverage(context, top.log.rating!, top.movie.title),
    films: ranked.slice(0, 3),
    stats: [["내 별점", star(top.log.rating!)], top.movie.director ? ["감독", top.movie.director] : ["개봉", top.movie.year === null ? "미정" : `${top.movie.year}년`]],
  }];
};

/** Cards appear in this order. Add new analyses here. */
export const ANALYSES: InsightBuilder[] = [
  genreRank, favouriteGenre, watchedButLessLiked, favouriteDirector, favouriteDecade, againstThePublic, generousTheme, runtimeTaste, weekendOrWeekday, bestFilm,
];

/** Every card is derived from the user's own records; a card is skipped, never faked, when the evidence is thin. */
export function buildTasteInsights(movies: ArchiveMovie[], logs: FilmLog[], user: AccountId, analyses: InsightBuilder[] = ANALYSES) {
  const catalog = new Map(movies.map(movie => [movie.id, movie]));
  const rated: TasteFilm[] = latestLogs(logs, user).flatMap(log => {
    const movie = catalog.get(log.movieId);
    return movie && log.rating !== null ? [{ movie, log }] : [];
  });
  const result = { insights: [] as TasteInsight[], ratedCount: rated.length, average: rated.length ? mean(rated.map(film => film.log.rating!)) : null };
  if (rated.length < MIN_RATED) return result;
  const overall = result.average!;
  const genres = groupFilms(rated, film => film.movie.genres, overall);
  const context: InsightContext = {
    rated, overall, genres,
    likedGenres: genres.filter(item => item.count >= 2).sort((a, b) => b.score - a.score || b.count - a.count),
    watchedGenres: [...genres].sort((a, b) => b.count - a.count || b.average - a.average),
  };
  const seen = new Set<string>();
  for (const analysis of analyses) {
    for (const insight of analysis(context)) {
      if (seen.has(insight.id)) continue;
      seen.add(insight.id);
      result.insights.push(insight);
    }
  }
  return result;
}
