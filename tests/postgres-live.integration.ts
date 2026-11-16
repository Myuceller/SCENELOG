import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { loadEnvConfig } from "@next/env";
import { getDatabasePool } from "../src/server/db/pool";
import { createArchiveRepository } from "../src/server/archive/repository";
import { ApiError } from "../src/server/http/errors";
import { normalizeMovie } from "../src/lib/archive-movies";
import { movies } from "../src/data/movies";
import { emptyArchive, type ArchiveWrite } from "../src/types/archive";

test("로컬 PostgreSQL 다중 연결 저장·충돌·롤백", async (t) => {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const url = new URL(process.env.DATABASE_URL || "postgresql://unconfigured");
  assert.ok(url.hostname === "127.0.0.1" && url.port === "55432" && url.pathname === "/scenelog", "프로젝트 로컬 DB에서만 실행할 수 있습니다. 먼저 npm run db:setup을 실행하세요.");
  const pool = getDatabasePool();
  const repository = createArchiveRepository(() => pool);
  const uid = `integration-${randomUUID()}`;
  const other = `integration-${randomUUID()}`;
  const data: ArchiveWrite = {
    revision: 0,
    archive: {
      catalog: [normalizeMovie(movies[0])], watchlist: [movies[0].id],
      logs: [{ id: "local-test", movieId: movies[0].id, rating: 4.1, watchedOn: "2026-11-16", review: "local integration test", themes: {}, spoiler: false, createdAt: "2026-11-16T00:00:00.000Z" }],
    },
  };
  try {
    await t.test("서로 다른 연결의 최초 동시 저장은 하나만 성공", async () => {
      const results = await Promise.allSettled([repository.write(uid, data), repository.write(uid, data)]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const rejected = results.find((result) => result.status === "rejected");
      assert.ok(rejected?.status === "rejected" && rejected.reason instanceof ApiError && rejected.reason.status === 409);
      assert.deepEqual(await repository.read(uid), { ...data, revision: 1 });
    });
    await t.test("다른 사용자에게 기록이 노출되지 않음", async () => {
      assert.deepEqual(await repository.read(other), { archive: emptyArchive(), revision: 0 });
    });
    await t.test("DB 제약조건 실패 시 실제 트랜잭션 롤백", async () => {
      const invalid = structuredClone(data);
      invalid.revision = 1;
      invalid.archive.logs[0].rating = 6;
      await assert.rejects(repository.write(uid, invalid), (error: unknown) => error instanceof ApiError && error.status === 503);
      assert.deepEqual(await repository.read(uid), { ...data, revision: 1 });
    });
    await t.test("전체 기록 삭제 후 빈 데이터와 새 revision 반환", async () => {
      assert.deepEqual(await repository.write(uid, { archive: emptyArchive(), revision: 1 }), { archive: emptyArchive(), revision: 2 });
    });
  } finally {
    try {
      // Only remove the random identities created by this test, never application users.
      await pool.query("DELETE FROM scenelog.archive_owners WHERE user_id = ANY($1::text[])", [[uid, other]]);
    } finally { await pool.end(); }
  }
});
