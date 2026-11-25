import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { resolve } from "node:path";
import { applyMigrations, loadMigrations } from "../src/server/db/migrate";
import type { DatabasePool } from "../src/server/db/pool";
import { AuthApiError, type User } from "@supabase/supabase-js";
import { createAuthenticator } from "../src/server/auth/authenticate";
import { createArchiveHandlers, createRecordHandler } from "../src/server/archive/handlers";
import { createArchiveRepository } from "../src/server/archive/repository";
import { MAX_ARCHIVE_BYTES, MAX_RECORD_BYTES, writeSchema } from "../src/server/archive/schema";
import { ApiError } from "../src/server/http/errors";
import { emptyArchive, type ArchiveWrite, type RecordWrite } from "../src/types/archive";
import { applyRecord, fromPersonalArchive, toPersonalArchive } from "../src/lib/personal-archive";
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
function recordBody(revision = 0): RecordWrite {
  const data = body();
  return { movie: data.archive.catalog[0], log: data.archive.logs[0], revision };
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

test("307편 중 한 건 수정은 해당 행만 갱신하고 나머지 기록·순서·타 계정을 보존", async (t) => {
  const { db, engine } = await memoryDb(t);
  let queries = 0;
  const counted: DatabasePool = { async connect() {
    const client = await db.connect();
    return { query: (sql, values) => { queries++; return client.query(sql, values); }, release: () => client.release() };
  } };
  const repository = createArchiveRepository(() => counted);
  const data = body();
  data.archive.logs = Array.from({ length: 307 }, (_, i) => ({ ...data.archive.logs[0], id: `log-${i}`, movieId: `movie-${i}` }));
  data.archive.catalog = data.archive.logs.map(log => ({ ...data.archive.catalog[0], id: log.movieId }));
  data.archive.watchlist = ["movie-0", "movie-1"];
  await repository.write("user", data);
  await repository.write("other", body());
  await engine.exec(`CREATE TABLE record_audit (operation text, id text);
    CREATE FUNCTION audit_record() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN INSERT INTO record_audit VALUES (TG_OP, COALESCE(NEW.id, OLD.id)); RETURN NULL; END $$;
    CREATE TRIGGER record_changes AFTER INSERT OR UPDATE OR DELETE ON scenelog.viewing_logs
    FOR EACH ROW EXECUTE FUNCTION audit_record();`);
  queries = 0;
  const payload: RecordWrite = { movie: data.archive.catalog[0], log: { ...data.archive.logs[0], rating: 4.5, review: "수정한 감상" }, revision: 1 };
  const saved = await repository.writeLog("user", payload);
  assert.equal(queries, 5); // BEGIN, owner insert, owner lock, mutation, COMMIT; no full archive SELECT.
  assert.deepEqual(saved, { ...payload, revision: 2 });
  assert.deepEqual((await engine.query("SELECT * FROM record_audit")).rows, [{ operation: "UPDATE", id: "log-0" }]);
  const expected = structuredClone(data.archive);
  expected.logs[0] = payload.log;
  expected.watchlist = ["movie-1"];
  assert.deepEqual(await repository.read("user"), { archive: expected, revision: 2 });
  assert.deepEqual((await repository.read("other")).archive, body().archive);
  assert.deepEqual(toPersonalArchive(applyRecord(fromPersonalArchive("user", data.archive), saved)), expected);
});

test("단건 API는 새 계정·새 영화·재관람을 추가하고 응답에는 해당 기록만 반환", async (t) => {
  const { db } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  const handler = createRecordHandler({ authenticate: async () => ({ id: "owner" }), repository });
  const first = await handler(request(recordBody()));
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await first.json(), { ...recordBody(), revision: 1 });
  const rewatch = { ...recordBody(1), log: { ...recordBody().log, id: "rewatch", rating: null, watchedOn: "", tier: "S" as const } };
  await repository.writeLog("owner", rewatch);
  const newMovie = normalizeMovie(movies[1]);
  const next = { movie: newMovie, log: { ...recordBody().log, id: "new-film", movieId: newMovie.id }, revision: 2 };
  await repository.writeLog("owner", next);
  const result = await repository.read("owner");
  assert.equal(result.revision, 3);
  assert.deepEqual(result.archive.logs, [recordBody().log, rewatch.log, next.log]);
  assert.deepEqual(result.archive.catalog, [recordBody().movie, newMovie]);
  assert.deepEqual(await repository.read("victim"), { archive: emptyArchive(), revision: 0 });
});

test("단건과 전체 저장은 같은 revision으로 충돌 검사하며 오래된 요청은 변경하지 않음", async (t) => {
  const { db } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  const record = createRecordHandler({ authenticate: async () => ({ id: "user" }), repository });
  const archive = createArchiveHandlers({ authenticate: async () => ({ id: "user" }), repository });
  const responses = await Promise.all([record(request(recordBody())), archive.PUT(request())]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const before = await repository.read("user");
  assert.equal((await record(request(recordBody()))).status, 409);
  assert.deepEqual(await repository.read("user"), before);
  const results = await Promise.all([record(request(recordBody(1))), record(request(recordBody(1)))]);
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
});

test("단건 저장 중 DB 오류는 영화 메타데이터·기록·찜·revision을 모두 롤백", async (t) => {
  const { db } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  await repository.write("user", body());
  const invalid = recordBody(1);
  invalid.movie.title = "실패 시 남으면 안 되는 제목";
  invalid.log.rating = 6;
  await assert.rejects(repository.writeLog("user", invalid), (error: unknown) => error instanceof ApiError && error.status === 503);
  assert.deepEqual(await repository.read("user"), { ...body(), revision: 1 });
});

test("단건 요청의 인증·소유자 주입·영화 불일치·크기·잘못된 JSON 검증", async () => {
  let writes = 0;
  const repository = { writeLog: async (_uid: string, value: RecordWrite) => { writes++; return value; } };
  const handler = createRecordHandler({ authenticate: async () => ({ id: "user" }), repository });
  for (const invalid of [
    { ...recordBody(), userId: "victim" },
    { ...recordBody(), log: { ...recordBody().log, userId: "victim" } },
    { ...recordBody(), log: { ...recordBody().log, movieId: "wrong-movie" } },
    { ...recordBody(), log: { ...recordBody().log, rating: 5.1 } },
    { ...recordBody(), revision: -1 },
  ]) assert.equal((await handler(request(invalid))).status, 400);
  const malformed = (text: string, type = "application/json") => new Request("http://localhost/api/archive/log", { method: "PUT", headers: { "Content-Type": type }, body: text });
  assert.equal((await handler(malformed("{"))).status, 400);
  assert.equal((await handler(malformed("{}", "text/plain"))).status, 415);
  assert.equal((await handler(malformed("x".repeat(MAX_RECORD_BYTES + 1)))).status, 413);
  const denied = createRecordHandler({ authenticate: async () => { throw new ApiError(401, "UNAUTHORIZED", "로그인 필요"); }, repository });
  assert.equal((await denied(request(recordBody()))).status, 401);
  assert.equal(writes, 0);
});

test("단건 API는 기존 기록의 영화 변경을 거부하며 예전 5,000건 상한을 넘어 저장·수정 가능", async (t) => {
  const { db } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  const data = body();
  data.archive.logs = Array.from({ length: 5001 }, (_, i) => ({ ...data.archive.logs[0], id: `log-${i}` }));
  await repository.write("user", data);
  const edit = { ...recordBody(1), log: { ...data.archive.logs[0], review: "수정" } };
  await repository.writeLog("user", edit);
  await repository.writeLog("user", { ...edit, revision: 2, log: { ...edit.log, id: "beyond-old-limit" } });
  const movie = normalizeMovie(movies[1]);
  await assert.rejects(repository.writeLog("user", { movie, revision: 3, log: { ...edit.log, movieId: movie.id } }), (error: unknown) => error instanceof ApiError && error.code === "INVALID_ARCHIVE");
  const stored = await repository.read("user");
  assert.equal(stored.revision, 3);
  assert.equal(stored.archive.logs.length, 5002);
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


test("large libraries beyond the old 3,000-movie cap can be saved, read and extended", async t => {
  const { db } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  const data = body();
  const movie = { ...data.archive.catalog[0], description: "" };
  const log = data.archive.logs[0];
  data.archive.catalog = Array.from({ length: 3001 }, (_, i) => ({ ...movie, id: `m-${i}` }));
  data.archive.logs = data.archive.catalog.map((item, i) => ({ ...log, id: `l-${i}`, movieId: item.id }));
  data.archive.logs.push({ ...log, id: "rewatch", movieId: "m-0" });
  data.archive.watchlist = [];
  const handlers = createArchiveHandlers({ authenticate: async () => ({ id: "collector" }), repository });
  assert.equal((await handlers.PUT(request(data))).status, 200);
  const next = { ...movie, id: "m-3001" };
  await repository.writeLog("collector", { movie: next, log: { ...log, id: "l-3001", movieId: next.id }, revision: 1 });
  const stored = await repository.read("collector");
  assert.equal(stored.archive.catalog.length, 3002);
  assert.equal(stored.archive.logs.length, 3003);
  assert.equal(stored.revision, 2);
  assert.equal(writeSchema.safeParse({ ...data, archive: { ...data.archive, catalog: Array.from({ length: 10001 }, (_, i) => ({ ...movie, id: `m-${i}` })) } }).success, true);
});


test("more than 1,000 watchlist entries and an archive over the request size limit still allow single-item add/remove", async t => {
  const { db } = await memoryDb(t);
  const repository = createArchiveRepository(() => db);
  const data = body();
  const movie = { ...data.archive.catalog[0], description: "x".repeat(5000) };
  data.archive.catalog = Array.from({ length: 1001 }, (_, i) => ({ ...movie, id: `saved-${i}` }));
  data.archive.watchlist = data.archive.catalog.map(item => item.id);
  data.archive.logs = [];
  assert.ok(Buffer.byteLength(JSON.stringify(data)) > MAX_ARCHIVE_BYTES);
  // Represents an existing library accumulated through many small saves, not one large upload.
  await repository.write("collector", data);
  const added = await repository.writeWatchlist("collector", { saved: true, movie: { ...movie, id: "saved-1001" }, revision: 1 });
  assert.equal(added.revision, 2);
  assert.equal((await repository.read("collector")).archive.watchlist.length, 1002);
  const removed = await repository.writeWatchlist("collector", { saved: false, movieId: "saved-1001", revision: 2 });
  assert.equal(removed.removedMovie, true);
  const handler = createRecordHandler({ authenticate: async () => ({ id: "collector" }), repository });
  const recording = { ...recordBody(3), movie: data.archive.catalog[0], log: { ...recordBody().log, movieId: "saved-0" } };
  assert.equal((await handler(request(recording))).status, 200);
  const stored = await repository.read("collector");
  assert.equal(stored.archive.watchlist.length, 1000);
  assert.equal(stored.archive.logs.length, 1);
  assert.equal(stored.archive.catalog.length, 1001);
  assert.equal(stored.revision, 4);
});
