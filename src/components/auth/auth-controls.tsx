"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, LogOut, MailCheck, MessageSquareText, Settings, Star } from "lucide-react";
import { validateAuthForm, validateEmail, type AuthField, type AuthMode } from "@/lib/supabase/auth-form";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { authMessage } from "@/lib/supabase/auth-errors";
import { Modal } from "@/components/scenelog/ui";
import { UserAvatar } from "@/components/profile/user-avatar";
import styles from "./auth.module.css";

export function AuthControls({ user, disabled = false, stats, onOpenCollection }: {
  user: User | null;
  disabled?: boolean;
  stats?: { ratedMovies: number; reviews: number };
  onOpenCollection: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "나의 계정";
  function openCollection() {
    setOpen(false);
    onOpenCollection();
  }
  async function logout() {
    setBusy(true); setError("");
    try { const { error } = await getSupabaseClient().auth.signOut({ scope: "local" }); if (error) throw error; setOpen(false); }
    catch (error) { setError(authMessage(error)); }
    finally { setBusy(false); }
  }
  return <>
    {user ? <button type="button" className={styles.profileTrigger} aria-label="내 프로필 열기" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setError(""); setOpen(true); }}>
      <UserAvatar userId={user.id} name={name} />
    </button> : <div className={styles.controls}><button onClick={() => setOpen(true)}>로그인 / 가입</button></div>}
    {open && (user ? <Modal title="내 프로필" onClose={() => setOpen(false)}>
      <div className={styles.profileSummary}>
        <UserAvatar userId={user.id} name={name} size="large" />
        <strong className={styles.profileName}>{name}</strong>
      </div>
      <div className={styles.profileStats}>
        <button type="button" onClick={openCollection}><span className={styles.statLabel}><Star size={17} aria-hidden="true" />평가한 영화</span><span className={styles.statValue}>{stats ? stats.ratedMovies.toLocaleString("ko-KR") : "—"}<span>편</span></span></button>
        <button type="button" onClick={openCollection}><span className={styles.statLabel}><MessageSquareText size={17} aria-hidden="true" />작성한 리뷰</span><span className={styles.statValue}>{stats ? stats.reviews.toLocaleString("ko-KR") : "—"}<span>개</span></span></button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.profileActions}>
        <Link href="/settings" className={styles.settingsButton} onClick={() => setOpen(false)}><Settings size={18} aria-hidden="true" />설정</Link>
        <button type="button" className={styles.logoutButton} onClick={logout} disabled={disabled || busy}><LogOut size={18} aria-hidden="true" />{busy ? "로그아웃 중…" : "로그아웃"}</button>
      </div>
    </Modal> : <LoginDialog onClose={() => setOpen(false)} />)}
  </>;
}

export function LoginScreen({ error }: { error: string | null }) {
  return <main id="main" className={styles.welcome}>
    <Link href="/" className={styles.brand}>SceneLog<span>®</span></Link>
    <section className={styles.loginCard} aria-label="로그인">
      <span className={styles.eyebrow}>YOUR PERSONAL FILM ARCHIVE</span>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <LoginForm />
    </section>
    <p className={styles.tagline}>COLLECT SCENES. KEEP YOUR POINT OF VIEW.</p>
  </main>;
}

function LoginDialog({ onClose }: { onClose: () => void }) {
  return <Modal title="SceneLog 로그인" onClose={onClose}><LoginForm onSuccess={onClose} /></Modal>;
}

function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [touched, setTouched] = useState<Partial<Record<AuthField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const signup = mode === "signup";
  const errors = validateAuthForm(mode, { email, password, passwordConfirm });
  function fieldError(field: AuthField) {
    return submitted || touched[field] || (field === "passwordConfirm" && passwordConfirm.length > 0) ? errors[field] : undefined;
  }
  function touch(field: AuthField) { setTouched(current => ({ ...current, [field]: true })); }
  function changeMode(next: AuthMode) {
    setMode(next); setPassword(""); setPasswordConfirm(""); setTouched({});
    setSubmitted(false); setError(""); setNotice(""); setConfirmationSent(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setSubmitted(true); setError(""); setNotice("");
    const firstInvalid = (["email", "password", "passwordConfirm"] as const).find(field => errors[field]);
    if (firstInvalid) {
      (formRef.current?.elements.namedItem(firstInvalid) as HTMLInputElement | null)?.focus();
      return;
    }
    pending.current = true; setBusy(true);
    try {
      const auth = getSupabaseClient().auth;
      const { data, error } = signup
        ? await auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
        : await auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword(""); setPasswordConfirm(""); setSubmitted(false); setTouched({});
      if (data.session) onSuccess?.();
      else setConfirmationSent(true);
    } catch (error) { setError(authMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function google() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try { const { error } = await getSupabaseClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } }); if (error) throw error; }
    catch (error) { setError(authMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function resetPassword() {
    if (pending.current) return;
    touch("email");
    if (validateEmail(email)) { (formRef.current?.elements.namedItem("email") as HTMLInputElement | null)?.focus(); return; }
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/reset-password` });
      if (error) throw error;
      setNotice("가입된 이메일이라면 비밀번호 재설정 안내가 도착합니다.");
    } catch (error) { setError(authMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  if (confirmationSent) return <div className={styles.confirmation} role="status">
    <MailCheck size={32} aria-hidden="true" />
    <h1 className={styles.title}>이메일을 확인해 주세요.</h1>
    <p className={styles.description}><strong>{email.trim()}</strong>의 가입 확인 메일에서 링크를 누르면 가입이 완료돼요. 가입을 시작한 이 브라우저에서 열어 주세요.</p>
    <p className={styles.hint}>메일이 보이지 않으면 스팸함을 확인해 주세요. 이미 가입한 이메일이라면 바로 로그인할 수 있어요.</p>
    <div className={styles.form}><button className={styles.primary} onClick={() => changeMode("login")}>로그인으로 돌아가기</button><button onClick={() => changeMode("signup")}>이메일을 잘못 입력했나요?</button></div>
  </div>;
  return <>
    <h1 className={styles.title}>{signup ? "나만의 아카이브 시작하기" : "나의 장면을 이어서."}</h1>
    <p className={styles.description}>{signup ? "좋아한 영화와 나의 별점을 한곳에 모아보세요." : "로그인하면 내 영화 기록과 보고 싶은 영화를 다른 기기에서도 볼 수 있어요."}</p>
    <form ref={formRef} className={styles.form} onSubmit={submit} noValidate aria-busy={busy}>
      <div className={styles.field}>
        <label htmlFor={`${id}-email`}>이메일</label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setError(""); setNotice(""); }} onBlur={() => touch("email")} disabled={busy} aria-invalid={!!fieldError("email")} aria-describedby={fieldError("email") ? `${id}-email-error` : signup ? `${id}-email-hint` : undefined} />
        {fieldError("email") ? <p id={`${id}-email-error`} className={styles.fieldError}>{fieldError("email")}</p> : signup && <p id={`${id}-email-hint`} className={styles.hint}>가입 확인 메일을 받을 수 있는 주소를 입력해 주세요.</p>}
      </div>
      <PasswordField key={`${mode}-password`} name="password" label="비밀번호" value={password} onChange={value => { setPassword(value); setError(""); }} onBlur={() => touch("password")} disabled={busy} signup={signup} error={fieldError("password")} hint={signup ? "8자 이상으로 입력해 주세요." : undefined} />
      {signup && <PasswordField key="password-confirm" name="passwordConfirm" label="비밀번호 확인" value={passwordConfirm} onChange={value => { setPasswordConfirm(value); setError(""); }} onBlur={() => touch("passwordConfirm")} disabled={busy} signup error={fieldError("passwordConfirm")} matched={passwordConfirm.length > 0 && password === passwordConfirm && !errors.password} />}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <button type="submit" className={styles.primary} disabled={busy}>{busy ? "처리 중…" : signup ? "회원가입" : "로그인"}</button>
      {signup && <p className={styles.hint}>가입 후 이메일 인증을 완료하면 나의 기록을 시작할 수 있어요.</p>}
      {process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED === "true" && <button type="button" onClick={google} disabled={busy}>Google로 계속하기</button>}
      <div className={styles.links}><button type="button" disabled={busy} onClick={() => changeMode(signup ? "login" : "signup")}>{signup ? "이미 계정이 있나요? 로그인" : "처음이신가요? 회원가입"}</button>{!signup && <button type="button" onClick={resetPassword} disabled={busy}>비밀번호 재설정</button>}</div>
    </form>
  </>;
}

function PasswordField({ name, label, value, onChange, onBlur, disabled, signup, error, hint, matched }: {
  name: "password" | "passwordConfirm"; label: string; value: string;
  onChange: (value: string) => void; onBlur: () => void; disabled: boolean; signup: boolean;
  error?: string; hint?: string; matched?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const message = error || (matched ? "비밀번호가 일치해요." : hint);
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.passwordInput}>
      <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} autoCapitalize="none" spellCheck={false} minLength={signup ? 8 : 1} maxLength={128} required value={value} onChange={event => onChange(event.target.value)} onBlur={onBlur} disabled={disabled} aria-invalid={!!error} aria-describedby={message ? `${id}-message` : undefined} />
      <button type="button" className={styles.visibilityButton} aria-label={`${label} ${visible ? "숨기기" : "보기"}`} aria-pressed={visible} onClick={() => setVisible(current => !current)} disabled={disabled}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
    </div>
    <p id={`${id}-message`} className={error ? styles.fieldError : matched ? styles.success : styles.hint} aria-live="polite">{message}</p>
  </div>;
}
