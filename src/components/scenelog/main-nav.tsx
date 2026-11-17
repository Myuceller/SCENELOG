"use client";

import { useEffect, useLayoutEffect, useRef, type ComponentType, type ReactNode } from "react";
import styles from "./scenelog.module.css";

type Item<T extends string> = { id: T; label: string; short: string; icon: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true" | "false" }> };

/** Main menu. One pill slides to the active item, so the highlight glides instead of jumping. */
export function MainNav<T extends string>({ items, view, navigate, labelFor, extra }: {
  items: readonly Item<T>[]; view: string; navigate: (view: T) => void;
  /** Accessible name for an item, when it is more than the plain label. */ labelFor?: (item: Item<T>) => string;
  /** Extra content inside an item, such as a count badge. */ extra?: (item: Item<T>) => ReactNode;
}) {
  const nav = useRef<HTMLElement>(null);

  // Put the pill under the active link. Done with CSS variables so no re-render is needed while it moves.
  const place = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    place.current = () => {
      const element = nav.current;
      if (!element) return;
      const active = element.querySelector<HTMLElement>("[aria-current=page]");
      if (!active) { element.removeAttribute("data-ready"); return; }
      element.style.setProperty("--pill-x", `${active.offsetLeft}px`);
      element.style.setProperty("--pill-y", `${active.offsetTop}px`);
      element.style.setProperty("--pill-w", `${active.offsetWidth}px`);
      element.style.setProperty("--pill-h", `${active.offsetHeight}px`);
      // First placement jumps; every later one glides. Flush the position before the transition is switched on.
      if (!element.hasAttribute("data-ready")) { void element.offsetWidth; element.setAttribute("data-ready", ""); }
    };
    place.current();
  }, [view]);

  useEffect(() => {
    const element = nav.current;
    if (!element) return;
    const run = () => place.current();
    const observer = new ResizeObserver(run);
    observer.observe(element);
    element.querySelectorAll("a").forEach(link => observer.observe(link));
    document.fonts?.ready.then(run);
    return () => observer.disconnect();
  }, []);

  return <nav className={styles.nav} ref={nav} aria-label="주 메뉴">
    <span className={styles.navPill} aria-hidden="true" />
    {items.map(item => <a href={`#${item.id}`} key={item.id} aria-label={labelFor ? labelFor(item) : item.label} aria-current={view === item.id ? "page" : undefined} className={view === item.id ? styles.activeNav : ""} onClick={event => { event.preventDefault(); navigate(item.id); }}>
      <item.icon size={22} strokeWidth={1.8} aria-hidden="true" /><span className={styles.navFull}>{item.label}</span><span className={styles.navShort} aria-hidden="true">{item.short}</span>{extra?.(item)}
    </a>)}
  </nav>;
}
