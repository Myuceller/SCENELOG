"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { SocialCollection } from "@/types/social";
import { useSocialResource } from "@/hooks/use-social-resource";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Modal } from "@/components/scenelog/ui";
import { Pagination, RecordCard } from "./social-cards";
import { FriendshipActions } from "./friendship-actions";
import styles from "./friends-tab.module.css";

export function UserProfileDialog({ userId, profileId, onClose, onMovie }: {
  userId: string; profileId: string; onClose: () => void; onMovie: (movie: ArchiveMovie) => void;
}) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const { data, loading, error } = useSocialResource<SocialCollection>(userId, new URLSearchParams({ profile: profileId, page: String(page) }).toString(), retry);
  return <Modal title="프로필" onClose={onClose}>
    {loading && <p className={styles.empty} role="status">프로필을 불러오는 중…</p>}
    {error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></p>}
    {data && <>
      <div className={styles.profile}><UserAvatar userId={data.profile.id} name={data.profile.displayName} size="large" imageUrl={data.profile.avatarUrl} /><h2>{data.profile.displayName}</h2><p>친구 {data.profile.friendCount}명</p><FriendshipActions key={data.profile.id} userId={userId} person={data.profile} allowRemove /></div>
      {data.profile.canViewCollection ? <>
        <div className={styles.counts}><span>평가한 영화 <b>{data.profile.ratedCount ?? 0}편</b></span><span>작성한 리뷰 <b>{data.profile.reviewCount ?? 0}개</b></span></div>
        <div className={styles.profileRecords}>{data.records.map(record => <RecordCard key={record.id} record={record} onMovie={() => { onClose(); onMovie(record.movie); }} />)}</div>
        {!data.records.length && <p className={styles.empty}>아직 기록한 영화가 없어요.</p>}
        <Pagination page={page} hasNext={data.hasNext} onChange={setPage} />
      </> : <p className={styles.private}><LockKeyhole size={20} aria-hidden="true" />{data.profile.collectionVisibility === "friends" ? "친구에게만 공개된 컬렉션입니다." : "비공개 컬렉션입니다."}</p>}
    </>}
  </Modal>;
}
