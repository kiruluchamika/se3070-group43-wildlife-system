import * as SQLite from "expo-sqlite";
import { QueueItem, QueueStore } from "./queue-core";
let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  if (!database)
    database = (async () => {
      const value = await SQLite.openDatabaseAsync("wildguard.db");
      await value.execAsync(
        "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS queue (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, data TEXT NOT NULL);",
      );
      return value;
    })().catch((error) => {
      database = undefined;
      throw error;
    });
  return database;
}
export const queueStore: QueueStore = {
  async list(owner) {
    return (
      await (
        await db()
      ).getAllAsync<{ data: string }>(
        "SELECT data FROM queue WHERE owner = ?",
        owner,
      )
    ).map((r) => JSON.parse(r.data));
  },
  async put(item: QueueItem) {
    await (
      await db()
    ).runAsync(
      "INSERT OR REPLACE INTO queue (id,owner,data) VALUES (?,?,?)",
      item.id,
      item.owner,
      JSON.stringify(item),
    );
  },
};
export async function cacheGet(key: string) {
  const row = await (
    await db()
  ).getFirstAsync<{ data: string }>(
    "SELECT data FROM cache WHERE key = ?",
    key,
  );
  return row ? JSON.parse(row.data) : null;
}
export async function cachePut(key: string, value: unknown) {
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO cache (key,data) VALUES (?,?)",
    key,
    JSON.stringify(value),
  );
}
export async function clearCache() {
  await (await db()).execAsync("DELETE FROM cache");
}
