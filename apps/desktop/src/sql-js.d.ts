/** Minimal typings for sql.js (WASM); avoids pulling full @types dependency graph. */
declare module "sql.js" {
  export interface Statement {
    bind(values?: unknown[] | Record<string, unknown>): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer);
    run(sql: string): void;
    exec(sql: string): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
  export default initSqlJs;
}
