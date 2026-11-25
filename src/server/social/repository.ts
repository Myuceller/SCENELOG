import "server-only";
import { findAchievement } from "@/lib/achievements";
import type { User } from "@supabase/supabase-js";
import { initialProfileName } from "@/lib/profile-name";
import { getDatabasePool, type DatabaseClient } from "@/server/db/pool";
import { ApiError } from "@/server/http/errors";
import type { CollectionVisibility, SocialSummary, FriendshipAction, FriendshipState, OwnProfile, SocialCollection, SocialList, SocialProfile, SocialRecord, SocialTab } from "@/types/social";
import { avatarUrl } from "@/server/supabase/storage";
import { inTransaction } from "@/server/db/transaction";

type WithAvatarPath<T> = Omit<T, "avatarUrl"> & { avatarPath: string | null };
function withAvatar<T extends { avatarPath: string | null; equippedTitle: string }>(row: T) {
  const { avatarPath, ...rest } = row;
  return { ...rest, equippedTitle: findAchievement(row.equippedTitle).id, avatarUrl: avatarUrl(avatarPath) };
}

export type SocialActor = string | Pick<User, "id" | "user_metadata">;
function actorId(actor: SocialActor) { return typeof actor === "string" ? actor : actor.id; }
function actorName(actor: SocialActor) { return initialProfileName(actorId(actor), typeof actor === "string" ? undefined : actor.user_metadata?.display_name); }

const PAGE_SIZE = 10;
// Reused in profile statistics, records, search results and the friends feed.
const CAN_VIEW = `(p.user_id = $1 OR p.collection_visibility = 'public' OR
  (p.collection_visibility = 'friends' AND EXISTS (SELECT 1 FROM scenelog.friendships access
    WHERE access.status = 'accepted' AND ((access.requester_id = $1 AND access.recipient_id = p.user_id)
      OR (access.recipient_id = $1 AND access.requester_id = p.user_id)))))`;
const PROFILE = `p.user_id AS id, p.display_name AS "displayName", p.avatar_path AS "avatarPath", p.equipped_title AS "equippedTitle", p.collection_visibility AS "collectionVisibility",
  ${CAN_VIEW} AS "canViewCollection",
  COALESCE((SELECT CASE WHEN f.status = 'accepted' THEN 'friends'
    WHEN f.requester_id = $1 THEN 'outgoing' ELSE 'incoming' END FROM scenelog.friendships f
    WHERE (f.requester_id = $1 AND f.recipient_id = p.user_id)
       OR (f.recipient_id = $1 AND f.requester_id = p.user_id)), 'none') AS friendship,
  (SELECT count(*)::int FROM scenelog.friendships WHERE status = 'accepted'
    AND (requester_id = p.user_id OR recipient_id = p.user_id)) AS "friendCount",
  CASE WHEN ${CAN_VIEW} THEN
    (SELECT count(*)::int FROM (SELECT DISTINCT ON (movie_id) rating_tenths FROM scenelog.viewing_logs
      WHERE user_id = p.user_id ORDER BY movie_id, created_at DESC, position DESC) latest WHERE rating_tenths IS NOT NULL)
    ELSE NULL END AS "ratedCount",
  CASE WHEN ${CAN_VIEW} THEN
    (SELECT count(*)::int FROM scenelog.viewing_logs WHERE user_id = p.user_id AND btrim(review) <> '')
    ELSE NULL END AS "reviewCount"`;
const RECORD = `l.id, l.user_id AS "userId", p.display_name AS "displayName", p.avatar_path AS "avatarPath", p.equipped_title AS "equippedTitle", m.metadata AS movie,
  l.rating_tenths / 10.0 AS rating, l.review, l.spoiler,
  to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"`;

async function withSocial<T>(actor: SocialActor, work: (client: DatabaseClient) => Promise<T>): Promise<T> {
  const uid = actorId(actor);
  try {
    const client = await getDatabasePool().connect();
    try {
      await client.query(`INSERT INTO scenelog.profiles (user_id, display_name) VALUES ($1, $2)
        ON CONFLICT (user_id) DO NOTHING`, [uid, actorName(actor)]);
      return await work(client);
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "SOCIAL_UNAVAILABLE", "친구 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export function readSocialProfile(actor: SocialActor, target = actorId(actor), page = 1): Promise<SocialCollection> {
  const uid = actorId(actor);
  return withSocial(actor, async client => {
    const { rows: [profile] } = await client.query<WithAvatarPath<SocialProfile>>(`SELECT ${PROFILE} FROM scenelog.profiles p WHERE p.user_id = $2`, [uid, target]);
    if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    // Repeat the visibility check in the records query, including after a privacy change.
    const { rows } = await client.query<WithAvatarPath<SocialRecord>>(`SELECT ${RECORD} FROM (
      SELECT DISTINCT ON (movie_id) * FROM scenelog.viewing_logs WHERE user_id = $2
      ORDER BY movie_id, created_at DESC, position DESC
    ) l JOIN scenelog.profiles p ON p.user_id = l.user_id
      JOIN scenelog.archive_movies m ON m.user_id = l.user_id AND m.movie_id = l.movie_id
      WHERE ${CAN_VIEW}
      ORDER BY l.created_at DESC, l.id DESC LIMIT $3 OFFSET $4`, [uid, target, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE]);
    return { profile: withAvatar(profile), records: rows.slice(0, PAGE_SIZE).map(numericRating), page, hasNext: rows.length > PAGE_SIZE };
  });
}

function numericRating(record: WithAvatarPath<SocialRecord>): SocialRecord {
  return { ...withAvatar(record), rating: record.rating === null ? null : Number(record.rating) };
}

export function listSocial(actor: SocialActor, tab: SocialTab, query: string, page: number): Promise<SocialList> {
  const uid = actorId(actor);
  return withSocial(actor, async client => {
    if (tab === "feed") {
      const { rows } = await client.query<WithAvatarPath<SocialRecord>>(`SELECT ${RECORD}
        FROM scenelog.viewing_logs l JOIN scenelog.profiles p ON p.user_id = l.user_id
        JOIN scenelog.friendships f ON f.status = 'accepted' AND
          ((f.requester_id = $1 AND f.recipient_id = l.user_id) OR (f.recipient_id = $1 AND f.requester_id = l.user_id))
        JOIN scenelog.archive_movies m ON m.user_id = l.user_id AND m.movie_id = l.movie_id
        WHERE ${CAN_VIEW} ORDER BY l.created_at DESC, l.user_id, l.id DESC LIMIT $2 OFFSET $3`,
      [uid, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE]);
      return { users: [], records: rows.slice(0, PAGE_SIZE).map(numericRating), page, hasNext: rows.length > PAGE_SIZE };
    }
    const condition = tab === "friends" ? `EXISTS (SELECT 1 FROM scenelog.friendships WHERE status = 'accepted' AND
      ((requester_id = $1 AND recipient_id = p.user_id) OR (recipient_id = $1 AND requester_id = p.user_id)))`
      : tab === "incoming" ? "EXISTS (SELECT 1 FROM scenelog.friendships WHERE recipient_id = $1 AND requester_id = p.user_id AND status = 'pending')"
      : tab === "outgoing" ? "EXISTS (SELECT 1 FROM scenelog.friendships WHERE requester_id = $1 AND recipient_id = p.user_id AND status = 'pending')" : "TRUE";
    if (tab === "discover" && !query.trim()) return { users: [], records: [], page, hasNext: false };
    const { rows } = await client.query<WithAvatarPath<SocialProfile>>(`SELECT ${PROFILE} FROM scenelog.profiles p
      WHERE p.user_id <> $1 AND ${condition} AND strpos(lower(p.display_name), lower($2)) > 0
      ORDER BY p.display_name, p.user_id LIMIT $3 OFFSET $4`, [uid, query, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE]);
    return { users: rows.slice(0, PAGE_SIZE).map(withAvatar), records: [], page, hasNext: rows.length > PAGE_SIZE };
  });
}

export function saveSocialProfile(actor: SocialActor, displayName: string, visibility: CollectionVisibility) {
  const uid = actorId(actor);
  return withSocial(actor, async client => {
    const { rows: [profile] } = await client.query<WithAvatarPath<OwnProfile>>(`UPDATE scenelog.profiles SET display_name = $2, collection_visibility = $3, collection_public = ($3 = 'public'), updated_at = now() WHERE user_id = $1
      RETURNING user_id AS id, display_name AS "displayName", collection_visibility AS "collectionVisibility", avatar_path AS "avatarPath", equipped_title AS "equippedTitle"`, [uid, displayName, visibility]);
    return withAvatar(profile);
  });
}

export function readOwnProfile(actor: SocialActor): Promise<OwnProfile> {
  const uid = actorId(actor);
  return withSocial(actor, async client => {
    const { rows: [profile] } = await client.query<WithAvatarPath<OwnProfile>>(`SELECT user_id AS id, display_name AS "displayName", collection_visibility AS "collectionVisibility", avatar_path AS "avatarPath", equipped_title AS "equippedTitle" FROM scenelog.profiles WHERE user_id = $1`, [uid]);
    return withAvatar(profile);
  });
}

export async function replaceAvatar(actor: SocialActor, path: string | null): Promise<{ previousPath: string | null; profile: OwnProfile }> {
  const uid = actorId(actor);
  try {
    return await inTransaction(getDatabasePool(), async client => {
      await client.query(`INSERT INTO scenelog.profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [uid, actorName(actor)]);
      const { rows: [previous] } = await client.query<{ avatar_path: string | null }>("SELECT avatar_path FROM scenelog.profiles WHERE user_id = $1 FOR UPDATE", [uid]);
      const { rows: [profile] } = await client.query<WithAvatarPath<OwnProfile>>(`UPDATE scenelog.profiles SET avatar_path = $2, updated_at = now() WHERE user_id = $1
        RETURNING user_id AS id, display_name AS "displayName", collection_visibility AS "collectionVisibility", avatar_path AS "avatarPath", equipped_title AS "equippedTitle"`, [uid, path]);
      return { previousPath: previous.avatar_path, profile: withAvatar(profile) };
    });
  } catch { throw new ApiError(503, "PROFILE_SAVE_FAILED", "프로필 사진을 저장하지 못했습니다. 다시 시도해 주세요."); }
}

export async function saveFriendship(actor: SocialActor, target: string, action: FriendshipAction): Promise<{ userId: string; friendship: FriendshipState }> {
  const uid = actorId(actor);
  if (uid === target) throw new ApiError(400, "SELF_FRIEND_REQUEST", "자신에게 친구 요청을 보낼 수 없습니다.");
  try {
    return await inTransaction(getDatabasePool(), async client => {
      await client.query(`INSERT INTO scenelog.profiles (user_id, display_name) VALUES ($1, $2)
        ON CONFLICT DO NOTHING`, [uid, actorName(actor)]);
      // Lock both profiles in a consistent order, including when no relationship exists yet.
      const { rows: people } = await client.query("SELECT user_id FROM scenelog.profiles WHERE user_id IN ($1, $2) ORDER BY user_id FOR UPDATE", [uid, target]);
      if (people.length !== 2) throw new ApiError(404, "PROFILE_NOT_FOUND", "사용자를 찾을 수 없습니다.");
      const pair = "(requester_id = $1 AND recipient_id = $2) OR (requester_id = $2 AND recipient_id = $1)";
      const { rows: [existing] } = await client.query<{ requester_id: string; recipient_id: string; status: "pending" | "accepted" }>(
        `SELECT requester_id, recipient_id, status FROM scenelog.friendships WHERE ${pair} FOR UPDATE`, [uid, target],
      );
      const conflict = () => new ApiError(409, "FRIENDSHIP_CHANGED", "친구 요청 상태가 바뀌었어요. 다시 확인해 주세요.");
      let friendship: FriendshipState = "none";
      if (action === "request") {
        if (existing?.status === "accepted") friendship = "friends";
        else if (existing && existing.requester_id !== uid) throw conflict();
        else {
          if (!existing) await client.query("INSERT INTO scenelog.friendships (requester_id, recipient_id) VALUES ($1, $2)", [uid, target]);
          friendship = "outgoing";
        }
      } else if (action === "accept") {
        if (!existing || existing.recipient_id !== uid) throw conflict();
        if (existing.status === "pending") await client.query(`UPDATE scenelog.friendships SET status = 'accepted', updated_at = now() WHERE ${pair}`, [uid, target]);
        friendship = "friends";
      } else if (existing) {
        const allowed = action === "remove" ? existing.status === "accepted"
          : existing.status === "pending" && (action === "cancel" ? existing.requester_id === uid : existing.recipient_id === uid);
        if (!allowed) throw conflict();
        await client.query(`DELETE FROM scenelog.friendships WHERE ${pair}`, [uid, target]);
      }
      return { userId: target, friendship };
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "FRIENDSHIP_UNAVAILABLE", "친구 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export function readSocialSummary(actor: SocialActor): Promise<SocialSummary> {
  return withSocial(actor, async client => {
    const { rows: [summary] } = await client.query<SocialSummary>(`SELECT count(*)::int AS "incomingRequests"
      FROM scenelog.friendships WHERE recipient_id = $1 AND status = 'pending'`, [actorId(actor)]);
    return summary;
  });
}
