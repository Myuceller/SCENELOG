import styles from "./loading-indicator.module.css";

export function LoadingIndicator({ label = "로딩 중…", compact = false }: { label?: string; compact?: boolean }) {
  return <span className={`${styles.loading} ${compact ? styles.compact : ""}`} role="status">
    <span className={styles.spinner} aria-hidden="true" />
    <span className={compact ? "sr-only" : undefined}>{label}</span>
  </span>;
}
