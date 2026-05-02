/**
 * Mobile SQLite client. Uses expo-sqlite (async API). Same logical schema
 * as desktop — both use packages/db-schema as the source of truth.
 */
import * as SQLite from "expo-sqlite";
import {
  ENSURE_MIGRATION_TABLE_SQL,
  MIGRATIONS,
  SEED_SYNC_STATE_SQL,
} from "@studynest/db-schema";
import { ulid } from "@studynest/shared";

let _db: SQLite.SQLiteDatabase | null = null;
let _deviceId: string | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("studynest.db");
  await _db.execAsync("PRAGMA foreign_keys = ON;");
  await runMigrations(_db);
  return _db;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(ENSURE_MIGRATION_TABLE_SQL);
  const row = (await db.getFirstAsync(
    "select max(version) as v from schema_migrations",
  )) as { v: number | null } | null;
  const applied = row?.v ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version <= applied) continue;
    await db.execAsync(m.sql);
    await db.runAsync(
      "insert into schema_migrations (version, name, applied_at) values (?, ?, ?)",
      [m.version, m.name, new Date().toISOString()],
    );
  }
  // Seed sync_state with a per-device ULID once.
  const dev = (await db.getFirstAsync(
    "select device_id from sync_state where id = 1",
  )) as { device_id: string } | null;
  if (!dev) {
    const id = ulid("dev");
    await db.runAsync(SEED_SYNC_STATE_SQL, [id]);
    _deviceId = id;
  } else {
    _deviceId = dev.device_id;
  }
}

export async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  await getDb();
  return _deviceId ?? "dev_unknown";
}

export async function getUserId(): Promise<string | null> {
  const db = await getDb();
  const row = (await db.getFirstAsync(
    "select user_id from sync_state where id = 1",
  )) as { user_id: string | null } | null;
  return row?.user_id ?? null;
}

export async function setUserId(userId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("update sync_state set user_id = ? where id = 1", [userId]);
}
