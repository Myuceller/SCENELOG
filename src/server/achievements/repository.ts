import "server-only";
import { getDatabasePool, type DatabasePool } from "@/server/db/pool";
import { inTransaction } from "@/server/db/transaction";
import { initialProfileName } from "@/lib/profile-name";
import { today } from "@/lib/scene-model";
import { achievementCatalogVersion, evaluateAchievements, findAchievement, type AchievementCollection, type AchievementFact, type AchievementId } from "@/lib/achievements";
import type { SocialActor } from "@/server/social/repository";
import { ApiError } from "@/server/http/errors";

type Unlock = { title_id: string; unlocked_at: string };
export function createAchievementRepository(getDb: () => DatabasePool = getDatabasePool) {
  async function resolve(actor: SocialActor, equipped?: AchievementId): Promise<AchievementCollection> {
    const uid = typeof actor === "string" ? actor : actor.id;
    try {
      return await inTransaction(getDb(), async client => {
        // Create/lock this member's profile and fetch only their minimal facts in one round trip.
        // The no-op conflict update keeps other profile fields intact and serializes grants/equips.
        const { rows: [profile] } = await client.query<{ equipped_title: string; facts: AchievementFact[] }>(`
          WITH profile AS (
            INSERT INTO scenelog.profiles (user_id, display_name) VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING equipped_title
          )
          SELECT profile.equipped_title, COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'movieId', l.movie_id, 'watchedOn', COALESCE(to_char(l.watched_on, 'YYYY-MM-DD'), ''),
            'reviewed', btrim(l.review, E' \\t\\n\\r') <> '',
            'detailed', l.themes ? 'ost' AND l.themes ? 'visual' AND l.themes ? 'story',
            'genres', COALESCE(m.metadata->'genres', '[]'::jsonb)))
            FROM scenelog.viewing_logs l JOIN scenelog.archive_movies m ON m.user_id = l.user_id AND m.movie_id = l.movie_id
            WHERE l.user_id = $1), '[]'::jsonb) AS facts FROM profile`,
          [uid, initialProfileName(uid, typeof actor === "string" ? undefined : actor.user_metadata?.display_name)]);
        const progress = evaluateAchievements(profile.facts, today());
        const earned = progress.filter(item => item.current >= item.target).map(item => item.id);
        // Data-modifying CTEs share one snapshot: UNION the RETURNING rows explicitly so newly
        // granted titles participate in both equip validation and ownership counts immediately.
        const { rows: [result] } = await client.query<{
          unlocked: Unlock[]; equipped: boolean; total_members: number; calculated_at: string;
          holders: { title_id: string; holder_count: number }[];
        }>(`
          WITH granted AS (
            INSERT INTO scenelog.user_achievements (user_id, title_id)
            SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING RETURNING user_id, title_id, unlocked_at
          ), owned AS (
            SELECT title_id, unlocked_at FROM scenelog.user_achievements WHERE user_id = $1
            UNION ALL SELECT title_id, unlocked_at FROM granted
          ), equipped AS (
            UPDATE scenelog.profiles SET equipped_title = $3, updated_at = now()
            WHERE user_id = $1 AND $3::text IS NOT NULL AND EXISTS (SELECT 1 FROM owned WHERE title_id = $3)
            RETURNING user_id
          ), holdings AS (
            SELECT title_id, count(*)::float8 AS holder_count FROM (
              SELECT title_id FROM scenelog.user_achievements UNION ALL SELECT title_id FROM granted
            ) titles GROUP BY title_id
          )
          SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('title_id', title_id, 'unlocked_at',
            to_char(unlocked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) FROM owned), '[]'::jsonb) AS unlocked,
            EXISTS (SELECT 1 FROM equipped) AS equipped,
            (SELECT count(*)::float8 FROM scenelog.profiles) AS total_members,
            to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS calculated_at,
            COALESCE((SELECT jsonb_agg(to_jsonb(holdings)) FROM holdings), '[]'::jsonb) AS holders`, [uid, earned, equipped ?? null]);
        if (equipped && !result.equipped) throw new ApiError(403, "ACHIEVEMENT_LOCKED", "아직 달성하지 않은 도전과제예요.");
        const unlocked = new Map(result.unlocked.map(row => [row.title_id, row.unlocked_at]));
        const holderCounts = new Map(result.holders.map(row => [row.title_id, row.holder_count]));
        return { catalogVersion: achievementCatalogVersion,
          population: { totalMembers: result.total_members, calculatedAt: result.calculated_at },
          equippedTitle: findAchievement(equipped ?? profile.equipped_title).id,
          achievements: progress.map(item => ({ ...item, unlockedAt: unlocked.get(item.id) ?? null, holderCount: holderCounts.get(item.id) ?? 0 })) };
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "ACHIEVEMENTS_UNAVAILABLE", "도전과제를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }
  return { read: (actor: SocialActor) => resolve(actor), equip: (actor: SocialActor, title: AchievementId) => resolve(actor, title) };
}
export const achievementRepository = createAchievementRepository();
