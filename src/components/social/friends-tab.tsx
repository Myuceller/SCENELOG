"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Search, Settings } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { useSocialResource } from "@/hooks/use-social-resource";
import { publishSocialUpdate } from "@/lib/api/social";
import type { SocialList, SocialTab } from "@/types/social";
import { UserAvatar } from "@/components/profile/user-avatar";
import { FriendshipActions } from "./friendship-actions";
import { UserProfileDialog } from "./user-profile-dialog";
import { RequestBadge } from "./request-badge";
import { Pagination, RecordCard } from "./social-cards";
import styles from "./friends-tab.module.css";

const tabs: { id: SocialTab; label: string }[] = [
  { id: "friends", label: "친구" }, { id: "incoming", label: "받은 요청" },
  { id: "outgoing", label: "보낸 요청" }, { id: "feed", label: "최근 기록" },
];
const emptyMessages: Record<SocialTab, string> = {
  friends: "아직 친구가 없어요.", incoming: "받은 친구 요청이 없어요.",
  outgoing: "보낸 친구 요청이 없어요.", feed: "아직 볼 수 있는 친구들의 기록이 없어요.", discover: "검색 결과가 없어요.",
};

export function FriendsTab({ userId, onOpenMovie, incomingRequests }: { userId: string; incomingRequests: number; onOpenMovie: (movie: ArchiveMovie) => void }) {
  const [tab, setTab] = useState<SocialTab>("friends");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listTop = useRef<HTMLDivElement>(null);
  const list = useSocialResource<SocialList>(userId, new URLSearchParams({ tab, q: query, page: String(page) }).toString(), JSON.stringify([revision, incomingRequests]));

  function switchTab(next: SocialTab) { setTab(next); setPage(1); setQuery(""); setDraft(""); }
  function search(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) { input.current?.focus(); return; }
    setTab("discover"); setQuery(draft.trim()); setPage(1); setRevision(value => value + 1);
  }

  return <section className={styles.page} aria-labelledby="friends-heading">
    <div className={styles.heading}><div><span className={styles.eyebrow}>05 / FRIENDS & FILMS</span><h1 id="friends-heading">친구들의 <em>장면.</em></h1></div><Link href="/settings" className={styles.settings}><Settings size={17} aria-hidden="true" />프로필 설정</Link></div>
    <div className={styles.toolbar}>
      <div className={styles.tabs} role="group" aria-label="친구 목록">{tabs.map(item => <button type="button" key={item.id} aria-label={item.id === "incoming" && incomingRequests > 0 ? `받은 요청 ${incomingRequests}개` : item.label} aria-pressed={tab === item.id} onClick={() => switchTab(item.id)}>{item.label}{item.id === "incoming" && <RequestBadge count={incomingRequests} />}</button>)}</div>
      <form className={styles.search} role="search" onSubmit={search}><Search size={18} aria-hidden="true" /><input ref={input} aria-label="공개 닉네임 검색" placeholder="닉네임으로 친구 찾기" maxLength={60} value={draft} onChange={event => setDraft(event.target.value)} /><button type="submit">검색</button></form>
      <button type="button" className={styles.refresh} onClick={() => publishSocialUpdate(userId)}>새로고침</button>
    </div>
    <div ref={listTop} className={styles.results} tabIndex={-1}>
      {tab === "discover" && <h2 className={styles.searchHeading}>‘{query}’ 검색 결과</h2>}
      {list.error && <div className={styles.error} role="alert">{list.error} <button type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button></div>}
      {list.loading && <p className={styles.empty} role="status">불러오는 중…</p>}
      {list.data && <>
        {tab === "feed" ? <div className={styles.recordGrid}>{list.data.records.map(record => <RecordCard key={`${record.userId}:${record.id}`} record={record} onProfile={() => setSelected(record.userId)} onMovie={() => onOpenMovie(record.movie)} />)}</div>
          : <div className={styles.people}>{list.data.users.map(person => <article className={styles.person} key={person.id}>
            <button type="button" className={styles.identity} onClick={() => setSelected(person.id)}><UserAvatar userId={person.id} name={person.displayName} imageUrl={person.avatarUrl} /><span><strong>{person.displayName}</strong><small>{person.canViewCollection ? `평가 ${person.ratedCount ?? 0}편 · 리뷰 ${person.reviewCount ?? 0}개` : "비공개 컬렉션"}</small></span></button>
            <FriendshipActions userId={userId} person={person} />
          </article>)}</div>}
        {!list.data.records.length && !list.data.users.length && <div className={styles.empty}>
          <p>{emptyMessages[tab]}</p>
          {(tab === "friends" || tab === "feed") && <button type="button" onClick={() => input.current?.focus()}>친구 찾기</button>}
        </div>}
        <Pagination page={page} hasNext={list.data.hasNext} onChange={next => { setPage(next); listTop.current?.focus({ preventScroll: true }); listTop.current?.scrollIntoView({ block: "start" }); }} />
      </>}
    </div>
    {selected && <UserProfileDialog key={selected} userId={userId} profileId={selected} onClose={() => setSelected(null)} onMovie={onOpenMovie} />}
  </section>;
}
