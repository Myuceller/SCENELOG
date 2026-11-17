"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { SocialRecord } from "@/types/social";
import { UserAvatar } from "@/components/profile/user-avatar";
import styles from "./friends-tab.module.css";

export function RecordCard({ record, onProfile, onMovie }: { record: SocialRecord; onProfile?: () => void; onMovie: () => void }) {
  const [showSpoiler, setShowSpoiler] = useState(false);
  return <article className={styles.record}>
    {onProfile && <button type="button" className={styles.recordOwner} onClick={onProfile}><UserAvatar userId={record.userId} name={record.displayName} imageUrl={record.avatarUrl} /><strong>{record.displayName}</strong><time dateTime={record.createdAt}>{record.createdAt.slice(0, 10).replaceAll("-", ".")}</time></button>}
    <div className={styles.film}>
      <button type="button" onClick={onMovie} aria-label={`${record.movie.title} 상세 보기`}><Image src={record.movie.poster} alt="" width={120} height={180} sizes="72px" /></button>
      <div><button type="button" className={styles.title} onClick={onMovie}>{record.movie.title}</button><small>{record.movie.year ?? "개봉일 미정"}</small><span className={styles.rating}><Star size={14} aria-hidden="true" />{record.rating === null ? "미평가" : record.rating.toFixed(1)}</span></div>
    </div>
    {record.review && (record.spoiler && !showSpoiler ? <button type="button" className={styles.spoiler} onClick={() => setShowSpoiler(true)}>스포일러가 포함된 리뷰 보기</button> : <p className={styles.review}>{record.review}</p>)}
  </article>;
}

export function Pagination({ page, hasNext, onChange }: { page: number; hasNext: boolean; onChange: (page: number) => void }) {
  if (page === 1 && !hasNext) return null;
  return <nav className={styles.pagination} aria-label="친구 목록 페이지"><button type="button" aria-label="이전 페이지" disabled={page === 1} onClick={() => onChange(page - 1)}><ChevronLeft size={18} /></button><span aria-live="polite">{page} 페이지</span><button type="button" aria-label="다음 페이지" disabled={!hasNext} onClick={() => onChange(page + 1)}><ChevronRight size={18} /></button></nav>;
}
