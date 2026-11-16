"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createAccountJournalStore } from "@/lib/account-journals";

export function useAccountJournals(userId: string) {
  const store = useMemo(() => createAccountJournalStore(userId, () => localStorage), [userId]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === store.key || event.key === null) store.refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);
  return { ...useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot), save: store.save };
}
