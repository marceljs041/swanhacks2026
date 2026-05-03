import { SEED_SYNC_STATE_SQL, runMigrations as runMigrationsCore, } from "@studynest/db-schema";
import { ulid } from "@studynest/shared";
import { wrapSqlJsDatabase } from "./sqljs-wrapper.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
let _rawDb = null;
let _db = null;
let _deviceId = null;
let _persistPath = null;
let _persistTimer = null;
function isRendererProcess() {
    return (typeof window !== "undefined" &&
        typeof window.studynest !== "undefined");
}
/** Joins path segments without importing node:path. */
function pathJoin(...parts) {
    return parts
        .filter((p) => p && p.length > 0)
        .join("/")
        .replace(/\/+/g, "/");
}
function pathDirname(p) {
    const i = p.lastIndexOf("/");
    return i <= 0 ? "/" : p.slice(0, i);
}
function schedulePersist() {
    if (!_rawDb)
        return;
    if (_persistTimer)
        clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
        _persistTimer = null;
        const data = _rawDb.export();
        const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
        if (typeof window !== "undefined" && window.studynest?.saveDatabaseFile) {
            void window.studynest.saveDatabaseFile(buf);
            return;
        }
        if (_persistPath) {
            void (async () => {
                const fs = await import("node:fs");
                fs.mkdirSync(pathDirname(_persistPath), { recursive: true });
                fs.writeFileSync(_persistPath, Buffer.from(buf));
            })();
        }
    }, 400);
}
async function getUserDataDir() {
    if (typeof process !== "undefined" && process.env?.STUDYNEST_USER_DATA) {
        return process.env.STUDYNEST_USER_DATA;
    }
    if (typeof window !== "undefined" && window.studynest?.getPaths) {
        const paths = await window.studynest.getPaths();
        return paths.userData;
    }
    try {
        const { app } = await import("electron");
        return app.getPath("userData");
    }
    catch {
        return pathJoin(process.cwd(), ".studynest");
    }
}
async function loadSqlJs() {
    const initSqlJs = (await import("sql.js")).default;
    if (isRendererProcess()) {
        return initSqlJs({ locateFile: () => sqlWasmUrl });
    }
    const { createRequire } = await import("node:module");
    const path = await import("node:path");
    const require = createRequire(import.meta.url);
    const pkgRoot = path.dirname(require.resolve("sql.js/package.json"));
    const wasmDir = path.join(pkgRoot, "dist");
    return initSqlJs({ locateFile: (f) => path.join(wasmDir, f) });
}
async function openRawDatabase(initial) {
    const SQL = await loadSqlJs();
    if (initial && initial.byteLength > 0)
        return new SQL.Database(initial);
    return new SQL.Database();
}
export async function getDb() {
    if (_db)
        return _db;
    const dir = await getUserDataDir();
    _persistPath = pathJoin(dir, "studynest.sqlite");
    let initial;
    if (typeof window !== "undefined" && window.studynest?.loadDatabaseFile) {
        const buf = await window.studynest.loadDatabaseFile();
        if (buf)
            initial = new Uint8Array(buf);
    }
    else {
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
    }
    catch {
        /* ignore */
    }
    const db = _db;
    const runner = {
        exec(sql) {
            db.exec(sql);
        },
        async getAppliedVersion() {
            const row = db
                .prepare("select max(version) as v from schema_migrations")
                .get();
            return row?.v ?? 0;
        },
        async recordVersion(version, name) {
            db
                .prepare("insert into schema_migrations (version, name, applied_at) values (?, ?, ?)")
                .run(version, name, new Date().toISOString());
        },
    };
    await runMigrationsCore(runner);
    const deviceRow = db.prepare("select device_id from sync_state where id = 1").get();
    if (!deviceRow) {
        const id = ulid("dev");
        db.prepare(SEED_SYNC_STATE_SQL).run(id);
        _deviceId = id;
    }
    else {
        _deviceId = deviceRow.device_id;
    }
    schedulePersist();
    return _db;
}
export async function getDeviceId() {
    if (_deviceId)
        return _deviceId;
    await getDb();
    return _deviceId ?? "dev_unknown";
}
export async function getUserId() {
    const db = await getDb();
    const row = db.prepare("select user_id from sync_state where id = 1").get();
    return row?.user_id ?? null;
}
export async function setUserId(userId) {
    const db = await getDb();
    db.prepare("update sync_state set user_id = ? where id = 1").run(userId);
}
//# sourceMappingURL=client.js.map