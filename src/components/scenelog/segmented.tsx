"use client";

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./scenelog.module.css";

export function Segmented<T extends string>({ items, value, onChange, label, disabled }: { items: { id: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (id: T) => void; label?: string; disabled?: boolean }) {
  const index = Math.max(0, items.findIndex(item => item.id === value));
  return <div className={styles.segmented} role="group" aria-label={label} style={{ "--count": items.length, "--index": index } as CSSProperties}>
    <span className={styles.segThumb} aria-hidden="true" />
    {items.map(item => <button key={item.id} type="button" aria-pressed={item.id === value} disabled={disabled} className={item.id === value ? styles.selectedSegment : ""} onClick={() => onChange(item.id)}>{item.icon && <item.icon size={17} strokeWidth={1.9} aria-hidden="true" />}{item.label}</button>)}
  </div>;
}
