"use client";

import { useState } from "react";
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

export function AuthControls({ user, disabled = false, loading = false, stats, onOpenCollection, profile }: {
  user: User | null;
  disabled?: boolean;
  loading?: boolean;
  stats?: { ratedMovies: number; reviews: number };
  onOpenCollection: () => void;
  profile?: OwnProfile;
}) {
  const [open, setOpen] = useState<"login" | "profile" | null>(null);
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
    {loading ? <LoadingIndicator compact /> : user ? <button type="button" className={styles.profileTrigger} aria-label="내 프로필 열기" aria-haspopup="dialog" aria-expanded={open === "profile"} onClick={() => { setError(""); setOpen("profile"); }}>
      <UserAvatar userId={user.id} name={name} imageUrl={profile?.avatarUrl} />
    </button> : <div className={styles.controls}><button onClick={() => setOpen("login")}>로그인 / 가입</button></div>}
    {!loading && open === "profile" && user && <Modal title="내 프로필" onClose={() => setOpen(null)}>
      <div className={styles.profileSummary}>
        <UserAvatar userId={user.id} name={name} size="large" imageUrl={profile?.avatarUrl} />
        <strong className={styles.profileName}>{name}</strong>
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
    </Modal>}
    {open === "login" && !user && <LoginDialog onClose={() => setOpen(null)} />}
  </>;
}

function LoginDialog({ onClose }: { onClose: () => void }) {
  return <Modal title="SceneLog 로그인" onClose={onClose}><LoginForm onSuccess={onClose} /></Modal>;
}
