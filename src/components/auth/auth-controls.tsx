"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { findAchievement } from "@/lib/achievements";
import { LoginForm } from "./login-screen";
import Link from "next/link";
import { LogOut, MessageSquareText, Settings, Star } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { authMessage } from "@/lib/supabase/auth-errors";
import { Modal } from "@/components/scenelog/ui";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { OwnProfile } from "@/types/social";
import styles from "./auth.module.css";

const AchievementsPanel = dynamic(() => import("@/components/profile/achievements-panel").then(module => module.AchievementsPanel), { loading: () => <LoadingIndicator label="도전과제를 준비하고 있어요…" /> });

export function AuthControls({ user, disabled = false, loading = false, stats, onOpenCollection, profile }: {
  user: User | null;
  disabled?: boolean;
  loading?: boolean;
  stats?: { ratedMovies: number; reviews: number };
  onOpenCollection: () => void;
  profile?: OwnProfile;
}) {
  const [open, setOpen] = useState<"login" | "profile" | null>(null);
  const [profileTab, setProfileTab] = useState<"profile" | "achievements">("profile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = profile?.displayName || user?.user_metadata?.full_name || "나의 계정";
  function openCollection() {
    setOpen(null);
    onOpenCollection();
  }
  async function logout() {
    setBusy(true); setError("");
    try { const { error } = await getSupabaseClient().auth.signOut({ scope: "local" }); if (error) throw error; setOpen(null); }
    catch (error) { setError(authMessage(error)); }
    finally { setBusy(false); }
  }
  return <>
    {loading ? <LoadingIndicator compact /> : user ? <button type="button" className={styles.profileTrigger} aria-label="내 프로필 열기" aria-haspopup="dialog" aria-expanded={open === "profile"} onClick={() => { setError(""); setProfileTab("profile"); setOpen("profile"); }}>
      <UserAvatar userId={user.id} name={name} imageUrl={profile?.avatarUrl} titleId={profile?.equippedTitle} key={profile?.equippedTitle} animate />
    </button> : <div className={styles.controls}><button onClick={() => setOpen("login")}>로그인 / 가입</button></div>}
    {!loading && open === "profile" && user && <Modal title="내 프로필" wide={profileTab === "achievements"} onClose={() => setOpen(null)}>
      <div className={styles.profileTabs} role="tablist" aria-label="내 프로필 메뉴" onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "profile" : event.key === "End" ? "achievements" : profileTab === "profile" ? "achievements" : "profile";
        setProfileTab(next);
        event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next === "profile" ? 0 : 1]?.focus();
      }}>
        <button id="profile-overview-tab" role="tab" tabIndex={profileTab === "profile" ? 0 : -1} aria-selected={profileTab === "profile"} aria-controls="profile-overview-panel" onClick={() => setProfileTab("profile")}>내 프로필</button>
        <button id="profile-achievements-tab" role="tab" tabIndex={profileTab === "achievements" ? 0 : -1} aria-selected={profileTab === "achievements"} aria-controls="profile-achievements-panel" onClick={() => setProfileTab("achievements")}>도전과제</button>
      </div>
      {profileTab === "achievements" ? <div id="profile-achievements-panel" role="tabpanel" aria-labelledby="profile-achievements-tab"><AchievementsPanel key={user.id} userId={user.id} name={name} profile={profile} /></div> : <div id="profile-overview-panel" role="tabpanel" aria-labelledby="profile-overview-tab">
      <div className={styles.profileSummary}>
        <UserAvatar userId={user.id} name={name} size="large" imageUrl={profile?.avatarUrl} titleId={profile?.equippedTitle} key={profile?.equippedTitle} animate />
        <strong className={styles.profileName}>{name}</strong>
        <span className={styles.profileTitle}>{findAchievement(profile?.equippedTitle).title}</span>
      </div>
      <div className={styles.profileStats}>
        <button type="button" onClick={openCollection}><span className={styles.statLabel}><Star size={17} aria-hidden="true" />평가한 영화</span><span className={styles.statValue}>{stats ? stats.ratedMovies.toLocaleString("ko-KR") : "—"}<span>편</span></span></button>
        <button type="button" onClick={openCollection}><span className={styles.statLabel}><MessageSquareText size={17} aria-hidden="true" />작성한 리뷰</span><span className={styles.statValue}>{stats ? stats.reviews.toLocaleString("ko-KR") : "—"}<span>개</span></span></button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.profileActions}>
        <Link href="/settings" className={styles.settingsButton} onClick={() => setOpen(null)}><Settings size={18} aria-hidden="true" />설정</Link>
        <button type="button" className={styles.logoutButton} onClick={logout} disabled={disabled || busy}><LogOut size={18} aria-hidden="true" />{busy ? "로그아웃 중…" : "로그아웃"}</button>
      </div>
      </div>}
    </Modal>}
    {open === "login" && !user && <LoginDialog onClose={() => setOpen(null)} />}
  </>;
}

function LoginDialog({ onClose }: { onClose: () => void }) {
  return <Modal title="SceneLog 로그인" onClose={onClose}><LoginForm onSuccess={onClose} /></Modal>;
}
