"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { FigureCard } from "@/lib/figure-cards";
import styles from "./glass-figure.module.css";

interface FigureHandle { setCards: (cards: FigureCard[]) => void; close: () => void; destroy: () => void }
interface FigureOptions {
  accent: string; cards: FigureCard[]; hint: boolean; cardWidth: number;
  onCardClick: (index: number) => void; onToggle: (open: boolean) => void;
}
declare global { interface Window { mountGlassFigure?: (stage: HTMLElement, options: FigureOptions) => FigureHandle | null } }

const SCRIPT = "/glass-figure/glass-figure.js";
let loading: Promise<void> | null = null;
/** The figure ships as a plain browser script; load it once and share it between mounts. */
function loadFigureScript() {
  if (window.mountGlassFigure) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT; script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { loading = null; script.remove(); reject(new Error("glass-figure failed to load")); };
    document.head.appendChild(script);
  });
  return loading;
}

export function GlassFigure({ cards, onCardClick, emptyHint }: { cards: FigureCard[]; onCardClick: (index: number) => void; emptyHint: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const figure = useRef<FigureHandle | null>(null);
  // The figure is mounted once; it reads the latest cards and handler through these refs.
  const latest = useRef({ cards, onCardClick });
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => { latest.current = { cards, onCardClick }; figure.current?.setCards(cards); }, [cards, onCardClick]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let cancelled = false;
    loadFigureScript().then(() => {
      if (cancelled || !window.mountGlassFigure) return;
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff4b21";
      const mounted = window.mountGlassFigure(element, {
        accent, cards: latest.current.cards, hint: false, cardWidth: 0.54,
        onCardClick: index => latest.current.onCardClick(index), onToggle: setOpen,
      });
      if (!mounted) { setUnavailable(true); return; }
      figure.current = mounted;
    }).catch(() => { if (!cancelled) setUnavailable(true); });
    return () => { cancelled = true; figure.current?.destroy(); figure.current = null; };
  }, []);

  return <div className={styles.wrap}>
    <div ref={stage} className={styles.stage} data-unavailable={unavailable || undefined} />
    {open && <button className={styles.close} onClick={() => figure.current?.close()}><X size={18} />닫기</button>}
    {unavailable
      ? <p className={styles.hint} role="status">이 기기에서는 3D 화면을 표시할 수 없어요.</p>
      : <p className={styles.hint} aria-live="polite">{!cards.length ? emptyHint : open ? "카드를 누르면 자세히 볼 수 있어요" : "머리를 눌러 내 취향 카드를 열어 보세요"}</p>}
  </div>;
}
