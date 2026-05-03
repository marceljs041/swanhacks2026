import { CREATE_INDEXES_SQL, CREATE_TABLES_SQL, SCHEMA_VERSION } from "./sql";

/**
 * A migration is a numbered, idempotent SQL block. The runner records the
 * highest applied version in the `schema_migrations` table.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
  /**
   * When true, swallow "duplicate column name" errors so this migration
   * is a no-op on fresh installs (where `CREATE_TABLES_SQL` already
   * includes the column added here) but still applies cleanly on
   * existing devices that ran v1 before the column was introduced.
   * Use only for additive `alter table … add column …` migrations.
   */
  idempotentAddColumn?: boolean;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "init",
    sql: `${CREATE_TABLES_SQL}\n${CREATE_INDEXES_SQL}`,
  },
  {
    // SQLite has no `add column if not exists`; the runner only re-runs
    // migrations whose version exceeds the recorded max, so this fires
    // exactly once per device. We still wrap the alter in a savepoint
    // expression that swallows duplicate-column errors so manually
    // patched databases (e.g. a dev who hand-added the column) don't
    // brick on first start.
    version: 2,
    name: "notes_icon",
    sql: /* sql */ `
      alter table notes add column icon text not null default 'note';
    `,
    idempotentAddColumn: true,
  },
];

export const ENSURE_MIGRATION_TABLE_SQL = /* sql */ `
create table if not exists schema_migrations (
  version integer primary key,
  name text not null,
  applied_at text not null
);
`;

export interface MigrationRunner {
  exec(sql: string): void | Promise<void>;
  getAppliedVersion(): number | Promise<number>;
  recordVersion(version: number, name: string): void | Promise<void>;
}

/**
 * Runtime-agnostic migration runner. Mobile (expo-sqlite) and desktop
 * (better-sqlite3) each provide a thin adapter. See:
 *  - apps/mobile/src/db/client.ts
 *  - apps/desktop/src/db/client.ts
 */
export async function runMigrations(runner: MigrationRunner): Promise<void> {
  await runner.exec(ENSURE_MIGRATION_TABLE_SQL);
  const applied = await runner.getAppliedVersion();
  for (const m of MIGRATIONS) {
    if (m.version <= applied) continue;
    try {
      await runner.exec(m.sql);
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      // Tolerated when explicitly opted in: see Migration.idempotentAddColumn.
      if (m.idempotentAddColumn && /duplicate column name/i.test(msg)) {
        // Column already present (fresh install) — treat as applied.
      } else {
        throw err;
      }
    }
    await runner.recordVersion(m.version, m.name);
  }
}

export { SCHEMA_VERSION };
