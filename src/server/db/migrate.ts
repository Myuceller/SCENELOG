import "server-only";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabasePool } from "./pool";
import { inTransaction } from "./transaction";

export interface Migration { name: string; sql: string }

export async function loadMigrations(directory: string): Promise<Migration[]> {
  const names = (await readdir(directory)).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
  return Promise.all(names.map(async (name) => ({ name, sql: await readFile(join(directory, name), "utf8") })));
}

/** A transaction lock allows two developers to run migrations safely at once. */
export async function applyMigrations(pool: DatabasePool, migrations: Migration[]): Promise<string[]> {
  return inTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(1935893870)");
    await client.query("CREATE SCHEMA IF NOT EXISTS scenelog");
    await client.query(`CREATE TABLE IF NOT EXISTS scenelog.schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ name: string; checksum: string }>("SELECT name, checksum FROM scenelog.schema_migrations ORDER BY name");
    const known = new Map(applied.rows.map((row) => [row.name, row.checksum]));
    const available = new Set(migrations.map((migration) => migration.name));
    if (applied.rows.some((row) => !available.has(row.name))) throw new Error("Migration history is ahead of this checkout. Pull the latest code first.");
    const completed: string[] = [];
    for (const { name, sql } of migrations) {
      const checksum = createHash("sha256").update(sql).digest("hex");
      if (known.has(name)) {
        if (known.get(name) !== checksum) throw new Error("An applied migration was modified. Restore it and add a new migration instead.");
        continue;
      }
      if (applied.rows.some((row) => row.name > name)) throw new Error("A migration was added out of order. Add it after the latest applied migration.");
      await client.query(sql);
      await client.query("INSERT INTO scenelog.schema_migrations (name, checksum) VALUES ($1, $2)", [name, checksum]);
      completed.push(name);
    }
    return completed;
  });
}
