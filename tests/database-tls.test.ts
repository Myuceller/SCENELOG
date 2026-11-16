import assert from "node:assert/strict";
import { test } from "node:test";
import { X509Certificate } from "node:crypto";
import type { ConnectionOptions } from "node:tls";
import { Client } from "pg";
import { databaseConnectionOptions } from "../src/server/db/connection-options";

for (const parameters of ["", "?sslmode=verify-full", "?sslmode=disable", "?sslmode=require&uselibpqcompat=true", "?ssl=no-verify"]) {
  test(`Supabase pg 클라이언트에서 CA와 인증서 검증 유지: ${parameters || "기본"}`, () => {
    const client = new Client(databaseConnectionOptions(`postgresql://user:pass@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres${parameters}`));
    // @types/pg declares this runtime property as boolean although pg stores TLS options.
    const ssl = client.ssl as unknown as ConnectionOptions | boolean;
    assert.ok(ssl && typeof ssl === "object");
    assert.equal(ssl.rejectUnauthorized, true);
    assert.equal(ssl.checkServerIdentity, undefined); // Keep Node's standard hostname check.
    assert.equal(typeof ssl.ca, "string");
    const ca = new X509Certificate(ssl.ca as string);
    assert.equal(ca.ca, true);
    assert.ok(Date.parse(ca.validTo) > Date.now());
  });
}

test("공개 Supabase CA는 로컬 및 다른 제공자 연결에는 적용하지 않음", () => {
  for (const url of ["postgresql://user:pass@127.0.0.1:55432/scenelog", "postgresql://user:pass@db.example.com/postgres?sslmode=verify-full", "postgresql://user:pass@pooler.supabase.com.attacker.example/postgres"]) {
    assert.deepEqual(databaseConnectionOptions(url), { connectionString: url });
  }
});
