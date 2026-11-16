import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "pg";

// Project-owned cluster: never starts/stops Homebrew's shared database service.
const local = resolve(".local");
const data = join(local, "postgres");
const passwordFile = join(local, "postgres-admin-password");
const envFile = resolve(".env.local");
const port = 55432;

function binaries() {
  if (process.platform !== "darwin") throw new Error("이 명령은 macOS + Homebrew용입니다. docs/database.md를 확인하세요.");
  try {
    const prefix = execFileSync("brew", ["--prefix", "postgresql@18"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const bin = join(prefix, "bin");
    if (!existsSync(join(bin, "pg_ctl"))) throw new Error();
    return bin;
  } catch { throw new Error("PostgreSQL 설치가 필요합니다: brew install postgresql@18"); }
}

function initialized() { return existsSync(join(data, "PG_VERSION")); }
function running(bin: string) {
  return initialized() && spawnSync(join(bin, "pg_ctl"), ["-D", data, "status"], { stdio: "ignore" }).status === 0;
}
function start(bin: string) {
  if (!initialized()) throw new Error("먼저 npm run db:setup을 실행하세요.");
  if (running(bin)) return;
  try {
    execFileSync(join(bin, "pg_ctl"), ["-D", data, "-l", join(local, "postgres.log"), "-w", "-t", "30", "start"], { stdio: "ignore" });
  } catch { throw new Error("PostgreSQL 시작 실패. 55432 포트 사용 여부와 .local/postgres.log를 확인하세요."); }
}

function setEnv(source: string, key: string, value: string) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(source) ? source.replace(pattern, () => line) : `${source.trimEnd()}\n${line}\n`;
}

async function setup(bin: string) {
  mkdirSync(local, { recursive: true, mode: 0o700 });
  chmodSync(local, 0o700);
  if (!initialized()) {
    // Never reinitialize an existing or partly-created cluster.
    if (existsSync(data)) throw new Error("기존 .local/postgres 폴더가 있습니다. 데이터를 초기화하지 않고 중단했습니다.");
    if (!existsSync(passwordFile)) writeFileSync(passwordFile, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
    try {
      execFileSync(join(bin, "initdb"), ["-D", data, "--username=scenelog_admin", "--auth=scram-sha-256", `--pwfile=${passwordFile}`, "--encoding=UTF8", "--locale=C"], { stdio: "ignore" });
      // No public network listener or global /tmp Unix socket; only this machine can connect.
      writeFileSync(join(data, "postgresql.auto.conf"), `listen_addresses = '127.0.0.1'\nport = ${port}\nunix_socket_directories = ''\n`, { mode: 0o600 });
    } catch { throw new Error("로컬 DB 초기화에 실패했습니다. 기존 폴더를 자동 삭제하지 않습니다."); }
  }
  if (!existsSync(passwordFile)) throw new Error("로컬 DB 관리자 비밀번호 파일이 없습니다. 기존 DB는 변경하지 않았습니다.");
  start(bin);

  let source = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  let password = randomBytes(24).toString("hex");
  const previous = source.match(/^DATABASE_URL=["']?([^\r\n"']+)/m)?.[1];
  if (previous) {
    try {
      const url = new URL(previous);
      if (url.hostname === "127.0.0.1" && url.port === String(port) && url.username === "scenelog" && url.pathname === "/scenelog" && url.password) {
        password = decodeURIComponent(url.password);
      }
    } catch { /* Replace only the DB configuration with the requested local configuration. */ }
  }
  const admin = new Client({ host: "127.0.0.1", port, user: "scenelog_admin", password: readFileSync(passwordFile, "utf8").trim(), database: "postgres", connectionTimeoutMillis: 5000 });
  try {
    await admin.connect();
    const role = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", ["scenelog"]);
    // PostgreSQL DDL does not accept password parameters. Quote through PostgreSQL itself.
    const quoted = await admin.query<{ password: string }>("SELECT quote_literal($1::text) AS password", [password]);
    await admin.query(`${role.rowCount ? "ALTER" : "CREATE"} ROLE scenelog LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${quoted.rows[0].password}`);
    const database = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", ["scenelog"]);
    if (!database.rowCount) await admin.query("CREATE DATABASE scenelog OWNER scenelog");
  } catch { throw new Error("로컬 DB 계정 설정 실패. PostgreSQL 상태와 관리자 비밀번호 파일을 확인하세요."); }
  finally { await admin.end(); }

  source = setEnv(source, "DATABASE_URL", `postgresql://scenelog:${encodeURIComponent(password)}@127.0.0.1:${port}/scenelog`);
  source = setEnv(source, "DATABASE_MIGRATION_URL", "");
  writeFileSync(envFile, source, { mode: 0o600 });
  chmodSync(envFile, 0o600);
  console.log("로컬 PostgreSQL 준비 완료: 127.0.0.1:55432 / scenelog");
  console.log(".env.local의 DB 항목을 설정했습니다. Supabase·TMDB 값은 유지했습니다.");
}

async function main() {
  const bin = binaries();
  switch (process.argv[2]) {
    case "setup": await setup(bin); break;
    case "start": start(bin); console.log("로컬 PostgreSQL 실행 중: 127.0.0.1:55432"); break;
    case "stop":
      if (running(bin)) execFileSync(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "ignore" });
      console.log("로컬 PostgreSQL 중지. 데이터는 유지됩니다."); break;
    case "status": console.log(running(bin) ? "로컬 PostgreSQL 실행 중" : "로컬 PostgreSQL 중지 상태"); break;
    default: throw new Error("지원하지 않는 로컬 DB 명령입니다.");
  }
}

main().catch((error: unknown) => {
  // Child process/driver errors can contain secrets; only print our own safe guidance.
  const message = error instanceof Error && !('code' in error) && !('status' in error) ? error.message : "로컬 DB 작업 실패. docs/database.md를 확인하세요.";
  console.error(message);
  process.exitCode = 1;
});
