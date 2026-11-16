import "server-only";
import { Pool, type QueryResultRow } from "pg";
import { ApiError } from "@/server/http/errors";
import { databaseConnectionOptions } from "./connection-options";

export interface DatabaseClient {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
  release(destroy?: boolean): void;
}
export interface DatabasePool { connect(): Promise<DatabaseClient> }

const globalDb = globalThis as typeof globalThis & { scenelogPool?: Pool };

/** Lazy initialization keeps builds independent of database availability. */
export function getDatabasePool(): Pool {
  if (globalDb.scenelogPool) return globalDb.scenelogPool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new ApiError(503, "DATABASE_NOT_CONFIGURED", "기록 저장소 설정이 필요합니다.");
  const pool = new Pool({
    ...databaseConnectionOptions(connectionString),
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 15_000,
    application_name: "scenelog",
  });
  // Never log connection URLs or raw credential errors.
  pool.on("error", () => console.error("PostgreSQL idle connection failed."));
  globalDb.scenelogPool = pool;
  return pool;
}
