"use client";

import Image from "next/image";

import { useState } from "react";
import { ArrowUpRight, Check, Mail, Plus, Users } from "lucide-react";
import type { ArchiveMovie as Movie } from "@/lib/archive-movies";
import { accounts, friendIds, latestLogs, newId, type AccountId, type SceneState } from "@/lib/scene-store";
import { Avatar, Discussion, Empty, Modal } from "./ui";
import styles from "./scenelog.module.css";

export function FriendsPanel({ state, movies, update, openMovie, saveWatchlist, notify }: {
  state: SceneState; movies: Movie[]; update: (fn: (s: SceneState) => SceneState) => void;
  openMovie: (movie: Movie) => void; saveWatchlist: (movieId: string) => void; notify: (text: string) => void;
}) {
  const [section, setSection] = useState("groups");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupMovie, setGroupMovie] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState("all");
  const [compare, setCompare] = useState<AccountId | null>(null);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<AccountId[]>([]);
  const friends = friendIds(state);
  const myLogs = latestLogs(state.logs, state.userId);
  const groups = state.groups.filter(g => g.members.includes(state.userId));
  const group = groups.find(g => g.id === groupId);
  const groupFilm = movies.find(m => m.id === groupMovie);
  const incoming = state.friends.filter(f => f.to === state.userId && !f.accepted);
  const recommendations = state.recommendations.filter(r => r.to.includes(state.userId));
  function seenBy(movieId: string, ids: AccountId[]) { return ids.filter(id => state.logs.some(log => log.userId === id && log.movieId === movieId)); }
  return <section className={styles.pageSection}>
    <div className={styles.pageHeading}><div><p className={styles.eyebrow}>05 / BETTER WITH FRIENDS</p><h1>같은 영화, <em>다른 시선.</em></h1><p>추천하고, 함께 보고, 끝나지 않은 이야기를 나눠요.</p></div><span className={styles.previewBadge}>예시 계정 간 체험</span></div>
    <div className={styles.tabs}><button className={section === "groups" ? styles.activeTab : ""} onClick={() => setSection("groups")}><Users size={16} />우리의 영화방 <small>{groups.length}</small></button><button className={section === "inbox" ? styles.activeTab : ""} onClick={() => setSection("inbox")}><Mail size={16} />받은 추천 <small>{recommendations.length}</small></button><button className={section === "friends" ? styles.activeTab : ""} onClick={() => setSection("friends")}>친구 <small>{friends.length}</small></button></div>
    {section === "groups" && <>
      <div className={styles.groupGrid}>{groups.map(g => {
        const common = movies.filter(m => seenBy(m.id, g.members).length === g.members.length);
        return <button className={styles.groupCard} key={g.id} onClick={() => { setGroupId(g.id); setGroupMovie(null); setGroupFilter("all"); }}><span className={styles.groupFolder}>FILM CLUB / {g.members.length} MEMBERS <ArrowUpRight size={22} /></span><div className={styles.avatarStack}>{g.members.map(id => <Avatar key={id} id={id} small />)}</div><h2>{g.name}</h2><p>우리 모두 본 영화 <strong>{common.length}편</strong></p><div className={styles.miniPosters}>{common.slice(0, 4).map(m => <Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" key={m.id} src={m.poster} alt={m.title} />)}</div><span className={styles.groupEnter}>우리의 이야기 열기 <span>↗</span></span></button>;
      })}<button className={styles.newGroup} onClick={() => setCreating(true)}><Plus size={30} /><strong>새 영화방 만들기</strong><span>친구들과 취향을 모아보세요.</span></button></div>
      <div className={styles.friendNote}><span>TOGETHER, IN SCENES.</span><p>‘모두 본 영화’는 각자 본 기록이 겹치는 영화예요.<br />한날한시에 만나지 않아도, 이야기는 함께할 수 있으니까.</p></div>
    </>}
    {section === "inbox" && <div className={styles.recommendations}>{recommendations.length === 0 && <Empty title="아직 도착한 추천이 없어요">친구 계정으로 전환해 첫 영화를 추천해 보세요.</Empty>}{[...recommendations].reverse().map(r => {
      const movie = movies.find(m => m.id === r.movieId); if (!movie) return null;
      const watched = myLogs.some(l => l.movieId === movie.id);
      const saved = state.watchlist.some(w => w.userId === state.userId && w.movieId === movie.id);
      return <article className={styles.recommendCard} key={r.id}><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={movie.poster} alt={`${movie.title} 포스터`} /><div><span className={styles.eyebrow}>A FILM FOR YOU / FROM {r.from.toUpperCase()}</span><h2>{movie.title}</h2><p>{r.from}의 별점 <strong>★ {r.score?.toFixed(1) ?? "미정"}</strong></p><blockquote>{r.note || "같이 이야기하고 싶은 영화라서."}</blockquote><div className={styles.buttonRow}><button className={styles.outlineButton} onClick={() => saveWatchlist(movie.id)} disabled={saved}>{saved ? <Check size={15} /> : <Plus size={15} />}{saved ? "관심 목록에 저장됨" : "보고 싶은 영화에 추가"}</button><button className={styles.blackButton} onClick={() => openMovie(movie)}>{watched ? "내 기록 보기" : "봤어요 · 기록하기"}<ArrowUpRight size={16} /></button></div></div></article>;
    })}</div>}
    {section === "friends" && <>
      {incoming.map(f => <div className={styles.request} key={f.from}><Avatar id={f.from} small /><p><strong>{f.from}</strong>님이 친구가 되고 싶어 해요.</p><button className={styles.blackButton} onClick={() => { update(s => ({ ...s, friends: s.friends.map(item => item.from === f.from && item.to === s.userId ? { ...item, accepted: true } : item) })); notify("친구가 되었어요."); }}>수락</button></div>)}
      <div className={styles.friendGrid}>{accounts.filter(a => a.id !== state.userId).map(a => {
        const isFriend = friends.includes(a.id);
        const pending = state.friends.some(f => !f.accepted && ((f.from === state.userId && f.to === a.id) || (f.to === state.userId && f.from === a.id)));
        const common = myLogs.filter(l => state.logs.some(o => o.userId === a.id && o.movieId === l.movieId));
        return <article className={styles.personCard} key={a.id}><Avatar id={a.id} /><h2>{a.name}</h2><p>{a.bio}</p><small>둘 다 본 영화 {common.length}편</small><div className={styles.buttonRow}><button className={styles.outlineButton} onClick={() => setCompare(a.id)}>취향 비교 <ArrowUpRight size={15} /></button>{isFriend ? <span className={styles.friendStatus}><Check size={15} />친구</span> : <button className={styles.blackButton} disabled={pending} onClick={() => { update(s => ({ ...s, friends: [...s.friends, { from: s.userId, to: a.id, accepted: false }] })); notify("친구 요청을 보냈어요. 상대 예시 계정에서 수락할 수 있어요."); }}>{pending ? "요청 대기 중" : "친구 요청"}</button>}</div></article>;
      })}</div>
    </>}
    {creating && <Modal title="우리의 영화방 만들기" onClose={() => setCreating(false)}><form className={styles.recordForm} onSubmit={e => { e.preventDefault(); if (!groupName.trim() || !members.length) return; const id = newId(); update(s => ({ ...s, groups: [...s.groups, { id, name: groupName.trim(), members: [s.userId, ...members] }] })); setCreating(false); setGroupId(id); setGroupName(""); setMembers([]); notify("새 영화방을 만들었어요."); }}><label className={styles.reviewLabel}>영화방 이름<input aria-label="영화방 이름" value={groupName} maxLength={40} onChange={e => setGroupName(e.target.value)} placeholder="예: 금요일엔 영화" required /></label><span className={styles.fieldLabel}>함께할 친구</span>{friends.length === 0 && <p>먼저 친구 요청을 보내고 수락해 주세요.</p>}{friends.map(id => <label className={styles.memberChoice} key={id}><Avatar id={id} small /><strong>{id}</strong><input type="checkbox" aria-label={`${id} 초대`} checked={members.includes(id)} onChange={e => setMembers(v => e.target.checked ? [...v, id] : v.filter(x => x !== id))} /></label>)}<button className={styles.redButton} disabled={!groupName.trim() || !members.length}>영화방 만들기 <Plus size={17} /></button></form></Modal>}
    {group && <Modal title={group.name} onClose={() => setGroupId(null)} wide>
      <div className={styles.groupMembers}>{group.members.map(id => <span key={id}><Avatar id={id} small />{id}</span>)}</div>
      <div className={styles.chips}><button className={groupFilter === "all" ? styles.selectedChip : ""} onClick={() => { setGroupFilter("all"); setGroupMovie(null); }}>모두 본 영화</button><button className={groupFilter === "some" ? styles.selectedChip : ""} onClick={() => { setGroupFilter("some"); setGroupMovie(null); }}>일부가 본 영화</button><button className={groupFilter === "none" ? styles.selectedChip : ""} onClick={() => { setGroupFilter("none"); setGroupMovie(null); }}>아직 아무도 안 본 영화</button></div>
      <div className={styles.groupFilms}>{movies.filter(m => { const count = seenBy(m.id, group.members).length; return groupFilter === "all" ? count === group.members.length : groupFilter === "none" ? count === 0 : count > 0 && count < group.members.length; }).map(m => <button key={m.id} className={groupMovie === m.id ? styles.selectedFilm : ""} onClick={() => setGroupMovie(m.id)}><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={m.poster} alt="" /><span>{m.title}<small>{seenBy(m.id, group.members).length}/{group.members.length}명 관람</small></span></button>)}</div>
      {movies.filter(m => { const count = seenBy(m.id, group.members).length; return groupFilter === "all" ? count === group.members.length : groupFilter === "none" ? count === 0 : count > 0 && count < group.members.length; }).length === 0 && <Empty title="이 조건에 맞는 영화가 없어요">다른 탭에서도 우리 취향을 찾아보세요.</Empty>}
      {groupFilm ? <div className={styles.groupDiscussion}><p className={styles.eyebrow}>OUR CONVERSATION</p><h3>{groupFilm.title}</h3><div className={styles.scoreStrip}>{group.members.map(id => { const log = latestLogs(state.logs, id).find(l => l.movieId === groupFilm.id); return <span key={id}>{id} <strong>{log ? `★ ${log.rating?.toFixed(1) ?? "미정"}` : "아직 안 봄"}</strong></span>; })}</div><Discussion key={`${group.id}-${groupFilm.id}`} comments={state.comments.filter(c => c.scope === `group:${group.id}` && c.movieId === groupFilm.id)} onSubmit={(body, spoiler) => { update(s => ({ ...s, comments: [...s.comments, { id: newId(), scope: `group:${group.id}`, movieId: groupFilm.id, userId: s.userId, body, spoiler, score: myLogs.find(l => l.movieId === groupFilm.id)?.rating ?? null, createdAt: new Date().toISOString() }] })); }} /></div> : <p className={styles.helper}>포스터를 눌러 영화별 대화를 열어보세요.</p>}
    </Modal>}
    {compare && <Modal title={`${state.userId} & ${compare}`} onClose={() => setCompare(null)} wide><p className={styles.muted}>둘 다 본 영화에서 우리의 취향을 비교해요.</p><div className={styles.compareList}>{myLogs.filter(log => state.logs.some(l => l.userId === compare && l.movieId === log.movieId)).map(log => { const movie = movies.find(m => m.id === log.movieId); const other = latestLogs(state.logs, compare).find(l => l.movieId === log.movieId); if (!movie) return null; return <div key={log.id}><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={movie.poster} alt="" /><strong>{movie.title}</strong><span>{state.userId}<b>★ {log.rating?.toFixed(1) ?? "미정"}</b></span><span>{compare}<b>★ {other?.rating?.toFixed(1) ?? "미정"}</b></span></div>; })}</div>{!myLogs.some(log => state.logs.some(l => l.userId === compare && l.movieId === log.movieId)) && <Empty title="아직 겹치는 영화가 없어요">첫 영화를 추천하며 시작해 보세요.</Empty>}</Modal>}
  </section>;
}
