import assert from "node:assert/strict";
import { test } from "node:test";
import { ServerTiming } from "../src/server/http/server-timing";
import { createArchiveHandlers } from "../src/server/archive/handlers";
import { ApiError } from "../src/server/http/errors";
import { emptyArchive } from "../src/types/archive";

test("request timing records successful and failed stages without recording payloads", async () => {
  let now = 0;
  const timing = new ServerTiming(() => now);
  assert.equal(await timing.measure("auth", async () => { now = 12; return "private-token"; }), "private-token");
  await assert.rejects(timing.measure("db_query", async () => { now = 32; throw new Error("private-query"); }));
  timing.measureSync("serialize", () => { now = 35; });
  const response = timing.finish(new Response("ok", { headers: { "Cache-Control": "private, no-store" } }));
  assert.equal(response.headers.get("Server-Timing"), "auth;dur=12.0, db_query;dur=20.0, serialize;dur=3.0, total;dur=35.0");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("archive measurements preserve auth gating, response body and private cache policy", async () => {
  const data = { archive: emptyArchive(), revision: 0 };
  let reads = 0;
  const repository = {
    async read(id: string, timing?: ServerTiming) {
      reads++;
      assert.equal(id, "verified-user");
      assert.ok(timing);
      return timing.measure("db_query", async () => data);
    },
    async write() { return data; },
  };
  const request = new Request("https://example.test/api/archive");
  const success = await createArchiveHandlers({ authenticate: async () => ({ id: "verified-user" }), repository }).GET(request);
  assert.deepEqual(await success.json(), data);
  assert.equal(success.headers.get("Cache-Control"), "private, no-store");
  assert.equal(success.headers.get("Vary"), "Authorization");
  for (const stage of ["auth", "archive", "db_query", "serialize", "total"]) assert.match(success.headers.get("Server-Timing")!, new RegExp(`${stage};dur=\\d+\\.\\d`));
  const denied = await createArchiveHandlers({ authenticate: async () => { throw new ApiError(401, "AUTH_REQUIRED", "로그인 필요"); }, repository }).GET(request);
  assert.equal(denied.status, 401);
  assert.equal(reads, 1);
  assert.match(denied.headers.get("Server-Timing")!, /auth;dur=/);
  assert.doesNotMatch(denied.headers.get("Server-Timing")!, /db_query|verified-user/);
});
