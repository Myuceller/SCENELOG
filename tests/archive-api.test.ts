import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { resolve } from "node:path";
import { applyMigrations, loadMigrations } from "../src/server/db/migrate";
import type { DatabasePool } from "../src/server/db/pool";
import { AuthApiError, type User } from "@supabase/supabase-js";
import { createAuthenticator } from "../src/server/auth/authenticate";
import { createArchiveHandlers } from "../src/server/archive/handlers";
import { createArchiveRepository } from "../src/server/archive/repository";
import { MAX_ARCHIVE_BYTES, writeSchema } from "../src/server/archive/schema";
import { ApiError } from "../src/server/http/errors";
import { emptyArchive, type ArchiveWrite } from "../src/types/archive";
import { fromPersonalArchive, toPersonalArchive } from "../src/lib/personal-archive";
import { normalizeMovie } from "../src/lib/archive-movies";
import { createSeedState } from "../src/lib/scene-model";
import { movies } from "../src/data/movies";

function body(): ArchiveWrite {
  return {
    revision: 0,
    archive: {
      catalog: [normalizeMovie(movies[0])], watchlist: [movies[0].id],
      logs: [{ id: "log-1", movieId: movies[0].id, rating: 0, watchedOn: "2026-11-07", review: "기록", themes: { ost: 4.1 }, spoiler: false, createdAt: "2026-11-07T00:00:00.000Z" }],
    },
  };
}
function request(data: unknown = body()) {
  return new Request("http://localhost/api/archive?userId=victim", { method: "PUT", headers: { "content-type": "application/json", authorization: "Bearer valid-test-token" }, body: JSON.stringify(data) });
}
// PGlite executes real PostgreSQL SQL in memory. It is single-connection;
// the adapter serializes clients and does not simulate multi-connection row locking.
async function memoryDb(t: TestContext) {
  const engine = new PGlite();
  t.after(() => engine.close());
  let queue = Promise.resolve();
  const db: DatabasePool = {
    async connect() {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      return {
        async query<T>(sql: string, values?: unknown[]) {
          if (values) return engine.query<T>(sql, values);
          const results = await engine.exec(sql);
          return { rows: (results.at(-1)?.rows ?? []) as T[] };
        },
        release,
      };
    },
  };
  const migrations = await loadMigrations(resolve("db/migrations"));
  await applyMigrations(db, migrations);
  return { db, engine, migrations };
}

for (const header of [null, "", "Basic test", "Bearer", "Bearer token extra"]) {
  test(`인증 헤더 ${JSON.stringify(header)}는 SDK 호출 전에 차단`, async () => {
    let called = false;
    const authenticate = createAuthenticator(() => { called = true; throw new Error(); });
    const req = new Request("http://localhost/api/archive", { headers: header ? { authorization: header } : {} });
    await assert.rejects(authenticate(req), (error: unknown) => error instanceof ApiError && error.status === 401);
    assert.equal(called, false);
  });
}

test("서버가 Supabase Auth에 전달한 토큰으로 검증된 사용자만 반환", async () => {
  let captured: unknown[] = [];
  const getUser = async (...args: unknown[]) => {
    captured = args;
    return { data: { user: { id: "verified-user" } as User }, error: null };
  };
  const authenticate = createAuthenticator(() => ({ getUser }));
  assert.equal((await authenticate(request())).id, "verified-user");
  assert.deepEqual(captured, ["valid-test-token"]);
});

for (const code of ["bad_jwt", "session_not_found", "user_not_found", "user_banned"]) {
  test(`${code}는 401로 변환하고 원본 오류를 노출하지 않음`, async () => {
    const authenticate = createAuthenticator(() => ({ getUser: async () => ({ data: { user: null }, error: new AuthApiError("private-token", 403, code) }) }));
    const handlers = createArchiveHandlers({ authenticate, repository: { read: async () => { throw new Error("must not read"); }, write: async () => { throw new Error("must not write"); } } });
    const response = await handlers.GET(request());
    assert.equal(response.status, 401);
    assert.ok(!(await response.text()).includes("private-token"));
  });
}

test("인증 서버 장애는 로그인 실패로 오인하지 않고 503 반환", async () => {
  const authenticate = createAuthenticator(() => ({ getUser: async () => { throw new Error("network failure"); } }));
  await assert.rejects(authenticate(request()), (error: unknown) => error instanceof ApiError && error.status === 503);
});

test("Auth가 사용자 없이 응답하면 접근 거부", async () => {
  const authenticate = createAuthenticator(() => ({ getUser: async () => ({ data: { user: null }, error: new AuthApiError("invalid", 401, "bad_jwt") }) }));
  await assert.rejects(authenticate(request()), (error: unknown) => error instanceof ApiError && error.status === 401);
});

test("기록의 사용자 ID는 토큰에서만 가져오며 다른 사용자의 기록과 분리", async (t) => {
  const { db, engine } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  const handlers = createArchiveHandlers({ authenticate: async () => ({ id: "actual-user" }), repository });
  const saved = await handlers.PUT(request());
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);
  assert.deepEqual((await engine.query("SELECT user_id FROM scenelog.archive_owners")).rows, [{ user_id: "actual-user" }]);
  assert.equal((await repository.read("victim")).archive.logs.length, 0);
  const response = await handlers.GET(new Request("http://localhost/api/archive"));
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual((await response.json()).archive, body().archive);
});

test("새 계정은 예시 기록 없이 빈 아카이브로 시작", async (t) => {
  const { db } = await memoryDb(t);
  assert.deepEqual(await createArchiveRepository(() => db).read("new-user"), { archive: emptyArchive(), revision: 0 });
});

test("같은 버전의 두 저장은 한 요청만 성공하고 나머지는 409", async (t) => {
  const { db } = await memoryDb(t);
  const handlers = createArchiveHandlers({ authenticate: async () => ({ id: "same-user" }), repository: createArchiveRepository(() => db) });
  const results = await Promise.all([handlers.PUT(request()), handlers.PUT(request())]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
});

test("손상된 기존 기록은 덮어쓰지 않음", async (t) => {
  const { db, engine } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  await repository.write("user", body());
  await engine.query("UPDATE scenelog.archive_movies SET metadata = metadata - 'title' WHERE user_id = $1", ["user"]);
  await assert.rejects(repository.write("user", { ...body(), revision: 1 }), (error: unknown) => error instanceof ApiError && error.code === "ARCHIVE_INVALID");
  assert.deepEqual((await engine.query("SELECT revision::float8 AS revision FROM scenelog.archive_owners WHERE user_id = $1", ["user"])).rows, [{ revision: 1 }]);
});

test("0점, 미평가, 0.1점, 빈 관람일을 허용", () => {
  const data = body();
  assert.equal(writeSchema.safeParse(data).success, true);
  data.archive.logs[0].rating = null;
  data.archive.logs[0].watchedOn = "";
  assert.equal(writeSchema.safeParse(data).success, true);
});

test("범위를 벗어난 점수, 잘못된 날짜, 중복 ID, 누락 영화 정보 거부", () => {
  for (const change of [
    (data: ArchiveWrite) => { data.archive.logs[0].rating = 5.1; },
    (data: ArchiveWrite) => { data.archive.logs[0].rating = 4.21; },
    (data: ArchiveWrite) => { data.archive.logs[0].themes.ost = -1; },
    (data: ArchiveWrite) => { data.archive.logs[0].watchedOn = "2026-02-30"; },
    (data: ArchiveWrite) => { data.archive.logs.push(data.archive.logs[0]); },
    (data: ArchiveWrite) => { data.archive.catalog = []; },
    (data: ArchiveWrite) => { data.archive.catalog[0].poster = "https://attacker.example/track"; },
  ]) {
    const data = body(); change(data);
    assert.equal(writeSchema.safeParse(data).success, false);
  }
});

test("요청 본문의 userId 및 친구 데이터 주입 차단", async () => {
  let writes = 0;
  const handlers = createArchiveHandlers({ authenticate: async () => ({ id: "user" }), repository: { read: async () => body(), write: async () => { writes++; return body(); } } });
  const data = body();
  for (const invalid of [
    { ...data, userId: "victim" },
    { ...data, archive: { ...data.archive, friends: [] } },
    { ...data, archive: { ...data.archive, logs: [{ ...data.archive.logs[0], userId: "victim" }] } },
  ]) assert.equal((await handlers.PUT(request(invalid))).status, 400);
  assert.equal(writes, 0);
});

test("잘못된 JSON 및 초과 요청은 쓰기 전에 차단", async () => {
  let writes = 0;
  const handlers = createArchiveHandlers({ authenticate: async () => ({ id: "user" }), repository: { read: async () => body(), write: async () => { writes++; return body(); } } });
  const req = (text: string, type: string) => new Request("http://localhost/api/archive", { method: "PUT", headers: { "content-type": type }, body: text });
  assert.equal((await handlers.PUT(req("{", "application/json"))).status, 400);
  assert.equal((await handlers.PUT(req("{}", "text/plain"))).status, 415);
  assert.equal((await handlers.PUT(req("x".repeat(MAX_ARCHIVE_BYTES + 1), "application/json"))).status, 413);
  assert.equal(writes, 0);
});

test("DB 연결 오류의 자격 증명·원본 메시지를 노출하지 않음", async () => {
  const repository = createArchiveRepository(() => { throw new Error("secret/path/private-key.json"); });
  const handlers = createArchiveHandlers({ authenticate: async () => ({ id: "user" }), repository });
  const response = await handlers.GET(request());
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("private-key"));
});

test("개인 아카이브 변환은 본인의 기록만 포함하고 실제 UID로 복원", () => {
  const seed = createSeedState();
  seed.catalog = movies.map(normalizeMovie);
  const personal = toPersonalArchive(seed);
  assert.equal(personal.logs.length, seed.logs.filter((log) => log.userId === seed.userId).length);
  assert.ok(personal.logs.every((log) => !("userId" in log)));
  assert.equal("friends" in personal, false);
  const restored = fromPersonalArchive("supabase-user-id", personal);
  assert.ok(restored.logs.every((log) => log.userId === "supabase-user-id"));
  assert.deepEqual(restored.friends, []);
});

test("PostgreSQL에서 재관람·미평가·순서 보존 후 전체 삭제, 다른 사용자 기록은 유지", async (t) => {
  const { db } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  const data = body();
  data.archive.logs.push({ ...data.archive.logs[0], id: "rewatch", rating: null, watchedOn: "", tier: "S", themes: {} });
  const uid = "owner' OR '1'='1";
  await repository.write("other", body());
  const saved = await repository.write(uid, data);
  assert.deepEqual(saved.archive, data.archive);
  assert.deepEqual((await repository.read(uid)).archive, data.archive);
  const cleared = await repository.write(uid, { archive: emptyArchive(), revision: 1 });
  assert.deepEqual(cleared, { archive: emptyArchive(), revision: 2 });
  assert.deepEqual((await repository.read("other")).archive, body().archive);
});

test("DB 제약조건 오류로 저장 중 실패하면 기존 기록과 revision을 롤백", async (t) => {
  const { db } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  await repository.write("user", body());
  const invalid = body();
  invalid.revision = 1;
  invalid.archive.logs[0].rating = 6; // Bypass HTTP validation to exercise the DB constraint.
  await assert.rejects(repository.write("user", invalid), (error: unknown) => error instanceof ApiError && error.status === 503);
  assert.deepEqual(await repository.read("user"), { ...body(), revision: 1 });
});

test("외래 키는 다른 사용자의 영화 스냅샷을 참조하는 찜을 거부", async (t) => {
  const { db, engine } = await memoryDb(t);
  await createArchiveRepository(() => db).write("owner", body());
  await engine.query("INSERT INTO scenelog.archive_owners (user_id) VALUES ($1)", ["other"]);
  await assert.rejects(engine.query("INSERT INTO scenelog.watchlist (user_id, movie_id, position) VALUES ($1, $2, 0)", ["other", movies[0].id]));
});

test("마이그레이션 재실행은 안전하고 적용 파일 변경·실패한 SQL은 DB를 변경하지 않음", async (t) => {
  const { db, engine, migrations } = await memoryDb(t);
  assert.deepEqual(await applyMigrations(db, migrations), []);
  await assert.rejects(applyMigrations(db, [{ ...migrations[0], sql: migrations[0].sql + "\n-- changed" }, ...migrations.slice(1)]), /modified/);
  await assert.rejects(applyMigrations(db, [...migrations, { name: "9999_failure.sql", sql: "CREATE TABLE scenelog.rollback_probe (id int); SELECT * FROM scenelog.missing_table;" }]));
  const probe = await engine.query("SELECT to_regclass('scenelog.rollback_probe') AS name");
  assert.deepEqual(probe.rows, [{ name: null }]);
  assert.equal((await engine.query("SELECT * FROM scenelog.schema_migrations")).rows.length, migrations.length);
});
