"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { authMessage } from "@/lib/supabase/auth-errors";
import styles from "./auth.module.css";

export function AuthReturn({ resetPassword = false }: { resetPassword?: boolean }) {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    async function finish() {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has("error") || new URLSearchParams(window.location.hash.slice(1)).has("error")) {
          throw new Error("Invalid authentication link");
        }
        // Require a callback code instead of accepting an unrelated existing session.
        if (!params.has("code")) throw new Error("Missing authorization code");
        const { error: initError } = await getSupabaseClient().auth.initialize();
        if (initError) throw initError;
        const { data, error } = await getSupabaseClient().auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error("No session");
        if (!active) return;
        window.history.replaceState(null, "", window.location.pathname);
        if (resetPassword) setReady(true);
        else window.location.replace("/");
      } catch {
        if (active) setError("인증 링크가 만료되었거나 확인할 수 없습니다. 요청했던 브라우저에서 열거나 다시 요청해 주세요.");
      }
    }
    void finish();
    return () => { active = false; };
  }, [resetPassword]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setDone(true);
    } catch (error) { setError(authMessage(error)); }
    finally { setBusy(false); }
  }

  return <main style={{ maxWidth: 440, margin: "80px auto", padding: 24 }}>
    <h1>{resetPassword ? "비밀번호 재설정" : "로그인 확인"}</h1>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {done ? <p role="status">비밀번호를 변경했습니다.</p> : ready ? <form className={styles.form} onSubmit={submit}>
      <label>새 비밀번호<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>
      <button className={styles.primary} disabled={busy}>{busy ? "변경 중…" : "비밀번호 변경"}</button>
    </form> : !error && <p>인증 링크를 확인하는 중입니다.</p>}
    <p><Link href="/">SceneLog로 돌아가기</Link></p>
  </main>;
}
