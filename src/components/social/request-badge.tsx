import styles from "./request-badge.module.css";

export function RequestBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return <span className={styles.badge} aria-hidden="true">{count > 99 ? "99+" : count}</span>;
}
