import "server-only";
import type { DatabaseClient, DatabasePool } from "./pool";

export async function inTransaction<T>(pool: DatabasePool, operation: (client: DatabaseClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let destroy = false;
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); }
    catch { destroy = true; }
    throw error;
  } finally {
    client.release(destroy);
  }
}
