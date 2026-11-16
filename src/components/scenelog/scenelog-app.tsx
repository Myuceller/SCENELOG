"use client";

import Image from "next/image";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronLeft, ChevronRight, Grid2X2, List, Plus, Printer, Search, SlidersHorizontal, Star } from "lucide-react";
import type { ArchiveMovie as Movie } from "@/lib/archive-movies";
import { latestLogs, newId, ratingToTier, themes, today, type FilmLog, type ThemeKey, type Tier, type SceneState } from "@/lib/scene-store";
import { readAccountJournals } from "@/lib/account-journals";
import { getPrintItems } from "@/lib/print-sheet";
import { Empty, Modal } from "./ui";
import { RecordDialog } from "./record-dialog";
import { PrintRoom } from "./print-room";
import type { MovieDetail } from "@/types/movie";
import { normalizeMovie, mergeMovieCatalog } from "@/lib/archive-movies";
import { useMovies } from "@/hooks/use-movies";
import { fetchMovieDetail } from "@/lib/api/movies";
import { StampCollection, VhsArchive } from "./collection-views";
import { TasteHero } from "./taste-hero";
import { FilmCalendar, DayRecords } from "./film-calendar";
import { CatalogMode, CatalogFeedback, CatalogPagination, type LibraryMode } from "./catalog-controls";
import styles from "./scenelog.module.css";
import type { User } from "@supabase/supabase-js";
import { useSupabaseUser } from "@/hooks/use-supabase-user";
import { useCloudArchive } from "@/hooks/use-cloud-archive";
import { AuthControls, LoginScreen } from "@/components/auth/auth-controls";

type WorkspaceStore = {
  state: SceneState | null;
  update: (fn: (state: SceneState) => SceneState) => Promise<boolean>;
  storageError?: boolean;
  saving?: boolean;
  error?: string | null;
  reload?: () => void;
};

const views = [
  { id: "discover", label: "발견" }, { id: "diary", label: "관람일지" },
  { id: "collection", label: "컬렉션" }, { id: "themes", label: "테마별 취향" }, { id: "friends", label: "친구들" },
] as const;
type View = (typeof views)[number]["id"] | "print";
function subscribeView(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
function readView(): View {
  const hash = window.location.hash.slice(1);
  return [...views.map(v => v.id), "print"].includes(hash) ? hash as View : "discover";
}
const tiers: Tier[] = ["S", "A", "B", "C", "D"];

export function SceneLogApp({ movies }: { movies: MovieDetail[] }) {
  const session = useSupabaseUser();
  if (session.loading) return <div className={styles.loading}><strong>SceneLog</strong><p>로그인 상태를 확인하는 중.</p></div>;
  return session.user
    ? <CloudWorkspace key={session.user.id} user={session.user} movies={movies} />
    : <LoginScreen error={session.error} />;
}

function CloudWorkspace({ user, movies }: { user: User; movies: MovieDetail[] }) {
  const store = useCloudArchive(user);
  return <SceneLogWorkspace movies={movies} store={store} user={user} />;
}

function SceneLogWorkspace({ movies: initialMovies, store, user }: { movies: MovieDetail[]; store: WorkspaceStore; user: User }) {
  const { state, update, storageError, saving = false, error, reload } = store;
  const accountName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || state?.userId || "나의 계정";
  const view = useSyncExternalStore(subscribeView, readView, () => "discover" as View);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<{ movie: Movie; entry?: FilmLog; date?: string } | null>(null);
  const [picker, setPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerDate, setPickerDate] = useState<string | undefined>();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [collectionView, setCollectionView] = useState("stamps");
  const [sort, setSort] = useState("rating");
  const [theme, setTheme] = useState<ThemeKey>("ost");
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("tmdb");
  const [page, setPage] = useState(1);
  const [pickerPage, setPickerPage] = useState(1);
  const [apiQuery, setApiQuery] = useState("");
  const [pickerApiQuery, setPickerApiQuery] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequest = useRef<AbortController | null>(null);
  const catalog = useMovies(apiQuery, page, libraryMode === "tmdb" && view === "discover" && filter === "all");
  const pickerCatalog = useMovies(pickerApiQuery, pickerPage, libraryMode === "tmdb" && picker);
  useEffect(() => {
    const timer = setTimeout(() => { setApiQuery(query.trim()); setPickerApiQuery(pickerQuery.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [query, pickerQuery]);
  useEffect(() => () => detailRequest.current?.abort(), []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  function notify(message: string) { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 4500); }
  function navigate(next: View) { history.replaceState(null, "", `#${next}`); window.dispatchEvent(new HashChangeEvent("hashchange")); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if (!state) return <div className={styles.loading}><strong>SceneLog<span>®</span></strong><p role={error ? "alert" : "status"}>{error || "당신의 장면을 꺼내는 중."}</p>{error && <button className={styles.blackButton} onClick={reload}>다시 불러오기</button>}<AuthControls user={user} /></div>;
  const sampleMovies = initialMovies.map(normalizeMovie);
  const liveMovies = catalog.result?.status === "success" ? catalog.result.data.data.map(normalizeMovie) : [];
  const pickerMovies = pickerCatalog.result?.status === "success" ? pickerCatalog.result.data.data.map(normalizeMovie) : [];
  const movies = mergeMovieCatalog(sampleMovies, state.catalog ?? [], liveMovies, pickerMovies);
  const candidates = filter !== "all" ? movies : libraryMode === "sample" ? sampleMovies : liveMovies;
  const pickerFilms = libraryMode === "sample" ? sampleMovies.filter(m =>     (m.title + " " + m.originalTitle + " " + (m.director ?? "")).toLowerCase().includes(pickerQuery.toLowerCase())) : pickerMovies;
  const myLogs = latestLogs(state.logs, state.userId);
  const allMyLogs = state.logs.filter(l => l.userId === state.userId);
  const rated = myLogs.filter(l => l.rating !== null);
  const watchlist = state.watchlist.filter(w => w.userId === state.userId);
  const myRecommendations = state.recommendations.filter(r => r.to.includes(state.userId));
  const films = candidates.filter(m => ((libraryMode === "tmdb" && filter === "all") || `${m.title} ${m.originalTitle} ${m.director ?? ""}`.toLowerCase().includes(query.toLowerCase())) && (filter === "all" || (filter === "watched" ? myLogs.some(l => l.movieId === m.id) : watchlist.some(w => w.movieId === m.id))));
  async function openMovie(movie: Movie, entry?: FilmLog, fresh = false, date?: string) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    let detail = movie;
    if (movie.source === "tmdb" && !movie.detailLoaded) {
      setDetailLoading(true);
      try { detail = normalizeMovie(await fetchMovieDetail(movie.id, controller.signal)); }
      catch (error) { if (!controller.signal.aborted) notify(error instanceof Error ? error.message : "영화 상세를 불러오지 못했어요."); return; }
      finally { if (!controller.signal.aborted) setDetailLoading(false); }
    }
    if (controller.signal.aborted) return;
    setSelected({ movie: detail, entry: fresh ? undefined : entry ?? myLogs.find(l => l.movieId === movie.id), date });
  }
  function changeLibrary(mode: LibraryMode) { setLibraryMode(mode); setPage(1); setPickerPage(1); }
  function cancelDetail() { detailRequest.current?.abort(); setDetailLoading(false); }
  async function toggleWatchlist(movieId: string, onlyAdd = false) {
    const exists = watchlist.some(w => w.movieId === movieId);
    if (onlyAdd && exists) return;
    const success = await update(s => ({ ...s, catalog: mergeMovieCatalog(s.catalog ?? [], movies.filter(m => m.id === movieId)), watchlist: exists ? s.watchlist.filter(w => !(w.userId === s.userId && w.movieId === movieId)) : [...s.watchlist, { userId: s.userId, movieId }] }));
    if (!success) return;
    notify(exists ? "보고 싶은 영화에서 꺼냈어요." : "보고 싶은 영화에 담았어요.");
  }
  function chooseFilm(date?: string) { setPickerPage(1); setPickerDate(date); setPickerQuery(""); setPicker(true); }
  async function saveLog(log: FilmLog) {
    const success = await update(s => ({ ...s, catalog: mergeMovieCatalog(s.catalog ?? [], selected ? [selected.movie] : movies.filter(m => m.id === log.movieId)), logs: s.logs.some(l => l.id === log.id) ? s.logs.map(l => l.id === log.id ? log : l) : [...s.logs, log], watchlist: s.watchlist.filter(w => !(w.userId === s.userId && w.movieId === log.movieId)) }));
    if (!success) return;
    setSelected(null); notify("기록을 저장했어요. 달력과 컬렉션에도 반영됐어요.");
  }
  function shiftMonth(offset: number) { const [year, m] = month.split("-").map(Number); const d = new Date(year, m - 1 + offset, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  const sortedLogs = [...myLogs].sort((a, b) => sort === "recent" ? (b.watchedOn || b.createdAt).localeCompare(a.watchedOn || a.createdAt) : (b.rating ?? -1) - (a.rating ?? -1));
  const monthLogs = allMyLogs.filter(l => l.watchedOn.startsWith(month));
  const themeItems = getPrintItems(movies, myLogs, theme, "rating");
  const selectedDayLogs = allMyLogs.filter(l => l.watchedOn === selectedDay);
  const year = Number(month.slice(0, 4)); const monthNumber = Number(month.slice(5, 7));

  return <div className={styles.app}>
    <div className={styles.topLine}><span>A PERSONAL FILM ARCHIVE.</span><span>COLLECT SCENES. KEEP YOUR POINT OF VIEW.</span><span>MY CLOUD ARCHIVE <i /></span></div>
    <header className={styles.header}><div className={styles.headerInner}>
      <a href="#discover" className={styles.logo} onClick={e => { e.preventDefault(); navigate("discover"); }} aria-label="SceneLog 홈"><span className={styles.logoMark}><i /><i /><i /><i /></span>SceneLog<span className={styles.registered}>®</span></a>
      <nav className={styles.nav} aria-label="주 메뉴">{views.map(v => <a href={`#${v.id}`} key={v.id} aria-current={view === v.id ? "page" : undefined} className={view === v.id ? styles.activeNav : ""} onClick={e => { e.preventDefault(); navigate(v.id); }}>{v.label}</a>)}</nav>
      <div className={styles.headerActions}><button className={`${styles.printNav} ${view === "print" ? styles.activePrintNav : ""}`} aria-label="프린트룸" onClick={() => navigate("print")}><Printer size={17} /><span>프린트룸</span></button><AuthControls user={user} disabled={saving} /></div>
    </div></header>
    {storageError && <p className={styles.storageWarning} role="alert">브라우저 저장소에 접근할 수 없어 새로고침 시 기록이 사라질 수 있어요.</p>}
    {error && <div className={styles.storageWarning} role="alert">{error} <button onClick={reload} disabled={saving}>최신 기록 불러오기</button></div>}
    <p className={styles.storageWarning} role="status">{saving ? "기록을 저장하는 중입니다…" : "개인 기록은 로그인한 계정에 저장됩니다."}</p>
    <main id="main" className={styles.main}>
      {view === "discover" && <>
        <TasteHero key={state.userId} movies={movies} logs={state.logs} user={state.userId} onRecord={() => chooseFilm()} onOpenMovie={movie => openMovie(movie)} onDiary={() => navigate("diary")} />
        <div className={styles.archiveStrip}><span className={styles.stripTitle}><span className={styles.liveDot} />{accountName}’s ARCHIVE</span><span><strong>{myLogs.length.toString().padStart(2, "0")}</strong>기록한 영화</span><span><strong>{rated.length ? (rated.reduce((a, l) => a + (l.rating ?? 0), 0) / rated.length).toFixed(1) : "—"}</strong>나의 평균 별점</span><span><strong>{watchlist.length.toString().padStart(2, "0")}</strong>보고 싶은 영화</span><button onClick={() => navigate("friends")}><span className={styles.stackedDots}>↗</span>친구의 추천 <b>{myRecommendations.length}</b><ArrowRight size={17} /></button></div>
        <section className={styles.discoverSection} aria-labelledby="discover-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>01 / FIND YOUR NEXT SCENE</span><h2 id="discover-title">다음 장면을 골라볼까요?<span>({filter === "all" && libraryMode === "tmdb" && catalog.result?.status === "success" ? catalog.result.data.pagination.totalResults.toLocaleString("ko-KR") : films.length.toString().padStart(2, "0")})</span></h2></div><label className={styles.search}><Search size={18} /><input aria-label="영화 검색" placeholder={libraryMode === "tmdb" ? "영화 제목 검색" : "예시 영화 제목, 감독 검색"} maxLength={100} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />{query && <button aria-label="검색 지우기" onClick={() => setQuery("")}>×</button>}</label></div><CatalogMode mode={libraryMode} onChange={changeLibrary} /><div className={styles.filterBar}><div className={styles.chips}>{[["all", "전체 영화"], ["watched", "내가 본 영화"], ["watchlist", "보고 싶은 영화"]].map(([id, label]) => <button key={id} className={filter === id ? styles.selectedChip : ""} onClick={() => setFilter(id)}>{label}</button>)}</div><span>CURATED LIBRARY <SlidersHorizontal size={14} /></span></div>
          {libraryMode === "tmdb" && filter === "all" && <CatalogFeedback result={catalog.result} onRetry={catalog.retry} onDemo={() => changeLibrary("sample")} />}<div className={styles.movieGrid}>{films.map((movie, i) => { const log = myLogs.find(l => l.movieId === movie.id); const saved = watchlist.some(w => w.movieId === movie.id); return <article className={styles.movieCard} key={movie.id}><button className={styles.posterButton} onClick={() => openMovie(movie)} aria-label={`${movie.title} 기록 열기`}><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={movie.poster} alt={`${movie.title} 포스터`} /><span className={styles.posterNumber}>{String(i + 1).padStart(2, "0")}</span><span className={styles.posterHover}>VIEW THE SCENE <ArrowUpRight size={19} /></span>{log && <span className={styles.watchedLabel}>LOGGED ✓</span>}</button><div className={styles.movieTitle}><button onClick={() => openMovie(movie)}>{movie.title}</button><button className={styles.bookmark} aria-label={`${movie.title} ${saved ? "관심 목록에서 제거" : "관심 목록에 추가"}`} aria-pressed={saved} onClick={() => toggleWatchlist(movie.id)}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></button></div><p>{movie.year ?? "개봉일 미정"}<span>·</span>{movie.director ?? movie.genres.join(" / ")}</p><button className={`${styles.cardRating} ${log ? styles.hasRating : ""}`} onClick={() => openMovie(movie)}>{log ? <><Star size={14} fill="currentColor" />{log.rating?.toFixed(1) ?? "봤어요"}<small>나의 기록</small></> : <><Plus size={14} />나의 별점 남기기</>}</button></article>; })}</div>
          {films.length === 0 && (filter !== "all" || libraryMode === "sample" || catalog.result?.status === "success") && <Empty title="찾는 영화가 없어요">{libraryMode === "sample" ? "현재 예시 영화 6편에서 검색해요. TMDB 영화 탭에서는 실제 영화 제목을 검색할 수 있어요." : "다른 영화 제목으로 검색해 보세요."}</Empty>}{libraryMode === "tmdb" && filter === "all" && <CatalogPagination result={catalog.result} page={page} onChange={setPage} />}
        </section>
        <section className={styles.bottomFeatures}><button className={styles.calendarFeature} onClick={() => navigate("diary")}><span className={styles.eyebrow}>02 / DAYS IN FILM</span><h2>한 달의 장면들.</h2><p>달력 위에 쌓이는 나의 영화 기록.</p><span className={styles.featureArrow}><ArrowUpRight /></span><div className={styles.miniCalendar}>{Array.from({ length: 14 }, (_, i) => <div key={i}>{i === 4 || i === 9 ? <Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={movies[i === 4 ? 0 : 3].poster} alt="" /> : <span>{i + 1}</span>}</div>)}</div></button><button className={styles.printFeature} onClick={() => navigate("print")}><span className={styles.eyebrow}>SCENELOG PRESS / PRINT YOUR TASTE</span><h2>좋아하는 영화들,<br />한 장으로 <em>쭈욱.</em></h2><p>별점과 티어를 나만의 프린트로 저장하세요.</p><span className={styles.featureArrow}><ArrowUpRight /></span><div className={styles.tinyPrinter}><Printer size={74} strokeWidth={1} /><span>MY SCENE<br />COLLECTION.</span></div></button></section>
      </>}

      {view === "diary" && <section className={styles.pageSection}><div className={styles.pageHeading}><div><p className={styles.eyebrow}>02 / DAYS IN FILM</p><h1>달력에 남은 <em>장면들.</em></h1><p>본 날짜에 포스터를 붙이고, 그날의 감상을 꺼내보세요.</p></div><button className={styles.blackButton} onClick={() => chooseFilm()}><Plus size={17} />관람 기록</button></div><div className={styles.calendarHeading}><div className={styles.monthTitle}><strong>{monthNumber.toString().padStart(2, "0")}</strong><span>{year}<br />MY FILM DIARY</span></div><div className={styles.monthActions}><span>이번 달 {monthLogs.length}회 관람</span><button aria-label="이전 달" className={styles.iconButton} onClick={() => shiftMonth(-1)}><ChevronLeft size={20} /></button><button className={styles.outlineButton} onClick={() => setMonth(today().slice(0, 7))}>이번 달</button><button aria-label="다음 달" className={styles.iconButton} onClick={() => shiftMonth(1)}><ChevronRight size={20} /></button></div></div><FilmCalendar month={month} logs={state.logs} movies={movies} user={state.userId} covers={state.calendarCovers?.[state.userId]} onDay={setSelectedDay} /><p className={styles.helper}>날짜를 눌러 기록을 보거나 대표 포스터를 선택하세요. 관람일이 없는 영화는 컬렉션에 보관돼요.</p></section>}

      {view === "collection" && <section className={styles.pageSection}><div className={styles.pageHeading}><div><p className={styles.eyebrow}>03 / COLLECTED BY {accountName.toUpperCase()}</p><h1>나의 영화 <em>컬렉션.</em></h1><p>좋아하는 만큼, 나만의 순서로. {myLogs.length}편의 취향이 모였어요.</p></div><button className={styles.blackButton} onClick={() => navigate("print")}><Printer size={17} />프린트 만들기</button></div><div className={styles.collectionToolbar}><div className={styles.segmented}>{[["stamps", "우표", Grid2X2], ["vhs", "기록", List], ["tier", "티어", SlidersHorizontal]].map(([id, label, Icon]) => { const ControlIcon = Icon as typeof Grid2X2; return <button key={String(id)} onClick={() => setCollectionView(String(id))} className={collectionView === id ? styles.selectedSegment : ""}><ControlIcon size={15} />{String(label)}</button>; })}</div>{collectionView !== "vhs" && <select aria-label="컬렉션 정렬" value={sort} onChange={e => setSort(e.target.value)}><option value="rating">별점 높은 순</option><option value="recent">최근 관람순</option></select>}</div>
        {collectionView === "stamps" && <StampCollection user={state.userId} key={state.userId} movies={movies} logs={sortedLogs} onOpen={openMovie} />}
        {collectionView === "vhs" && <VhsArchive key={state.userId} movies={movies} logs={state.logs} user={state.userId} onOpen={openMovie} onRewatch={movie => openMovie(movie, undefined, true)} />}
        {collectionView === "tier" && <div className={styles.tierBoard}>{tiers.map(tier => <div className={styles.tierRow} key={tier}><strong className={styles.tierLetter} data-tier={tier}>{tier}</strong><div>{sortedLogs.filter(l => (l.tier ?? ratingToTier(l.rating)) === tier && (l.rating !== null || l.tier)).map(log => { const movie = movies.find(m => m.id === log.movieId); if (!movie) return null; return <div className={styles.tierFilm} key={log.id}><button onClick={() => openMovie(movie)} aria-label={`${movie.title} 기록 열기`}><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={movie.poster} alt={movie.title} /></button><select aria-label={`${movie.title} 티어`} disabled={saving} value={tier} onChange={e => { const tier = e.target.value as Tier; void update(s => ({ ...s, logs: s.logs.map(l => l.id === log.id ? { ...l, tier } : l) })); }}>{tiers.map(t => <option key={t}>{t}</option>)}</select></div>; })}</div></div>)}</div>}
        {myLogs.length === 0 && <Empty title="아직 비어 있는 컬렉션">첫 영화에 별점을 남겨보세요.</Empty>}
      </section>}

      {view === "themes" && <section className={styles.pageSection}><div className={styles.pageHeading}><div><p className={styles.eyebrow}>04 / A DIFFERENT POINT OF VIEW</p><h1>좋아하는 데는 <em>이유가 있지.</em></h1><p>영화의 별점과는 별개로, 음악과 장면과 이야기에 점수를.</p></div></div><div className={styles.themeCards}>{themes.map((t, i) => <button key={t.key} className={`${styles.themeCard} ${theme === t.key ? styles.activeTheme : ""}`} onClick={() => setTheme(t.key)}><span>0{i + 1} / {t.english}</span><strong>{t.label}</strong><span className={styles.themeSymbol}>{i === 0 ? "♫" : i === 1 ? "▣" : "Aa"}</span><ArrowUpRight size={24} /></button>)}</div><div className={styles.sectionHeading}><h2>나의 {themes.find(t => t.key === theme)?.label} 랭킹 <span>({themeItems.length})</span></h2><button className={styles.textButton} onClick={() => chooseFilm()}>테마 평가 추가 <Plus size={16} /></button></div><div className={styles.themeRankings}>{themeItems.map((item, i) => <button className={styles.themeRank} key={item.movie.id} onClick={() => openMovie(item.movie)}><span className={styles.rankNumber}>{String(i + 1).padStart(2, "0")}</span><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={item.movie.poster} alt="" /><span className={styles.rankName}><strong>{item.movie.title}</strong><small>{item.movie.year ?? "개봉일 미정"} / {item.movie.director ?? item.movie.genres.join(" / ")}</small></span><span className={styles.rankOverall}>전체 별점 {item.log.rating?.toFixed(1) ?? "—"}</span><b>{item.score?.toFixed(1) ?? "—"}</b><ArrowUpRight size={21} /></button>)}</div>{themeItems.length === 0 && <Empty title="이 테마의 첫 영화를 골라보세요">영화 기록에서 ‘테마별로 조금 더 자세히’를 펼쳐 평가할 수 있어요.</Empty>}</section>}

      {view === "friends" && <Empty title="친구 기능을 준비하고 있어요">지금은 개인 기록과 보고 싶은 영화가 계정에 저장됩니다. 실제 친구 연결은 다음 단계에 추가됩니다.</Empty>}
      {view === "print" && <PrintRoom key={state.userId} movies={movies} logs={myLogs} user={accountName} notify={notify} />}
    </main>
    <footer className={styles.footer}><div><strong>SceneLog<span>®</span></strong><p>COLLECT SCENES. KEEP YOUR POINT OF VIEW.</p></div><div><span>YOUR PERSONAL FILM ARCHIVE</span><small>개인 평점·리뷰·찜은 내 계정에 저장됩니다. 친구 간 공유는 아직 제공하지 않습니다.<br />영화 정보: <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a> · 외부 평점과 내 별점은 별도예요.<br />This product uses the TMDB API but is not endorsed or certified by TMDB.</small></div><button className={styles.textButton} onClick={async () => { try { notify("사진을 포함한 기록 백업을 만들고 있어요."); const { journalPhotoBackup } = await import("@/lib/journal-assets"); const journals = { [state.userId]: readAccountJournals(localStorage, state.userId) }; const ids = Object.values(journals).flatMap(books => Object.values(books ?? {}).flatMap(book => book.pages.flatMap(page => page.items.flatMap(item => item.assetId ? [item.assetId] : [])))); const journalAssets = await journalPhotoBackup(ids); const blob = new Blob([JSON.stringify({ ...state, journals, journalAssets }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "scenelog-backup.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify("사진까지 포함한 기록 백업을 저장했어요."); } catch { notify("사진 백업을 읽지 못했어요. 이 브라우저의 저장 공간을 확인해 주세요."); } }}>기록 백업 ↗</button></footer>
    {toast && <div className={styles.toast} role="status"><Check size={17} />{toast}</div>}
    {picker && <Modal title="어떤 영화를 봤나요?" onClose={() => setPicker(false)}><CatalogMode mode={libraryMode} onChange={changeLibrary} /><label className={styles.search}><Search size={18} /><input autoFocus aria-label="기록할 영화 검색" placeholder={libraryMode === "tmdb" ? "영화 제목 검색" : "예시 영화 제목 또는 감독"} maxLength={100} value={pickerQuery} onChange={e => { setPickerQuery(e.target.value); setPickerPage(1); }} /></label>{libraryMode === "tmdb" && <CatalogFeedback result={pickerCatalog.result} onRetry={pickerCatalog.retry} onDemo={() => changeLibrary("sample")} />}<div className={styles.pickerList}>{pickerFilms.map(m => <button key={m.id} onClick={() => { setPicker(false); openMovie(m, undefined, true, pickerDate); }}><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={m.poster} alt="" /><span><strong>{m.title}</strong><small>{m.year ?? "개봉일 미정"} · {m.director}</small></span><Plus size={19} /></button>)}</div>{libraryMode === "tmdb" && <CatalogPagination result={pickerCatalog.result} page={pickerPage} onChange={setPickerPage} />}{pickerFilms.length === 0 && (libraryMode === "sample" || pickerCatalog.result?.status === "success") && <p className={styles.helper}>찾는 영화가 없어요. 다른 제목을 입력해 주세요.</p>}</Modal>}
    {detailLoading && <Modal title="영화 상세를 불러오는 중" onClose={cancelDetail}><p role="status" className={styles.helper}>포스터와 감독 정보를 가져오고 있어요.</p></Modal>}
    {selected && <RecordDialog key={`${selected.movie.id}-${selected.entry?.id ?? "new"}`} movie={selected.movie} movies={movies} personal saving={saving} saveError={error} entry={selected.entry} initialDate={selected.date} state={state} onSave={saveLog} onClose={() => setSelected(null)} onWatchlist={() => toggleWatchlist(selected.movie.id)} onRecommend={() => navigate("friends")} onRewatch={() => setSelected({ movie: selected.movie, date: today() })} onComment={(body, spoiler) => update(s => ({ ...s, comments: [...s.comments, { id: newId(), userId: s.userId, movieId: selected.movie.id, scope: "public", body, spoiler, score: myLogs.find(l => l.movieId === selected.movie.id)?.rating ?? null, createdAt: new Date().toISOString() }] }))} />}
    {selectedDay && <Modal title={`${Number(selectedDay.slice(5, 7))}월 ${Number(selectedDay.slice(8))}일의 장면`} onClose={() => setSelectedDay(null)}><DayRecords date={selectedDay} logs={state.logs} movies={movies} user={state.userId} covers={state.calendarCovers?.[state.userId]} onCover={logId => update(s => ({ ...s, calendarCovers: { ...s.calendarCovers, [s.userId]: { ...s.calendarCovers?.[s.userId], [selectedDay]: logId } } }))} onOpen={(movie, log) => { setSelectedDay(null); openMovie(movie, log); }} />{selectedDayLogs.length === 0 && <Empty title="아직 붙이지 않은 포스터">이날 본 영화가 있다면 기록해 보세요.</Empty>}<button className={styles.redButton} disabled={selectedDay > today()} onClick={() => { chooseFilm(selectedDay); setSelectedDay(null); }}><Plus size={17} />{selectedDay > today() ? "관람 후에 기록할 수 있어요" : "이 날짜에 영화 기록"}</button></Modal>}
  </div>;
}
