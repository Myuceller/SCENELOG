"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { authMessage } from "@/lib/supabase/auth-errors";

export function useSupabaseUser() {
  const [session, setSession] = useState<{ user: User | null; loading: boolean; error: string | null }>({ user: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getSupabaseClient().auth.onAuthStateChange((_event, current) => {
        if (active) setSession({ user: current?.user ?? null, loading: false, error: null });
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (error) {
      queueMicrotask(() => { if (active) setSession({ user: null, loading: false, error: authMessage(error) }); });
    }
    return () => { active = false; unsubscribe?.(); };
  }, []);
  return session;
}
