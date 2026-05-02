/**
 * Desktop SQLite: sql.js (WASM) in the Electron renderer (Vite-compatible).
 * `better-sqlite3` cannot load in the Chromium renderer — it caused a blank UI.
 *
 * Persistence:
 *   - Renderer (BrowserWindow): IPC to main writes userData/studynest.sqlite.
 *   - Node (seed/tsx scripts):  direct fs writes.
 *
 * IMPORTANT: This file is imported by the renderer. It MUST NOT statically
 * import `node:fs`, `node:path`, or `node:module` at module scope, because
 * vite-plugin-electron-renderer's polyfill runs `require(...)` at module
 * evaluation. With `nodeIntegration: false` (our secure default) `require` is
 * undefined in the renderer and that throws, blanking the whole UI. We load
 * those built-ins lazily on the non-renderer code paths instead.
 */
import type { Database as SqlJsDatabase } from "sql.js";
import type { SqlJsStatic } from "sql.js";
import {
  SEED_SYNC_STATE_SQL,
  runMigrations as runMigrationsCore,
  type MigrationRunner,
} from "@studynest/db-schema";
import { ulid } from "@studynest/shared";
import { type CompatibleDb, wrapSqlJsDatabase } from "./sqljs-wrapper.js";

import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

let _rawDb: SqlJsDatabase | null = null;
let _db: CompatibleDb | null = null;
let _deviceId: string | null = null;
let _persistPath: string | null = null;
let _persistTimer: ReturnType<typeof setTimeout> | null = null;

function isRendererProcess(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { studynest?: unknown }).studynest !== "undefined"
  );
}

/** Joins path segments without importing node:path. */
function pathJoin(...parts: string[]): string {
  return parts
    .filter((p) => p && p.length > 0)
    .join("/")
    .replace(/\/+/g, "/");
}

function pathDirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i <= 0 ? "/" : p.slice(0, i);
}

function schedulePersist(): void {
  if (!_rawDb) return;
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    const data = _rawDb!.export();
    const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (typeof window !== "undefined" && window.studynest?.saveDatabaseFile) {
      void window.studynest.saveDatabaseFile(buf);
      return;
    }
    if (_persistPath) {
      void (async () => {
        const fs = await import("node:fs");
        fs.mkdirSync(pathDirname(_persistPath!), { recursive: true });
        fs.writeFileSync(_persistPath!, Buffer.from(buf));
      })();
    }
  }, 400);
}

async function getUserDataDir(): Promise<string> {
  if (typeof process !== "undefined" && process.env?.STUDYNEST_USER_DATA) {
    return process.env.STUDYNEST_USER_DATA;
  }
  if (typeof window !== "undefined" && window.studynest?.getPaths) {
    const paths = await window.studynest.getPaths();
    return paths.userData as string;
  }
  try {
    const { app } = await import("electron");
    return app.getPath("userData");
  } catch {
    return pathJoin(process.cwd(), ".studynest");
  }
}

async function loadSqlJs(): Promise<SqlJsStatic> {
  const initSqlJs = (await import("sql.js")).default;

  if (isRendererProcess()) {
    return initSqlJs({ locateFile: () => sqlWasmUrl as string });
  }

  const { createRequire } = await import("node:module");
  const path = await import("node:path");
  const require = createRequire(import.meta.url);
  const pkgRoot = path.dirname(require.resolve("sql.js/package.json"));
  const wasmDir = path.join(pkgRoot, "dist");
  return initSqlJs({ locateFile: (f: string) => path.join(wasmDir, f) });
}

async function openRawDatabase(initial?: Uint8Array): Promise<SqlJsDatabase> {
  const SQL = await loadSqlJs();
  if (initial && initial.byteLength > 0) return new SQL.Database(initial);
  return new SQL.Database();
}

export async function getDb(): Promise<CompatibleDb> {
  if (_db) return _db;

  const dir = await getUserDataDir();
  _persistPath = pathJoin(dir, "studynest.sqlite");

  let initial: Uint8Array | undefined;
  if (typeof window !== "undefined" && window.studynest?.loadDatabaseFile) {
    const buf = await window.studynest.loadDatabaseFile();
    if (buf) initial = new Uint8Array(buf);
  } else {
    const fs = await import("node:fs");
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(_persistPath)) {
      initial = new Uint8Array(fs.readFileSync(_persistPath));
    }
  }

  _rawDb = await openRawDatabase(initial);
  _db = wrapSqlJsDatabase(_rawDb, schedulePersist);

  try {
    _db.pragma("foreign_keys=ON");
  } catch {
    /* ignore */
  }

  const db = _db;
  const runner: MigrationRunner = {
    exec(sql) {
      db.exec(sql);
    },
    async getAppliedVersion() {
      const row = db
        .prepare("select max(version) as v from schema_migrations")
        .get() as { v: number | null } | undefined;
      return row?.v ?? 0;
    },
    async recordVersion(version, name) {
      db
        .prepare(
          "insert into schema_migrations (version, name, applied_at) values (?, ?, ?)",
        )
        .run(version, name, new Date().toISOString());
    },
  };

  await runMigrationsCore(runner);

  const deviceRow = db.prepare("select device_id from sync_state where id = 1").get() as
    | { device_id: string }
    | undefined;
  if (!deviceRow) {
    const id = ulid("dev");
    db.prepare(SEED_SYNC_STATE_SQL).run(id);
    _deviceId = id;
  } else {
    _deviceId = deviceRow.device_id;
  }

  schedulePersist();
  return _db;
}

export async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  await getDb();
  return _deviceId ?? "dev_unknown";
}

export async function getUserId(): Promise<string | null> {
  const db = await getDb();
  const row = db.prepare("select user_id from sync_state where id = 1").get() as
    | { user_id: string | null }
    | undefined;
  return row?.user_id ?? null;
}

export async function setUserId(userId: string): Promise<void> {
  const db = await getDb();
  db.prepare("update sync_state set user_id = ? where id = 1").run(userId);
}
