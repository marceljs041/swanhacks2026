/**
 * Wraps sql.js Database with a better-sqlite3-shaped API used by repositories.
 */
import type { Database as SqlJsDatabase } from "sql.js";

export interface CompatibleDb {
  prepare(sql: string): CompatibleStatement;
  exec(sql: string): void;
  pragma(sql: string): void;
  transaction<T extends (...args: any[]) => void>(fn: T): T;
}

export interface CompatibleStatement {
  run(...params: unknown[]): void;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

export function wrapSqlJsDatabase(
  db: SqlJsDatabase,
  onMutate: () => void,
): CompatibleDb {
  function bindParams(stmt: import("sql.js").Statement, params: unknown[]): void {
    if (params.length === 0) return;
    const first = params[0];
    if (
      first !== null &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      !(first instanceof Uint8Array)
    ) {
      const o = first as Record<string, unknown>;
      const mapped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        const base = k.replace(/^[@:$]/, "");
        mapped[":" + base] = v;
        mapped["@" + base] = v;
        mapped["$" + base] = v;
      }
      stmt.bind(mapped);
    } else {
      stmt.bind(params as unknown[]);
    }
  }

  const prepare = (sql: string): CompatibleStatement => ({
    run(...params: unknown[]) {
      const stmt = db.prepare(sql);
      try {
        bindParams(stmt, params);
        stmt.step();
        onMutate();
      } finally {
        stmt.free();
      }
    },
    get(...params: unknown[]) {
      const stmt = db.prepare(sql);
      try {
        bindParams(stmt, params);
        if (!stmt.step()) return undefined;
        return stmt.getAsObject() as Record<string, unknown>;
      } finally {
        stmt.free();
      }
    },
    all(...params: unknown[]) {
      const stmt = db.prepare(sql);
      try {
        bindParams(stmt, params);
        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as Record<string, unknown>);
        }
        return rows;
      } finally {
        stmt.free();
      }
    },
  });

  return {
    prepare,
    exec(sql: string) {
      db.exec(sql);
      onMutate();
    },
    pragma(cmd: string) {
      // "journal_mode = WAL" etc.
      db.run(`PRAGMA ${cmd}`);
    },
    transaction<T extends (...args: any[]) => void>(fn: T): T {
      const wrapped = ((...args: any[]) => {
        db.run("BEGIN");
        try {
          fn(...args);
          db.run("COMMIT");
          onMutate();
        } catch (e) {
          try {
            db.run("ROLLBACK");
          } catch {
            /* ignore */
          }
          throw e;
        }
      }) as T;
      return wrapped;
    },
  };
}
