import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const required = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DATABASE_URL: "postgresql://example:never-print-this-password@db.example.com/app",
  TMDB_READ_ACCESS_TOKEN: "never-print-this-token",
};

function check(env: Record<string, string>) {
  return spawnSync(process.execPath, ["scripts/check-deployment-env.mjs"], { env: { ...env, NODE_ENV: "production" }, encoding: "utf8" });
}

test("deployment stops when DB configuration is missing or blank, without printing credentials", () => {
  for (const value of [undefined, "   "]) {
    const env: Record<string, string> = { ...required };
    if (value === undefined) delete env.DATABASE_URL;
    else env.DATABASE_URL = value;
    const result = check(env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DATABASE_URL/);
    assert.doesNotMatch(result.stdout + result.stderr, /never-print-this/);
  }
});

test("deployment accepts configured production variables without printing their values", () => {
  const result = check(required);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /never-print-this|sb_publishable_test/);
});
