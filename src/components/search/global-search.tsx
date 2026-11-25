"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Film, Search, UserRound, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { normalizeMovie, type ArchiveMovie } from "@/lib/archive-movies";
import type { PersonSearchResult, SearchCategory, SearchGroup, SearchResponse } from "@/types/search";
import { UserAvatar } from "@/components/profile/user-avatar";
import { PersonDialog } from "./person-dialog";
import styles from "./global-search.module.css";

const categories: { id: SearchCategory; label: string }[] = [{ id: "all", label: "전체" }, { id: "movie", label: "영화" }, { id: "person", label: "인물" }, { id: "user", label: "유저" }];

export function GlobalSearch({ userId, onMovie, onUser }: { userId: string; onMovie: (movie: ArchiveMovie) => void; onUser: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonSearchResult | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{ key: string; data?: SearchResponse; error?: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const id = useId();
  const key = JSON.stringify([userId, query, category, page, retry]);
  const waiting = draft.trim() !== query;
  const current = !waiting && response?.key === key ? response : null;
  const loading = !!draft.trim() && !current;

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(draft.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus({ preventScroll: true });
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (!open || !query || waiting) return;
    const controller = new AbortController();
    async function run() {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error || !data.session || data.session.user.id !== userId) throw new Error("다시 로그인해 주세요.");
      const params = new URLSearchParams({ q: query, category, page: String(page) });
      const res = await fetch(`/api/search?${params}`, { cache: "no-store", signal: controller.signal, headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? "검색하지 못했어요. 다시 시도해 주세요.");
      if (!controller.signal.aborted) setResponse({ key, data: payload });
    }
    void run().catch(error => { if (!controller.signal.aborted) setResponse({ key, error: error instanceof Error ? error.message : "검색하지 못했어요." }); });
    return () => controller.abort();
  }, [open, userId, query, category, page, key, waiting]);

  function close() { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
  function submit(event: FormEvent) { event.preventDefault(); setQuery(draft.trim()); setPage(1); setRetry(value => value + 1); }
  function changeCategory(next: SearchCategory) { setCategory(next); setPage(1); results.current?.scrollTo({ top: 0 }); }
  function changePage(next: number) { setPage(next); results.current?.scrollTo({ top: 0 }); }
  const activeGroup = category === "movie" ? current?.data?.movies : category === "person" ? current?.data?.people : current?.data?.users;

  return <><div ref={root} className={styles.root} data-open={open} onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); close(); } }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <form id={`${id}-form`} className={styles.form} role="search" aria-hidden={!open} onSubmit={submit}>
      <input ref={input} type="search" aria-label="영화,인물,유저 검색" aria-controls={`${id}-results`} placeholder="영화,인물,유저 검색" value={draft} disabled={!open} maxLength={60} autoComplete="off" onChange={event => setDraft(event.target.value)} />
    </form>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={open ? "검색 닫기" : "통합 검색 열기"} aria-expanded={open} aria-controls={`${id}-form`} onClick={() => open ? close() : setOpen(true)}>{open ? <X size={19} /> : <Search size={19} />}</button>
    {open && <div id={`${id}-results`} className={styles.panel}>
      <div className={styles.tabs} role="group" aria-label="검색 종류">{categories.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => changeCategory(item.id)}>{item.label}</button>)}</div>
      <div ref={results} className={styles.results} aria-busy={loading}>
        {!draft.trim() ? <p className={styles.status}>검색어를 입력해 주세요.</p> : loading ? <p className={styles.status} role="status">검색 중…</p> : current?.error ? <p className={styles.status} role="alert">{current.error}<button type="button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></p> : current?.data && <>
          {current.data.movies && <ResultGroup title="영화" group={current.data.movies} all={category === "all"} onMore={() => changeCategory("movie")} retry={() => setRetry(value => value + 1)}>{(category === "all" ? current.data.movies.items.slice(0, 5) : current.data.movies.items).map(movie => <button type="button" className={styles.row} key={movie.id} onClick={() => { close(); onMovie(normalizeMovie(movie)); }}>{movie.poster ? <Image className={styles.poster} src={movie.poster} alt="" width={64} height={96} sizes="40px" /> : <span className={styles.placeholder}><Film size={19} /></span>}<span className={styles.text}><strong>{movie.title}</strong><small>{movie.year ?? "개봉일 미정"}{movie.originalTitle !== movie.title ? ` · ${movie.originalTitle}` : ""}</small></span><ChevronRight size={16} className={styles.arrow} aria-hidden="true" /></button>)}</ResultGroup>}
          {current.data.people && <ResultGroup title="인물" group={current.data.people} all={category === "all"} onMore={() => changeCategory("person")} retry={() => setRetry(value => value + 1)}>{(category === "all" ? current.data.people.items.slice(0, 5) : current.data.people.items).map(person => <button type="button" className={styles.row} key={person.id} onClick={() => { close(); setSelectedPerson(person); }}>{person.photo ? <Image className={styles.photo} src={person.photo} alt="" width={80} height={80} sizes="40px" /> : <span className={`${styles.placeholder} ${styles.photo}`}><UserRound size={20} /></span>}<span className={styles.text}><strong>{person.name}</strong><small>{person.department}{person.originalName !== person.name ? ` · ${person.originalName}` : ""}</small>{person.knownFor.length > 0 && <small>{person.knownFor.join(" · ")}</small>}</span><ChevronRight size={16} className={styles.arrow} aria-hidden="true" /></button>)}</ResultGroup>}
          {current.data.users && <ResultGroup title="유저" group={current.data.users} all={category === "all"} onMore={() => changeCategory("user")} retry={() => setRetry(value => value + 1)}>{(category === "all" ? current.data.users.items.slice(0, 5) : current.data.users.items).map(person => <button type="button" className={styles.row} key={person.id} onClick={() => { close(); onUser(person.id); }}><UserAvatar userId={person.id} name={person.displayName} imageUrl={person.avatarUrl} titleId={person.equippedTitle} /><span className={styles.text}><strong>{person.displayName}</strong><small>{person.canViewCollection ? `평가 ${person.ratedCount ?? 0}편` : "비공개 컬렉션"}</small></span><ChevronRight size={16} className={styles.arrow} aria-hidden="true" /></button>)}</ResultGroup>}
          {category !== "all" && activeGroup && !activeGroup.error && (page > 1 || activeGroup.hasNext) && <nav className={styles.pagination} aria-label="검색 결과 페이지"><button type="button" aria-label="이전 검색 결과" disabled={page === 1} onClick={() => changePage(page - 1)}><ChevronLeft size={18} /></button><span>{page} 페이지</span><button type="button" aria-label="다음 검색 결과" disabled={!activeGroup.hasNext} onClick={() => changePage(page + 1)}><ChevronRight size={18} /></button></nav>}
        </>}
      </div>
    </div>}
  </div>
    {selectedPerson && <PersonDialog key={selectedPerson.id} person={selectedPerson} onClose={() => setSelectedPerson(null)} onMovie={onMovie} />}
  </>;
}

function ResultGroup<T>({ title, group, all, children, onMore, retry }: { title: string; group: SearchGroup<T>; all: boolean; children: ReactNode; onMore: () => void; retry: () => void }) {
  return <section className={styles.group} aria-label={`${title} 검색 결과`}><div className={styles.groupHeading}><h2>{title}{group.total !== null && <span>{group.total.toLocaleString("ko-KR")}</span>}</h2>{all && (group.items.length > 5 || group.hasNext) && <button type="button" onClick={onMore}>더 보기 <ChevronRight size={13} /></button>}</div>{group.error ? <p className={styles.status} role="alert">{group.error}<button type="button" onClick={retry}>다시 시도</button></p> : group.items.length ? children : <p className={styles.status}>검색 결과가 없어요.</p>}</section>;
}
