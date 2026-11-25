"use client";

import dynamic from "next/dynamic";
import { LoginScreen } from "@/components/auth/login-screen";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { useSupabaseUser } from "@/hooks/use-supabase-user";
import { useCloudArchive } from "@/hooks/use-cloud-archive";
import type { User } from "@supabase/supabase-js";
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

function AuthenticatedWorkspace({ user }: { user: User }) {
  // Start the archive request while the workspace chunk downloads. Keeping this
  // hook outside the lazy component removes the JS -> mount -> API waterfall.
  // The keyed parent still aborts requests and clears state on account changes.
  const store = useCloudArchive(user);
  return <CloudWorkspace user={user} store={store} />;
}

export function SceneLogApp() {
  const session = useSupabaseUser();
  if (session.loading) return <SessionLoading />;
  return session.user
    ? <AuthenticatedWorkspace key={session.user.id} user={session.user} />
    : <LoginScreen error={session.error} />;
}
