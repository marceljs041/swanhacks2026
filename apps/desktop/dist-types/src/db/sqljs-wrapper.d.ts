/**
 * Wraps sql.js Database with a better-sqlite3-shaped API used by repositories.
 */
import type { Database as SqlJsDatabase } from "sql.js";
export interface CompatibleDb {
    prepare(sql: string): CompatibleStatement;
    exec(sql: string): void;
    pragma(sql: string): void;
    transaction<T extends (...args: unknown[]) => void>(fn: T): T;
}
export interface CompatibleStatement {
    run(...params: unknown[]): void;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
}
export declare function wrapSqlJsDatabase(db: SqlJsDatabase, onMutate: () => void): CompatibleDb;
//# sourceMappingURL=sqljs-wrapper.d.ts.map