import "server-only";
import type { PoolConfig } from "pg";
import supabaseCA from "./supabase-ca.json";

/** The public Supabase CA is bundled so teammates need no machine-specific path. */
export function databaseConnectionOptions(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  const hosted = /^db\.[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.hostname.endsWith(".pooler.supabase.com");
  if (!hosted) return { connectionString };

  // pg parses URL SSL parameters after the options object, overriding its CA.
  // Supply all TLS settings in one place; never disable CA or hostname checks.
  for (const key of ["ssl", "sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: { ca: supabaseCA.certificate, rejectUnauthorized: true },
  };
}
