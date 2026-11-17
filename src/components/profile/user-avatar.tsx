import { UserRound } from "lucide-react";
import styles from "./user-avatar.module.css";

export function UserAvatar({ userId, name, size = "small" }: { userId: string; name: string; size?: "small" | "large" }) {
  // Stable across browsers and sessions without storing a separate color value.
  let hash = 2166136261;
  for (const character of userId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const hue = (hash >>> 0) % 360;

  return <span
    className={styles.avatar}
    data-size={size}
    role="img"
    aria-label={`${name}의 프로필`}
    title={name}
    style={{ backgroundColor: `hsl(${hue} 45% 90%)`, color: `hsl(${hue} 35% 30%)` }}
  >
    <UserRound size={size === "large" ? 36 : 20} strokeWidth={1.8} aria-hidden="true" />
  </span>;
}
