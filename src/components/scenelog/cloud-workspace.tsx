"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { movies as sampleCatalog } from "@/data/movies";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, BookOpen, CalendarDays, ChartPie, Check, ChevronLeft, ChevronRight, Compass, LibraryBig, List, Users, Plus, Printer, Search, SlidersHorizontal } from "lucide-react";
import type { ArchiveMovie as Movie } from "@/lib/archive-movies";
import { latestLogs, newId, themes, today, type FilmLog, type ThemeKey, type SceneState } from "@/lib/scene-store";
import { readAccountJournals } from "@/lib/account-journals";
import { getPrintItems } from "@/lib/print-sheet";
import { Empty, Modal } from "./ui";
import { normalizeMovie, mergeMovieCatalog } from "@/lib/archive-movies";
import { useMovies } from "@/hooks/use-movies";
import { fetchMovieDetail } from "@/lib/api/movies";
import { MainNav } from "./main-nav";
import { sortLogs } from "@/lib/tier-view";
import { Segmented } from "./segmented";
import { TasteHero } from "./taste-hero";
import { HomeFeatures } from "./home-features";
import { WorkspaceSkeleton } from "./workspace-skeleton";
import { FilmCalendar, DayRecords } from "./film-calendar";
import { CatalogMode, CatalogFeedback, CatalogPagination, type LibraryMode } from "./catalog-controls";
import styles from "./scenelog.module.css";
import type { User } from "@supabase/supabase-js";
import { AuthControls } from "@/components/auth/auth-controls";
import { GlobalSearch } from "@/components/search/global-search";
import { useOwnProfile } from "@/hooks/use-own-profile";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { RequestBadge } from "@/components/social/request-badge";
import { useFriendRequests } from "@/hooks/use-friend-requests";
import type { OwnProfile } from "@/types/social";

// Keep editors and secondary views out of the discovery bundle.
const RecordDialog = dynamic(() => import("./record-dialog").then(module => module.RecordDialog), { loading: () => <LoadingIndicator /> });
const PrintRoom = dynamic(() => import("./print-room").then(module => module.PrintRoom), { loading: () => <LoadingIndicator /> });
const VhsArchive = dynamic(() => import("./collection-views").then(module => module.VhsArchive), { loading: () => <LoadingIndicator /> });
const TierBoard = dynamic(() => import("./tier-board").then(module => module.TierBoard), { loading: () => <LoadingIndicator /> });
const FilmJournals = dynamic(() => import("./film-journal").then(module => module.FilmJournals), { loading: () => <LoadingIndicator /> });
const FriendsTab = dynamic(() => import("@/components/social/friends-tab").then(module => module.FriendsTab), { loading: () => <LoadingIndicator /> });
const UserProfileDialog = dynamic(() => import("@/components/social/user-profile-dialog").then(module => module.UserProfileDialog), { loading: () => <LoadingIndicator /> });

const sampleMovies = sampleCatalog.map(normalizeMovie);

type WorkspaceStore = {
  state: SceneState | null;
  update: (fn: (state: SceneState) => SceneState) => Promise<boolean>;
  saveRecord: (movie: Movie, log: FilmLog) => Promise<boolean>;
  saveWatchlist: (movie: Movie, saved: boolean) => Promise<boolean>;
  storageError?: boolean;
  saving?: boolean;
  error?: string | null;
  reload?: () => void;
};

const views = [
  { id: "discover", label: "발견", short: "발견", icon: Compass }, { id: "diary", label: "관람일지", short: "일지", icon: CalendarDays },
  { id: "collection", label: "컬렉션", short: "컬렉션", icon: LibraryBig }, { id: "themes", label: "테마별 취향", short: "취향", icon: ChartPie }, { id: "friends", label: "친구들", short: "친구", icon: Users },
] as const;type View = (typeof views)[number]["id"] | "print";
function subscribeView(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
function readView(): View {
  const hash = window.location.hash.slice(1);
  return [...views.map(v => v.id), "print"].includes(hash) ? hash as View : "discover";
}

function WorkspaceHeader({ user, view, navigate, saving = false, stats, onOpenMovie, profile, incomingRequests, accountLoading = false }: {
  user: User; view: View; navigate: (view: View) => void; saving?: boolean;
  stats?: { ratedMovies: number; reviews: number };
  onOpenMovie?: (movie: Movie) => void;
  profile?: OwnProfile; incomingRequests: number; accountLoading?: boolean;
}) {
  const [profileId, setProfileId] = useState<string | null>(null);
  return <>
    <div className={styles.topLine}><span>A PERSONAL FILM ARCHIVE.</span><span>COLLECT SCENES. KEEP YOUR POINT OF VIEW.</span><span>MY CLOUD ARCHIVE <i /></span></div>
    <header className={styles.header}><div className={styles.headerInner}>
      <a href="#discover" className={styles.logo} onClick={e => { e.preventDefault(); navigate("discover"); }} aria-label="SceneLog 홈"><span className={styles.logoMark}><i /><i /><i /><i /></span>SceneLog<span className={styles.registered}>®</span></a>
      <MainNav items={views} view={view} navigate={navigate} labelFor={item => item.id === "friends" && incomingRequests > 0 ? `친구들, 받은 친구 요청 ${incomingRequests}개` : item.label} extra={item => item.id === "friends" ? <RequestBadge count={incomingRequests} /> : null} />
      <div className={styles.headerActions}><button className={`${styles.printNav} ${view === "print" ? styles.activePrintNav : ""}`} aria-label="프린트룸" onClick={() => navigate("print")}><Printer size={17} /><span>프린트룸</span></button>{onOpenMovie ? <GlobalSearch userId={user.id} onMovie={onOpenMovie} onUser={setProfileId} /> : <button type="button" className={styles.printNav} aria-label="통합 검색 준비 중" disabled><Search size={19} /></button>}<AuthControls user={user} profile={profile} loading={accountLoading} disabled={saving} stats={stats} onOpenCollection={() => navigate("collection")} /></div>
    </div></header>
    {profileId && onOpenMovie && <UserProfileDialog key={profileId} userId={user.id} profileId={profileId} onClose={() => setProfileId(null)} onMovie={onOpenMovie} />}
  </>;
}

export function CloudWorkspace({ user, store }: { user: User; store: WorkspaceStore }) {
  return <SceneLogWorkspace store={store} user={user} />;
}
function SceneLogWorkspace({ store, user }: { store: WorkspaceStore; user: User }) {
  const { state, update, saveRecord, saveWatchlist, storageError, saving = false, error, reload } = store;
  const { profile, loading: profileLoading } = useOwnProfile(user.id);
  const incomingRequests = useFriendRequests(user.id);
  const accountName = profile?.displayName || user?.user_metadata?.full_name || "나의 계정";
  const view = useSyncExternalStore(subscribeView, readView, () => "discover" as View);
  // Moving to a menu further right slides the page in from the right, and the other way round. Derived while rendering, so no ref is read.
  const [pane, setPane] = useState<{ view: View; dir: "forward" | "back" | "fade" }>({ view, dir: "fade" });
  if (pane.view !== view) {
    const order = [...views.map(item => item.id), "print"] as View[];
    setPane({ view, dir: order.indexOf(view) > order.indexOf(pane.view) ? "forward" : "back" });
  }
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
  const [collectionView, setCollectionView] = useState("vhs");
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
  const liveMovies = useMemo(() => catalog.result?.status === "success" ? catalog.result.data.data.map(normalizeMovie) : [], [catalog.result]);
  const pickerMovies = useMemo(() => pickerCatalog.result?.status === "success" ? pickerCatalog.result.data.data.map(normalizeMovie) : [], [pickerCatalog.result]);
  const movies = useMemo(() => mergeMovieCatalog(sampleMovies, state?.catalog ?? [], liveMovies, pickerMovies), [state?.catalog, liveMovies, pickerMovies]);
  if (!state) return <div className={styles.app}>
    <WorkspaceHeader user={user} profile={profile} incomingRequests={incomingRequests} accountLoading={(!state && !error) || profileLoading} view={view} navigate={navigate} />
    {error
      ? <main id="main" className={styles.loading}><p role="alert">{error}</p><button className={styles.blackButton} onClick={reload}>다시 불러오기</button></main>
      : <WorkspaceSkeleton view={view} />}
  </div>;
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
    const movie = selected?.movie.id === movieId ? selected.movie : movies.find(item => item.id === movieId);
    if (!movie) return;
    const success = await saveWatchlist(movie, !exists);
    if (!success) return;
    notify(exists ? "보고 싶은 영화에서 꺼냈어요." : "보고 싶은 영화에 담았어요.");
  }
  function chooseFilm(date?: string) { setPickerPage(1); setPickerDate(date); setPickerQuery(""); setPicker(true); }
  async function saveLog(log: FilmLog) {
    const movie = selected?.movie.id === log.movieId ? selected.movie : movies.find(movie => movie.id === log.movieId);
    if (!movie) return;
    const success = await saveRecord(movie, log);
    if (!success) return;
    setSelected(null); notify("기록을 저장했어요.");
  }
  function shiftMonth(offset: number) { const [year, m] = month.split("-").map(Number); const d = new Date(year, m - 1 + offset, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  const sortedLogs = sortLogs(myLogs, "rating");
  const monthLogs = allMyLogs.filter(l => l.watchedOn.startsWith(month));
  const themeItems = getPrintItems(movies, myLogs, theme, "rating");
  const selectedDayLogs = allMyLogs.filter(l => l.watchedOn === selectedDay);
  const year = Number(month.slice(0, 4)); const monthNumber = Number(month.slice(5, 7));

  return <div className={styles.app}>
    <WorkspaceHeader user={user} profile={profile} incomingRequests={incomingRequests} accountLoading={(!state && !error) || profileLoading} view={view} navigate={navigate} saving={saving} stats={{ ratedMovies: rated.length, reviews: allMyLogs.filter(log => log.review.trim().length > 0).length }} onOpenMovie={movie => openMovie(movie)} />
    {storageError && <p className={styles.storageWarning} role="alert">브라우저 저장소에 접근할 수 없어 새로고침 시 기록이 사라질 수 있어요.</p>}
    {error && <div className={styles.storageWarning} role="alert">{error} <button onClick={reload} disabled={saving}>최신 기록 불러오기</button></div>}
    {saving && <p className="sr-only" role="status">기록을 저장하는 중입니다…</p>}
    <main id="main" className={styles.main}>
      <div className={styles.viewPane} data-dir={pane.dir} key={view}>
      {view === "discover" && <>
        <TasteHero key={state.userId} movies={movies} logs={state.logs} user={state.userId} onRecord={() => chooseFilm()} onOpenMovie={movie => openMovie(movie)} onDiary={() => navigate("diary")} />
        <div className={styles.archiveStrip}><span className={styles.stripTitle}><span className={styles.liveDot} />{accountName}’s ARCHIVE</span><span><strong>{myLogs.length.toString().padStart(2, "0")}</strong>기록한 영화</span><span><strong>{rated.length ? (rated.reduce((a, l) => a + (l.rating ?? 0), 0) / rated.length).toFixed(1) : "—"}</strong>나의 평균 별점</span><span><strong>{watchlist.length.toString().padStart(2, "0")}</strong>보고 싶은 영화</span><button onClick={() => navigate("friends")}><Users size={19} strokeWidth={1.9} aria-hidden="true" />친구의 추천 <b>{myRecommendations.length}</b><ArrowRight size={17} /></button></div>
        <section className={styles.discoverSection} aria-labelledby="discover-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>01 / FIND YOUR NEXT SCENE</span><h2 id="discover-title">다음 장면을 골라볼까요?<span>({filter === "all" && libraryMode === "tmdb" && catalog.result?.status === "success" ? catalog.result.data.pagination.totalResults.toLocaleString("ko-KR") : films.length.toString().padStart(2, "0")})</span></h2></div><label className={styles.search}><Search size={18} /><input aria-label="영화 검색" placeholder={libraryMode === "tmdb" ? "영화 제목 검색" : "예시 영화 제목, 감독 검색"} maxLength={100} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />{query && <button aria-label="검색 지우기" onClick={() => setQuery("")}>×</button>}</label></div>{libraryMode === "sample" && <CatalogMode mode={libraryMode} onChange={changeLibrary} />}<div className={styles.filterBar}><div className={styles.chips}>{[["all", "전체 영화"], ["watched", "내가 본 영화"], ["watchlist", "보고 싶은 영화"]].map(([id, label]) => <button key={id} aria-pressed={filter === id} className={filter === id ? styles.selectedChip : ""} onClick={() => setFilter(id)}>{label}{id !== "all" && <i>{id === "watched" ? myLogs.length : watchlist.length}</i>}</button>)}</div><span>CURATED LIBRARY <SlidersHorizontal size={14} /></span></div>
          {libraryMode === "tmdb" && filter === "all" && <CatalogFeedback result={catalog.result} onRetry={catalog.retry} onDemo={() => changeLibrary("sample")} />}<div className={styles.movieGrid}>{films.map((movie, i) => { const log = myLogs.find(l => l.movieId === movie.id); const saved = watchlist.some(w => w.movieId === movie.id); return <article className={styles.movieCard} key={movie.id}><button className={styles.posterButton} onClick={() => openMovie(movie)} aria-label={`${movie.title} 기록 열기`}><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={movie.poster} alt={`${movie.title} 포스터`} /><span className={styles.posterNumber}>{String(i + 1).padStart(2, "0")}</span><span className={styles.posterHover}>VIEW THE SCENE <ArrowUpRight size={19} /></span>{log && <span className={styles.watchedLabel}>기록함{log.rating !== null && <b>★ {log.rating.toFixed(1)}</b>}</span>}</button><div className={styles.movieTitle}><button onClick={() => openMovie(movie)}>{movie.title}</button><button className={styles.bookmark} aria-label={`${movie.title} ${saved ? "관심 목록에서 제거" : "관심 목록에 추가"}`} aria-pressed={saved} onClick={() => toggleWatchlist(movie.id)}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></button></div><p>{movie.year ?? "개봉일 미정"}<span>·</span>{movie.director ?? movie.genres.join(" / ")}</p></article>; })}</div>
          {films.length === 0 && (filter !== "all" || libraryMode === "sample" || catalog.result?.status === "success") && <Empty title="찾는 영화가 없어요">다른 영화 제목으로 검색해 보세요.</Empty>}{libraryMode === "tmdb" && filter === "all" && <CatalogPagination result={catalog.result} page={page} onChange={setPage} />}
        </section>
        <HomeFeatures movies={movies} logs={state.logs} user={state.userId} onDiary={() => navigate("diary")} onPrint={() => navigate("print")} />
      </>}

      {view === "diary" && <section className={styles.pageSection}><div className={styles.pageHeading}><div><p className={styles.eyebrow}>02 / DAYS IN FILM</p><h1>달력에 남은 <em>장면들.</em></h1><p>본 날짜에 포스터를 붙이고, 그날의 감상을 꺼내보세요.</p></div><button className={styles.blackButton} onClick={() => chooseFilm()}><Plus size={17} />관람 기록</button></div><div className={styles.calendarHeading}><div className={styles.monthTitle}><strong>{monthNumber.toString().padStart(2, "0")}</strong><span>{year}<br />MY FILM DIARY</span></div><div className={styles.monthActions}><span>이번 달 {monthLogs.length}회 관람</span><button aria-label="이전 달" className={styles.iconButton} onClick={() => shiftMonth(-1)}><ChevronLeft size={20} /></button><button className={styles.outlineButton} onClick={() => setMonth(today().slice(0, 7))}>이번 달</button><button aria-label="다음 달" className={styles.iconButton} onClick={() => shiftMonth(1)}><ChevronRight size={20} /></button></div></div><FilmCalendar month={month} logs={state.logs} movies={movies} user={state.userId} covers={state.calendarCovers?.[state.userId]} onDay={setSelectedDay} /><p className={styles.helper}>날짜를 눌러 기록을 보거나 대표 포스터를 선택하세요. 관람일이 없는 영화는 컬렉션에 보관돼요.</p></section>}

      {view === "collection" && <section className={styles.pageSection}><div className={styles.pageHeading}><div><p className={styles.eyebrow}>03 / COLLECTED BY {accountName.toUpperCase()}</p><h1>나의 영화 <em>컬렉션.</em></h1><p>좋아하는 만큼, 나만의 순서로. {myLogs.length}편의 취향이 모였어요.</p></div></div><div className={styles.collectionToolbar}><Segmented label="컬렉션 보기" items={[{ id: "vhs", label: "기록", icon: List }, { id: "diary", label: "다이어리", icon: BookOpen }, { id: "tier", label: "티어", icon: SlidersHorizontal }]} value={collectionView} onChange={setCollectionView} /></div>
        {collectionView === "diary" && <FilmJournals key={state.userId} movies={movies} logs={sortedLogs} user={state.userId} />}
        {collectionView === "vhs" && <VhsArchive key={state.userId} movies={movies} logs={state.logs} user={state.userId} onOpen={openMovie} onRewatch={movie => openMovie(movie, undefined, true)} />}
        {collectionView === "tier" && <TierBoard movies={movies} logs={myLogs} disabled={saving} onOpen={movie => openMovie(movie)} onMove={(logId, tier) => { const log = myLogs.find(item => item.id === logId); const movie = log && movies.find(item => item.id === log.movieId); if (log && movie) void saveRecord(movie, { ...log, tier }); }} />}
        {myLogs.length === 0 && collectionView !== "diary" && <Empty title="아직 비어 있는 컬렉션">첫 영화에 별점을 남겨보세요.</Empty>}
        <div className={styles.collectionPrint}><button className={styles.blackButton} onClick={() => navigate("print")}><Printer size={17} />프린트 만들기</button></div>
      </section>}

      {view === "themes" && <section className={styles.pageSection}><div className={styles.pageHeading}><div><p className={styles.eyebrow}>04 / A DIFFERENT POINT OF VIEW</p><h1>좋아하는 데는 <em>이유가 있지.</em></h1><p>영화의 별점과는 별개로, 음악과 장면과 이야기에 점수를.</p></div></div><div className={styles.themeCards}>{themes.map((t, i) => <button key={t.key} className={`${styles.themeCard} ${theme === t.key ? styles.activeTheme : ""}`} onClick={() => setTheme(t.key)}><span>0{i + 1} / {t.english}</span><strong>{t.label}</strong><span className={styles.themeSymbol}>{i === 0 ? "♫" : i === 1 ? "▣" : "Aa"}</span><ArrowUpRight size={24} /></button>)}</div><div className={styles.sectionHeading}><h2>나의 {themes.find(t => t.key === theme)?.label} 랭킹 <span>({themeItems.length})</span></h2><button className={styles.textButton} onClick={() => chooseFilm()}>테마 평가 추가 <Plus size={16} /></button></div><div className={styles.themeRankings}>{themeItems.map((item, i) => <button className={styles.themeRank} key={item.movie.id} onClick={() => openMovie(item.movie)}><span className={styles.rankNumber}>{String(i + 1).padStart(2, "0")}</span><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={item.movie.poster} alt="" /><span className={styles.rankName}><strong>{item.movie.title}</strong><small>{item.movie.year ?? "개봉일 미정"} / {item.movie.director ?? item.movie.genres.join(" / ")}</small></span><span className={styles.rankOverall}>전체 별점 {item.log.rating?.toFixed(1) ?? "—"}</span><b>{item.score?.toFixed(1) ?? "—"}</b><ArrowUpRight size={21} /></button>)}</div>{themeItems.length === 0 && <Empty title="이 테마의 첫 영화를 골라보세요">영화 기록에서 ‘테마별로 조금 더 자세히’를 펼쳐 평가할 수 있어요.</Empty>}</section>}

      {view === "friends" && <FriendsTab key={state.userId} userId={state.userId} incomingRequests={incomingRequests} onOpenMovie={movie => openMovie(movie)} />}
      {view === "print" && <PrintRoom key={state.userId} movies={movies} logs={myLogs} user={accountName} notify={notify} />}
      </div>
    </main>
    <footer className={styles.footer}><div><strong>SceneLog<span>®</span></strong><p>COLLECT SCENES.<span className={styles.sentenceGap} /> KEEP YOUR POINT OF VIEW.</p></div><div><span>YOUR PERSONAL FILM ARCHIVE</span><small>This product uses the TMDB API but is not endorsed or certified by TMDB.</small></div><button className={styles.textButton} onClick={async () => { try { notify("사진을 포함한 기록 백업을 만들고 있어요."); const { journalPhotoBackup } = await import("@/lib/journal-assets"); const journals = { [state.userId]: readAccountJournals(localStorage, state.userId) }; const ids = Object.values(journals).flatMap(books => Object.values(books ?? {}).flatMap(book => book.pages.flatMap(page => page.items.flatMap(item => item.assetId ? [item.assetId] : [])))); const journalAssets = await journalPhotoBackup(ids); const blob = new Blob([JSON.stringify({ ...state, journals, journalAssets }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "scenelog-backup.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify("사진까지 포함한 기록 백업을 저장했어요."); } catch { notify("사진 백업을 읽지 못했어요. 이 브라우저의 저장 공간을 확인해 주세요."); } }}>기록 백업 ↗</button></footer>
    {toast && <div className={styles.toast} role="status"><Check size={17} />{toast}</div>}
    {picker && <Modal title="어떤 영화를 봤나요?" onClose={() => setPicker(false)}>{libraryMode === "sample" && <CatalogMode mode={libraryMode} onChange={changeLibrary} />}<label className={styles.search}><Search size={18} /><input autoFocus aria-label="기록할 영화 검색" placeholder={libraryMode === "tmdb" ? "영화 제목 검색" : "예시 영화 제목 또는 감독"} maxLength={100} value={pickerQuery} onChange={e => { setPickerQuery(e.target.value); setPickerPage(1); }} /></label>{libraryMode === "tmdb" && <CatalogFeedback result={pickerCatalog.result} onRetry={pickerCatalog.retry} onDemo={() => changeLibrary("sample")} />}<div className={styles.pickerList}>{pickerFilms.map(m => <button key={m.id} onClick={() => { setPicker(false); openMovie(m, undefined, true, pickerDate); }}><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={m.poster} alt="" /><span><strong>{m.title}</strong><small>{m.year ?? "개봉일 미정"} · {m.director}</small></span><Plus size={19} /></button>)}</div>{libraryMode === "tmdb" && <CatalogPagination result={pickerCatalog.result} page={pickerPage} onChange={setPickerPage} />}{pickerFilms.length === 0 && (libraryMode === "sample" || pickerCatalog.result?.status === "success") && <p className={styles.helper}>찾는 영화가 없어요. 다른 제목을 입력해 주세요.</p>}</Modal>}
    {detailLoading && <Modal title="영화 상세를 불러오는 중" onClose={cancelDetail}><p role="status" className={styles.helper}>포스터와 감독 정보를 가져오고 있어요.</p></Modal>}
    {selected && <RecordDialog key={`${selected.movie.id}-${selected.entry?.id ?? "new"}`} movie={selected.movie} movies={movies} personal saving={saving} saveError={error} entry={selected.entry} initialDate={selected.date} state={state} onSave={saveLog} onClose={() => setSelected(null)} onRecommend={() => navigate("friends")} onRewatch={() => setSelected({ movie: selected.movie, date: today() })} onComment={(body, spoiler) => update(s => ({ ...s, comments: [...s.comments, { id: newId(), userId: s.userId, movieId: selected.movie.id, scope: "public", body, spoiler, score: myLogs.find(l => l.movieId === selected.movie.id)?.rating ?? null, createdAt: new Date().toISOString() }] }))} />}
    {selectedDay && <Modal title={`${Number(selectedDay.slice(5, 7))}월 ${Number(selectedDay.slice(8))}일의 장면`} onClose={() => setSelectedDay(null)}><DayRecords date={selectedDay} logs={state.logs} movies={movies} user={state.userId} covers={state.calendarCovers?.[state.userId]} onCover={logId => update(s => ({ ...s, calendarCovers: { ...s.calendarCovers, [s.userId]: { ...s.calendarCovers?.[s.userId], [selectedDay]: logId } } }))} onOpen={(movie, log) => { setSelectedDay(null); openMovie(movie, log); }} />{selectedDayLogs.length === 0 && <Empty title="아직 붙이지 않은 포스터">이날 본 영화가 있다면 기록해 보세요.</Empty>}<button className={`${styles.blackButton} ${styles.dayAction}`} disabled={selectedDay > today()} onClick={() => { chooseFilm(selectedDay); setSelectedDay(null); }}><Plus size={17} />{selectedDay > today() ? "관람 후에 기록할 수 있어요" : "이 날짜에 영화 기록"}</button></Modal>}
  </div>;
}
