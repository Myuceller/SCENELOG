import "server-only";
import { getDatabasePool, type DatabaseClient, type DatabasePool } from "@/server/db/pool";
import { inTransaction } from "@/server/db/transaction";
import { ApiError } from "@/server/http/errors";
import { emptyArchive, type ArchiveResponse, type ArchiveWrite } from "@/types/archive";
import { writeSchema } from "./schema";

// One statement gives GET a consistent snapshot during another device's save.
const READ_ARCHIVE = `
  SELECT o.revision::float8 AS revision, jsonb_build_object(
    'catalog', COALESCE((SELECT jsonb_agg(m.metadata ORDER BY m.position)
      FROM scenelog.archive_movies m WHERE m.user_id = o.user_id), '[]'::jsonb),
    'watchlist', COALESCE((SELECT jsonb_agg(w.movie_id ORDER BY w.position)
      FROM scenelog.watchlist w WHERE w.user_id = o.user_id), '[]'::jsonb),
    'logs', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', l.id, 'movieId', l.movie_id, 'rating', l.rating_tenths / 10.0,
      'watchedOn', COALESCE(to_char(l.watched_on, 'YYYY-MM-DD'), ''),
      'review', l.review, 'themes', l.themes, 'spoiler', l.spoiler,
      'createdAt', to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) || CASE WHEN l.tier IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('tier', l.tier) END
    ORDER BY l.position) FROM scenelog.viewing_logs l WHERE l.user_id = o.user_id), '[]'::jsonb)
  ) AS archive FROM scenelog.archive_owners o WHERE o.user_id = $1`;

async function readStored(client: DatabaseClient, uid: string): Promise<ArchiveResponse> {
  const { rows } = await client.query(READ_ARCHIVE, [uid]);
  if (!rows.length) return { archive: emptyArchive(), revision: 0 };
  const parsed = writeSchema.safeParse(rows[0]);
  if (!parsed.success) throw new ApiError(500, "ARCHIVE_INVALID", "저장된 기록을 읽지 못했습니다. 기록을 덮어쓰지 않고 중단했습니다.");
  return parsed.data;
}

function databaseError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  throw new ApiError(503, "DATABASE_UNAVAILABLE", "기록 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
}

export function createArchiveRepository(getDb: () => DatabasePool = getDatabasePool) {
  return {
    async read(uid: string): Promise<ArchiveResponse> {
      try {
        const client = await getDb().connect();
        try { return await readStored(client, uid); }
        finally { client.release(); }
      } catch (error) { return databaseError(error); }
    },
    async write(uid: string, body: ArchiveWrite): Promise<ArchiveResponse> {
      try {
        return await inTransaction(getDb(), async (client) => {
          await client.query("INSERT INTO scenelog.archive_owners (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [uid]);
          // Also serializes two simultaneous first saves of the same user.
          await client.query("SELECT revision FROM scenelog.archive_owners WHERE user_id = $1 FOR UPDATE", [uid]);
          const current = await readStored(client, uid);
          if (current.revision !== body.revision) {
            throw new ApiError(409, "ARCHIVE_CONFLICT", "다른 창이나 기기에서 기록이 변경되었습니다. 최신 기록을 불러온 후 다시 저장해 주세요.");
          }
          // The current API replaces a personal archive. FK cascades remove old logs/watchlist.
          await client.query("DELETE FROM scenelog.archive_movies WHERE user_id = $1", [uid]);
          await client.query(`INSERT INTO scenelog.archive_movies (user_id, movie_id, position, metadata)
            SELECT $1, item->>'id', ordinality - 1, item
            FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS entries(item, ordinality)`, [uid, JSON.stringify(body.archive.catalog)]);
          await client.query(`INSERT INTO scenelog.viewing_logs
            (user_id, id, movie_id, position, rating_tenths, watched_on, review, themes, tier, spoiler, created_at)
            SELECT $1, item->>'id', item->>'movieId', ordinality - 1,
              ((item->>'rating')::numeric * 10)::smallint, NULLIF(item->>'watchedOn', '')::date,
              item->>'review', item->'themes', item->>'tier', (item->>'spoiler')::boolean, (item->>'createdAt')::timestamptz
            FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS entries(item, ordinality)`, [uid, JSON.stringify(body.archive.logs)]);
          await client.query(`INSERT INTO scenelog.watchlist (user_id, movie_id, position)
            SELECT $1, item, ordinality - 1
            FROM jsonb_array_elements_text($2::jsonb) WITH ORDINALITY AS entries(item, ordinality)`, [uid, JSON.stringify(body.archive.watchlist)]);
          await client.query("UPDATE scenelog.archive_owners SET revision = revision + 1, updated_at = now() WHERE user_id = $1", [uid]);
          return await readStored(client, uid);
        });
      } catch (error) { return databaseError(error); }
    },
  };
}
