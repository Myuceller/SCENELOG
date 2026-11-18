"use client";

import Image from "next/image";
import { useState } from "react";
import { UserRound } from "lucide-react";
import styles from "./user-avatar.module.css";

export function UserAvatar({ userId, name, size = "small", imageUrl }: { userId: string; name: string; size?: "small" | "large"; imageUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
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
    {imageUrl && failedUrl !== imageUrl ? <Image src={imageUrl} alt="" width={size === "large" ? 72 : 34} height={size === "large" ? 72 : 34} unoptimized onError={() => setFailedUrl(imageUrl)} /> : <UserRound size={size === "large" ? 36 : 20} strokeWidth={1.8} aria-hidden="true" />}
  </span>;
}
