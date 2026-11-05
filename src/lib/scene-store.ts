"use client";

import { useSyncExternalStore } from "react";
import { createSeedState, validState, STORAGE_KEY, type SceneState } from "./scene-model";
export * from "./scene-model";

type Snapshot = { state: SceneState | null; storageError: boolean };
const serverSnapshot: Snapshot = { state: null, storageError: false };
let snapshot: Snapshot = serverSnapshot;
const listeners = new Set<() => void>();

function getSnapshot(): Snapshot {
  if (snapshot.state) return snapshot;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    snapshot = { state: validState(parsed) ? parsed : createSeedState(), storageError: false };
  } catch {
    snapshot = { state: createSeedState(), storageError: true };
  }
  return snapshot;
}

function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  snapshot = serverSnapshot;
  getSnapshot();
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function update(fn: (current: SceneState) => SceneState) {
  const current = getSnapshot().state;
  if (!current) return;
  const state = fn(current);
  let storageError = false;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { storageError = true; }
  snapshot = { state, storageError };
  listeners.forEach(listener => listener());
}

/** Server rendering stays deterministic; browser storage is the source of truth. */
export function useSceneStore() {
  return { ...useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot), update };
}
