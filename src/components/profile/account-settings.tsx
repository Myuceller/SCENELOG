"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { LoginScreen } from "@/components/auth/login-screen";
import { useSupabaseUser } from "@/hooks/use-supabase-user";
import { getSupabaseClient } from "@/lib/supabase/client";
import { authMessage } from "@/lib/supabase/auth-errors";
import { SocialSettings } from "./social-settings";
import { useOwnProfile } from "@/hooks/use-own-profile";
import styles from "./account-settings.module.css";

export function AccountSettings() {
  const { user, loading, error: sessionError } = useSupabaseUser();
  const own = useOwnProfile(user?.id);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resetPassword() {
    if (!user?.email || pending.current) return;
    pending.current = true;
    setBusy(true); setError("");
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error) { setError(authMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }

  if (loading) return <main id="main" className={styles.page}><LoadingIndicator /></main>;
  if (!user) return <LoginScreen error={sessionError} />;
  const emailLogin = user.identities?.some(identity => identity.provider === "email");

  return <main id="main" className={styles.page}>
    <Link href="/" className={styles.back}><ArrowLeft size={18} aria-hidden="true" />SceneLog</Link>
    <h1>설정</h1>
    <section className={styles.card} aria-labelledby="account-heading">
      <h2 id="account-heading">계정</h2>
      <SocialSettings key={user.id} profile={own.profile} error={own.error} loading={own.loading} onRetry={own.reload}>
        <dl className={styles.details}><div><dt>이메일</dt><dd>{user.email || "연결된 이메일 없음"}</dd></div></dl>
      </SocialSettings>
    </section>
    {emailLogin && <section className={styles.card} aria-labelledby="security-heading">
      <h2 id="security-heading">보안</h2>
      <div className={styles.security}><div><strong>비밀번호</strong><p>가입한 이메일로 재설정 링크를 받아요.</p></div>
        <button type="button" disabled={busy || sent || !user.email} onClick={resetPassword}><KeyRound size={17} aria-hidden="true" />{busy ? "전송 중…" : sent ? "메일 전송 완료" : "비밀번호 재설정"}</button>
      </div>
      {sent && <p role="status" className={styles.success}>메일을 확인해 주세요. 링크는 이 브라우저에서 열어 주세요.</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>}
  </main>;
}
