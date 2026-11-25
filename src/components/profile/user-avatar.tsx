"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { UserRound, Eye, Moon, Flame, Ghost, Skull, Crown, Smile, Laugh, PartyPopper, Sparkles, Drama, Star, Orbit, Rocket, Telescope, Atom, Zap, Swords, Shield, Heart, HeartHandshake, Flower2, WandSparkles, Palette, Feather, BookOpen, Clapperboard, Search, Fingerprint, KeyRound, Compass, Map, Mountain, Globe, Camera, Mic, House, Armchair, Gem, Film, Ticket, CalendarDays, PenLine, RotateCcw, Trophy } from "lucide-react";
import type { AvatarSymbol } from "@/lib/avatar-ornaments";
const symbols = { Eye, Moon, Flame, Ghost, Skull, Crown, Smile, Laugh, PartyPopper, Sparkles, Drama, Star, Orbit, Rocket, Telescope, Atom, Zap, Swords, Shield, Heart, HeartHandshake, Flower2, WandSparkles, Palette, Feather, BookOpen, Clapperboard, Search, Fingerprint, KeyRound, Compass, Map, Mountain, Globe, Camera, Mic, House, Armchair, Gem, Film, Ticket, CalendarDays, PenLine, RotateCcw, Trophy };
function OrnamentSymbol({ symbol, size }: { symbol: AvatarSymbol; size: number }) { const Icon = symbols[symbol]; return <Icon size={size} strokeWidth={2} />; }
import { findAchievement } from "@/lib/achievements";
import styles from "./user-avatar.module.css";

export function UserAvatar({ userId, name, size = "small", imageUrl, titleId, animate = false }: {
  userId: string; name: string; size?: "small" | "large" | "preview"; imageUrl?: string | null; titleId?: string | null; animate?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const title = findAchievement(titleId);
  let hash = 2166136261;
  for (const character of userId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const hue = (hash >>> 0) % 360;
  const pixels = size === "preview" ? 96 : size === "large" ? 72 : 34;
  return <span className={styles.avatar} data-size={size} data-frame={title.ornament?.frame} data-level={title.ornament?.level} data-metal={title.ornament?.metal} data-effect={title.effect} data-animate={animate || undefined}
    role="img" aria-label={`${name}의 프로필 · ${title.title}`} title={title.title}
    style={{ "--title-color": title.ornament?.color ?? title.color, "--avatar-bg": `hsl(${hue} 45% 90%)`, "--avatar-ink": `hsl(${hue} 35% 30%)` } as CSSProperties}>
    {title.ornament?.metal && <span className={styles.aura} aria-hidden="true" />}
    {title.ornament?.metal && <span className={styles.metalGlint} aria-hidden="true">✦</span>}
    {(title.ornament?.frame === "laurel" || title.ornament?.frame === "royal") && <svg className={styles.laurel} viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M28 91C8 77 2 51 14 28M72 91C92 77 98 51 86 28" />
      <path d="M18 79Q5 78 3 66Q16 65 18 79ZM11 63Q0 59 3 46Q15 49 11 63ZM12 45Q4 34 12 24Q22 34 12 45ZM82 79Q95 78 97 66Q84 65 82 79ZM89 63Q100 59 97 46Q85 49 89 63ZM88 45Q96 34 88 24Q78 34 88 45Z" fill="currentColor" stroke="none" />
    </svg>}
    {title.ornament?.frame === "royal" && <span className={styles.crest} aria-hidden="true"><Crown size={size === "small" ? 14 : 25} /></span>}
    <span className={styles.photo}>
      {imageUrl && failedUrl !== imageUrl ? <Image src={imageUrl} alt="" width={pixels} height={pixels} unoptimized onError={() => setFailedUrl(imageUrl)} /> : <UserRound size={pixels / 2} strokeWidth={1.8} aria-hidden="true" />}
    </span>
    <span className={styles.effect} aria-hidden="true">{title.ornament?.symbol ? <OrnamentSymbol symbol={title.ornament.symbol} size={size === "small" ? 12 : 22} /> : title.mark}</span>
    <span className={styles.echo} aria-hidden="true">{title.ornament?.echo ? <OrnamentSymbol symbol={title.ornament.echo} size={size === "small" ? 10 : 17} /> : title.effect === "laugh" ? "ㅋ" : title.effect === "heart" ? "♡" : "✦"}</span>
  </span>;
}
