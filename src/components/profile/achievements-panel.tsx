"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LockKeyhole, Trophy } from "lucide-react";
import { achievements, summarizeAchievements, findAchievement, formatOwnershipPercent, type AchievementCollection, type AchievementId } from "@/lib/achievements";
import { readAchievementCache, invalidateAchievements } from "@/lib/achievement-cache";
import { ACHIEVEMENT_REFRESH_MESSAGE } from "@/lib/achievement-request";
import { requestAchievements } from "@/lib/api/achievements";
import { publishProfile, requestProfile } from "@/lib/api/profile";
import type { OwnProfile } from "@/types/social";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Modal } from "@/components/scenelog/ui";
import { UserAvatar } from "./user-avatar";
import styles from "./achievements.module.css";

export function AchievementsPanel({ userId, name, profile }: { userId: string; name: string; profile?: OwnProfile }) {
  const [data, setData] = useState<AchievementCollection | null>(() => readAchievementCache(userId)?.data ?? null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<AchievementId | null>(null);
  const [filter, setFilter] = useState("전체");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    if (attempt === 0 && readAchievementCache(userId)?.fresh) return () => { controller.abort(); pending.current?.abort(); };
    void requestAchievements(userId, controller.signal).then(result => {
      if (!controller.signal.aborted) { setData(result); setError(""); }
    }).catch(error => { if (!controller.signal.aborted) {
      setError(error instanceof Error ? error.message : "도전과제를 불러오지 못했어요.");
      if (error instanceof Error && error.message === ACHIEVEMENT_REFRESH_MESSAGE) { invalidateAchievements(userId); setData(null); }
    } });
    return () => { controller.abort(); pending.current?.abort(); };
  }, [userId, attempt]);
  async function equip(id: AchievementId) {
    if (busy.current) return;
    busy.current = true; setSaving(true); setSaveError("");
    const controller = new AbortController(); pending.current = controller;
    try {
      const result = await requestAchievements(userId, controller.signal, id);
      if (controller.signal.aborted) return;
      setData(result);
      if (profile) publishProfile({ ...profile, equippedTitle: result.equippedTitle });
      else {
        const updated = await requestProfile(userId, controller.signal);
        if (controller.signal.aborted) return;
        publishProfile(updated);
      }
      setNotice(`${findAchievement(id).title} 아바타를 지정했어요.`);
    } catch (error) { if (!controller.signal.aborted) setSaveError(error instanceof Error ? error.message : "장착하지 못했어요."); }
    finally { busy.current = false; if (!controller.signal.aborted) setSaving(false); }
  }
  const retry = <button type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>다시 시도</button>;
  const failure = error && <p className={styles.loadError} role="alert">{error} {error === ACHIEVEMENT_REFRESH_MESSAGE ? <button type="button" onClick={() => window.location.reload()}>새로고침</button> : retry}</p>;
  if (!data) return <section className={styles.panel} aria-label="나의 도전과제">
    <div className={styles.summary}><div><h3>기록이 나의 모습이 돼요.</h3><p>칭호를 둘러보는 동안 나의 진행도를 불러올게요.</p></div><span className={styles.total}>— / {achievements.length}</span></div>
    {failure || <LoadingIndicator label="나의 진행도를 불러오고 있어요…" />}
    <div className={styles.grid} aria-busy={!error}>{achievements.slice(0, 24).map(item => <article key={item.id} className={styles.card}>
      <span className={styles.preview}><UserAvatar userId={userId} name={name} imageUrl={profile?.avatarUrl} titleId={item.id} size="large" /></span>
      <span className={styles.rank}>{item.ornament?.label}{item.metric === "genre" || item.metric === "movies" ? ` · ${item.target.toLocaleString("ko-KR")}편` : ""}</span><strong>{item.title}</strong><span className={styles.condition}>{item.condition}</span><small>{error ? "진행도를 불러오지 못했어요" : "진행도 확인 중"}</small>
    </article>)}</div>
  </section>;
  const summary = summarizeAchievements(data);
  const definition = selected ? findAchievement(selected) : null;
  const progress = selected ? data.achievements.find(item => item.id === selected) : null;
  const equipped = data.equippedTitle;
  const progressById = new Map(data.achievements.map(item => [item.id, item]));
  const items = achievements.filter(item =>
    (filter === "전체" || (filter === "획득" ? progressById.get(item.id)?.unlockedAt : filter === "황금" ? item.ornament?.metal === "gold" : item.category === filter)) &&
    `${item.title} ${item.condition}`.toLocaleLowerCase("ko-KR").includes(search.trim().toLocaleLowerCase("ko-KR")));
  const ownership = (count: number) => `회원의 ${formatOwnershipPercent(count, data.population.totalMembers)}가 보유하고 있어요.`;
  return <section className={styles.panel} aria-label="나의 도전과제">
    <div className={styles.summary}><div><span className={styles.eyebrow}>MY SCENE COLLECTION</span><h3>기록이 나의 모습이 돼요.</h3><p>한 달에 한 편도 좋아요. 나만의 속도로 모아보세요.</p></div><span className={styles.total}><Trophy size={18} aria-hidden="true" /><b>{summary.unlocked}</b> / {summary.total}</span></div>
    {failure}
    <div className={styles.current}><UserAvatar userId={userId} name={name} imageUrl={profile?.avatarUrl} titleId={equipped} size="large" /><div><small>지금 장착한 칭호</small><strong>{findAchievement(equipped).title}</strong><span>내 사진은 그대로, 취향을 더해요.</span></div></div>
    <label className={styles.search}><span>도전과제 찾기</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(24); }} placeholder="칭호, 장르, 달성 조건 검색" /></label>
    <div className={styles.filters} role="group" aria-label="도전과제 분류">{["전체", "획득", "시작", "누적 관람", "취향", "기록", "꾸준함", "황금"].map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setVisibleCount(24); }}>{value}</button>)}</div>
    <p className={styles.notice} role="status">{notice}</p>
    <p className={styles.results}>{items.length}개 도전과제 · {Math.min(visibleCount, items.length)}개 표시</p>
    <div className={styles.grid}>{items.slice(0, visibleCount).map(item => {
      const status = progressById.get(item.id)!;
      const unlocked = !!status.unlockedAt;
      return <button type="button" className={styles.card} key={item.id} data-metal={item.ornament?.metal} data-gold={item.ornament?.metal === "gold" || undefined} data-locked={!unlocked || undefined} aria-label={`${item.title}, ${equipped === item.id ? "장착 중" : unlocked ? "획득" : `${Math.min(status.current, status.target)} / ${status.target}`}, 상세 보기`} onClick={() => { setSelected(item.id); setSaveError(""); }}>
        <span className={styles.cardState}>{equipped === item.id ? <><Check size={12} />장착 중</> : unlocked ? "획득" : <><LockKeyhole size={12} />미획득</>}</span>
        <span className={styles.preview}><UserAvatar userId={userId} name={name} imageUrl={profile?.avatarUrl} titleId={item.id} size="large" /></span>
        {item.ornament?.metal && <span className={styles.metalLabel} data-metal={item.ornament.metal}>{({ bronze: "동색", silver: "은색", gold: "금색" })[item.ornament.metal]} 칭호</span>}
        <span className={styles.rank}>{item.ornament?.label}{item.metric === "genre" || item.metric === "movies" ? ` · ${item.target.toLocaleString("ko-KR")}편` : ""}</span><strong>{item.title}</strong><span className={styles.condition}>{item.condition}</span>
        <span className={styles.progress}><span style={{ width: `${unlocked ? 100 : Math.min(100, status.current / status.target * 100)}%` }} /></span>
        <small>{unlocked ? "달성 완료" : `${Math.min(status.current, status.target)} / ${status.target}`}</small>
        <span className={styles.ownership}>{ownership(status.holderCount)}</span>
      </button>;
    })}</div>
    {visibleCount < items.length && <button type="button" className={styles.more} onClick={() => setVisibleCount(count => count + 24)}>도전과제 더 보기 ({items.length - visibleCount}개 남음)</button>}
    {!items.length && <p className={styles.loading}>조건에 맞는 도전과제가 없어요.</p>}
    <p className={styles.rules}>같은 영화는 한 편으로 집계해요. 캘린더와 재관람은 서로 다른 관람일로 계산하며, 미래 관람일은 제외해요. 월별 도전과제는 관람일을 기준으로 세며, 연속 관람은 가장 길게 이어진 개월 수로 계산해요. 도전과제를 열면 저장된 기록으로 달성을 확인하고, 획득한 칭호는 기록을 수정해도 유지돼요.</p>
    <p className={styles.populationNote}>보유율은 프로필이 생성된 전체 회원 중 칭호를 획득한 회원의 비율이에요. 장착 여부와는 무관하며, 도전과제를 아직 확인하지 않은 회원의 미확정 달성은 포함하지 않아요. 집계: {new Date(data.population.calculatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (한국 시간)</p>
    {definition && progress && <Modal title={definition.title} onClose={() => setSelected(null)}>
      <div className={styles.detail} data-metal={definition.ornament?.metal} data-gold={definition.ornament?.metal === "gold" || undefined}>
        <div className={styles.detailPreview}><UserAvatar key={definition.id} userId={userId} name={name} imageUrl={profile?.avatarUrl} titleId={definition.id} size="preview" animate /></div>
        {definition.ornament?.metal === "gold" && <span className={styles.goldLabel}>GOLDEN COLLECTION · 황금 칭호</span>}
        <span className={styles.detailCategory}>{definition.category} 도전과제 · {definition.ornament?.label}</span><h3>{definition.title}</h3><p>{definition.description}</p>
        <div className={styles.requirement}><span>달성 조건</span><strong>{definition.condition}</strong><span>{progress.unlockedAt ? "달성 완료" : `${Math.min(progress.current, progress.target)} / ${progress.target}`}</span><progress aria-label={`${definition.title} 진행도`} value={progress.unlockedAt ? progress.target : Math.min(progress.current, progress.target)} max={progress.target} /></div>
        <div className={styles.rarity}><strong>{ownership(progress.holderCount)}</strong></div>
        {progress.unlockedAt && <small className={styles.earned}>{new Date(progress.unlockedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 획득</small>}
        {saveError && <p className={styles.error} role="alert">{saveError}</p>}
        <p className={styles.detailNotice} role="status">{equipped === definition.id ? "이 칭호로 프로필을 꾸미고 있어요." : "프로필 사진 옆에 이 장식이 함께 표시돼요."}</p>
        <button type="button" className={styles.equip} disabled={saving || !progress.unlockedAt || equipped === definition.id} onClick={() => void equip(definition.id)}>{saving ? "적용 중…" : equipped === definition.id ? "현재 장착 중" : progress.unlockedAt ? "아바타로 지정" : "달성하면 장착할 수 있어요"}</button>
      </div>
    </Modal>}
  </section>;
}
