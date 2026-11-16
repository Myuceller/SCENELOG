import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { getDatabasePool } from "../src/server/db/pool";
import { applyMigrations, loadMigrations } from "../src/server/db/migrate";

async function main() {
  // Use the same .env.local loading/expansion as Next.js. Never print the values.
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info() {}, error() {} });
  const command = process.argv[2];
  if (command !== "check" && command !== "migrate") throw new Error("Unknown database command.");
  if (command === "migrate" && process.env.DATABASE_MIGRATION_URL?.trim()) {
    process.env.DATABASE_URL = process.env.DATABASE_MIGRATION_URL;
  }
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(".env.local에 DATABASE_URL을 설정한 뒤 다시 실행하세요.");
    process.exitCode = 1;
    return;
  }
  const pool = getDatabasePool();
  try {
    if (command === "migrate") {
      const completed = await applyMigrations(pool, await loadMigrations(resolve("db/migrations")));
      console.log(completed.length ? `마이그레이션 완료: ${completed.join(", ")}` : "DB 스키마가 최신입니다.");
    } else {
      const result = await pool.query<{ ready: boolean }>(`SELECT
        to_regclass('scenelog.schema_migrations') IS NOT NULL AND
        to_regclass('scenelog.archive_owners') IS NOT NULL AND
        to_regclass('scenelog.archive_movies') IS NOT NULL AND
        to_regclass('scenelog.viewing_logs') IS NOT NULL AND
        to_regclass('scenelog.watchlist') IS NOT NULL AS ready`);
      if (!result.rows[0].ready) {
        console.error("PostgreSQL 연결 성공. 테이블 준비가 필요합니다: npm run db:migrate");
        process.exitCode = 1;
      } else {
        const expected = await loadMigrations(resolve("db/migrations"));
        const applied = await pool.query<{ name: string; checksum: string }>("SELECT name, checksum FROM scenelog.schema_migrations ORDER BY name");
        const history = new Map(applied.rows.map((row) => [row.name, row.checksum]));
        const current = history.size === expected.length && expected.every(({ name, sql }) => history.get(name) === createHash("sha256").update(sql).digest("hex"));
        if (!current) {
          console.error("PostgreSQL 연결 성공. 코드와 DB 이력이 다릅니다. 최신 코드 확인 후 npm run db:migrate를 실행하세요.");
          process.exitCode = 1;
        } else console.log("PostgreSQL 연결·기본 테이블·마이그레이션 이력 확인 완료.");
      }
    }
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  // PG errors may contain a hostname, username, connection string or SQL data.
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  const hints: Record<string, string> = {
    "28P01": "DB 비밀번호 인증 실패. DATABASE_URL의 비밀번호와 URL 인코딩을 확인하세요.",
    "28000": "DB 인증 실패. 연결 계정과 프로젝트 설정을 확인하세요.",
    "42501": "DB 권한 부족. 마이그레이션 연결 계정의 권한을 확인하세요.",
    "ENOTFOUND": "DB 호스트를 찾지 못했습니다. 연결 주소와 네트워크를 확인하세요.",
    "SELF_SIGNED_CERT_IN_CHAIN": "DB 인증서를 검증하지 못했습니다. 신뢰할 CA 인증서를 확인하세요.",
    "ERR_TLS_CERT_ALTNAME_INVALID": "DB 인증서와 연결 호스트가 일치하지 않습니다.",
    "ETIMEDOUT": "DB 연결 시간이 초과되었습니다. 프로젝트 상태와 네트워크를 확인하세요.",
  };
  if (hints[code]) console.error(hints[code]);
  else if (/SASL.*signature|password authentication failed/i.test(message)) console.error("DB 비밀번호 인증 실패. DATABASE_URL의 비밀번호와 URL 인코딩을 확인하세요.");
  else if (/tenant or user not found/i.test(message)) console.error("Pooler 계정을 찾지 못했습니다. Connect에서 복사한 주소와 사용자 이름을 확인하세요.");
  console.error("DB 작업 실패. 연결 URL·네트워크·권한과 마이그레이션 파일 변경 여부를 확인하세요. 상세 안내: docs/database.md");
  process.exitCode = 1;
});
