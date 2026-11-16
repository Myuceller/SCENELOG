"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, Plus, ChevronDown } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { buildTasteProfile, TASTE_THRESHOLD } from "@/lib/taste-profile";
import { latestLogs, today, type AccountId, type FilmLog } from "@/lib/scene-model";
import styles from "./taste-hero.module.css";

const center = 240;
function point(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return [center + radius * Math.cos(radians), center + radius * Math.sin(radians)];
}
function petal(radius: number, index: number) {
  const start = -89 + index * 45;
  const end = start + 41;
  const a = point(42, start), b = point(radius - 12, start);
  const c = point(radius, start + 5), d = point(radius, end - 5);
  const e = point(radius - 12, end), f = point(42, end);
  const control1 = point(radius, start), control2 = point(radius, end);
  const inner = point(30, (start + end) / 2);
  return `M ${a} L ${b} Q ${control1} ${c} A ${radius} ${radius} 0 0 1 ${d} Q ${control2} ${e} L ${f} Q ${inner} ${a} Z`;
}

export function TasteHero({ movies, logs, user, onRecord, onOpenMovie, onDiary }: {
  movies: ArchiveMovie[]; logs: FilmLog[]; user: AccountId;
  onRecord: () => void; onOpenMovie: (movie: ArchiveMovie) => void; onDiary: () => void;
}) {
  const [period, setPeriod] = useState<"all" | "month">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const month = today().slice(0, 7);
  const profile = buildTasteProfile(movies, logs, user, period === "month" ? month : undefined);
  const active = profile.facets.find(facet => facet.name === selected) ?? profile.facets[0];
  const maximum = Math.max(1, ...profile.facets.map(facet => facet.films.length));
  const monthly = logs.filter(log => log.userId === user && log.watchedOn.startsWith(month));
  const monthFilms = latestLogs(monthly, user).sort((a, b) => b.watchedOn.localeCompare(a.watchedOn))
    .flatMap(log => { const movie = movies.find(movie => movie.id === log.movieId); return movie ? [movie] : []; });
  const themeAverages = ([['ost', '음악'], ['visual', '미장센'], ['story', '스토리']] as const).map(([key, label]) => {
    const scores = profile.favorites.flatMap(item => item.log.themes[key] === undefined ? [] : [item.log.themes[key]!]);
    return { label, count: scores.length, average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null };
  }).filter(item => item.average !== null).sort((a, b) => b.average! - a.average!);
  const topTheme = themeAverages[0];

  return <section className={styles.hero} aria-label="나의 영화 취향 지도">
    <div className={styles.intro}>
      <div className={styles.eyebrow}><span className={styles.dot} /> YOUR TASTE, DISCOVERED.</div>
      <h1>좋아한 영화들이,<br /><span>나를 설명한다.</span></h1>
      <p className={styles.description}>한 편씩 남긴 별점에서 발견하는 취향.<br />지도의 조각을 눌러, 그 취향을 만든 영화들을 만나보세요.</p>
      <div className={styles.insight} key={`${period}-${active.name}`} aria-live="polite">
        <span className={styles.insightLabel}>{profile.provisional ? "지금까지의 취향" : "나의 취향 발견"} <span>{profile.ratedCount}편의 평가</span></span>
        <h2>{profile.favorites.length ? <><em>{active.name}</em>{active.films.length > 1 ? "에 자주 마음이 갔네요." : active.films.length ? "도 취향의 한 조각." : "는 아직 탐색 중."}</> : "첫 별점부터, 취향은 시작돼요."}</h2>
        <p>{profile.favorites.length ? <>4.0점 이상 준 {profile.favorites.length}편 중 <strong>{active.films.length}편</strong>이 {active.name} 영화예요.</> : "마음에 남은 영화에 4.0점 이상을 남겨보세요."}</p>
        <div className={styles.evidence}>
          {active.films.slice(0, 4).map(({ movie, log }, index) => <button key={movie.id} onClick={() => onOpenMovie(movie)} aria-label={`${movie.title} ${log.rating?.toFixed(1)}점 기록 열기`} style={{ "--index": index } as CSSProperties}>
            <Image src={movie.poster} width={120} height={180} sizes="70px" alt="" /><span><strong>{movie.title}</strong><small>★ {log.rating?.toFixed(1)}</small></span><ArrowUpRight size={14} />
          </button>)}
          {!active.films.length && <button className={styles.firstRecord} onClick={onRecord}><Plus size={17} /> 영화 기록하기</button>}
        </div>
        {topTheme && <p className={styles.themeHint}>좋아한 영화의 <strong>{topTheme.label}</strong> 평균은 <b>{topTheme.average!.toFixed(1)}</b><small> / 5 · {topTheme.count}편 기준</small></p>}
      </div>
      <div className={styles.heroActions}><button className={styles.primary} onClick={onRecord}><Plus size={17} />영화 기록하기</button><button className={styles.monthLink} onClick={onDiary}><span>{Number(month.slice(5))}월의 장면 <strong>{monthly.length}회</strong></span><span className={styles.miniShelf}>{monthFilms.slice(0, 4).map(movie => <Image key={movie.id} src={movie.poster} width={40} height={60} sizes="24px" alt="" />)}</span><ArrowRight size={17} /></button></div>
    </div>

    <div className={styles.mapCard}>
      <div className={styles.mapHeading}><span>TASTE MAP <small>01</small></span><div className={styles.period} aria-label="취향 분석 기간"><button aria-pressed={period === "all"} onClick={() => setPeriod("all")}>전체 기록</button><button aria-pressed={period === "month"} onClick={() => setPeriod("month")}>이번 달</button></div></div>
      <div className={styles.mapStage}>
        <svg viewBox="0 0 480 480" className={styles.map} aria-label="4.0점 이상 평가한 영화의 장르 지도">
{profile.facets.map((facet, index) => {
            const radius = facet.films.length ? Math.sqrt(42 ** 2 + (facet.films.length / maximum) * (212 ** 2 - 42 ** 2)) : 215;
            const label = point(facet.films.length ? (radius + 42) / 2 + 9 : 143, -68.5 + index * 45);
            return <g key={facet.name} role="button" tabIndex={0} aria-label={`${facet.name} ${facet.films.length}편 분석 보기`} aria-pressed={active.name === facet.name} onClick={() => setSelected(facet.name)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(facet.name); } }} className={`${styles.petal} ${active.name === facet.name ? styles.active : ""}`} style={{ "--index": index } as CSSProperties}>
              <path className={styles.track} d={petal(215, index)} />
              {facet.films.length > 0 && <path className={styles.fill} d={petal(radius, index)} />}
              <text x={label[0]} y={label[1] - 4} className={facet.films.length ? styles.count : styles.zeroCount}>{facet.films.length}</text>
              <text x={label[0]} y={label[1] + 16} className={facet.films.length ? styles.genre : styles.zeroGenre}>{facet.name === "애니메이션" ? "애니" : facet.name === "다큐멘터리" ? "다큐" : facet.name}</text>
            </g>;
          })}
<text x="240" y="245" className={styles.centerLabel}>{TASTE_THRESHOLD.toFixed(1)}+</text>
        </svg>
      </div>
      <div className={styles.mapFooter}><span><i />높은 평가가 많을수록, 더 큰 조각</span><strong>{profile.favorites.length.toString().padStart(2, "0")}<small> FAVORITES</small></strong></div>
      <details className={styles.method}><summary>어떻게 분석했나요? <ChevronDown size={14} /></summary><p>선택한 기간의 영화별 최신 평가 중 4.0점 이상인 영화를 셉니다. 조각 크기는 표시된 장르 중 가장 많은 장르에 비례하며, 한 영화는 여러 장르에 포함될 수 있어요. 상위 8개 장르를 표시합니다. 테마 평균은 이 영화들에 직접 남긴 해당 점수만 사용해요.{profile.provisional && " 아직 평가가 10편 미만이라, 기록이 쌓이면 지금의 경향도 달라질 수 있어요."}</p></details>
    </div>
  </section>;
}
