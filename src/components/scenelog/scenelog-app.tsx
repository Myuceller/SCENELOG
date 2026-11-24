"use client";

import dynamic from "next/dynamic";
import { LoginScreen } from "@/components/auth/login-screen";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { useSupabaseUser } from "@/hooks/use-supabase-user";
import styles from "./app-loading.module.css";

function SessionLoading() {
  return <main id="main" className={styles.pending} aria-busy="true"><LoadingIndicator /></main>;
}

// Only authenticated visitors need the archive and discovery UI.
const CloudWorkspace = dynamic(() => import("./cloud-workspace").then(module => module.CloudWorkspace), {
  loading: SessionLoading,
  // Auth is resolved in the browser, so this workspace never contributes SSR HTML.
  ssr: false,
});

export function SceneLogApp() {
  const session = useSupabaseUser();
  if (session.loading) return <SessionLoading />;
  return session.user
    ? <CloudWorkspace key={session.user.id} user={session.user} />
    : <LoginScreen error={session.error} />;
}
