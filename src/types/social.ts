import type { AchievementId } from "@/lib/achievements";
import type { ArchiveMovie } from "@/lib/archive-movies";

export type CollectionVisibility = "private" | "friends" | "public";
export interface OwnProfile {
  id: string;
  displayName: string;
  collectionVisibility: CollectionVisibility;
  avatarUrl: string | null;
  equippedTitle: AchievementId;
}
export type FriendshipState = "none" | "outgoing" | "incoming" | "friends";
export type FriendshipAction = "request" | "accept" | "decline" | "cancel" | "remove";
export interface SocialProfile extends OwnProfile {
  canViewCollection: boolean;
  friendship: FriendshipState;
  friendCount: number;
  ratedCount: number | null;
  reviewCount: number | null;
}
export interface SocialRecord {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  equippedTitle: AchievementId;
  movie: ArchiveMovie;
  rating: number | null;
  review: string;
  spoiler: boolean;
  createdAt: string;
}
export type SocialTab = "feed" | "discover" | "friends" | "incoming" | "outgoing";
export interface SocialList { users: SocialProfile[]; records: SocialRecord[]; page: number; hasNext: boolean }
export interface SocialCollection { profile: SocialProfile; records: SocialRecord[]; page: number; hasNext: boolean }
export interface SocialSummary { incomingRequests: number }
