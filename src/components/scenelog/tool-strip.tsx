"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./tool-strip.module.css";

/** A button with a floating panel. The parent owns which panel is open, so only one is ever shown. */
export function Popover({ open, onToggle, onClose, button, label, children }: {
  open: boolean; onToggle: () => void; onClose: () => void; button: ReactNode; label: string; children: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [open, onClose]);
  return <div className={styles.popWrap} ref={wrap}>
    <button type="button" className={styles.popButton} aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={onToggle}>{button}</button>
    {open && <div className={styles.panel} role="dialog" aria-label={label}>{children}</div>}
  </div>;
}
