import { CREATE_INDEXES_SQL, CREATE_TABLES_SQL, SCHEMA_VERSION } from "./sql.js";

/**
 * A migration is a numbered, idempotent SQL block. The runner records the
 * highest applied version in the `schema_migrations` table.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "init",
    sql: `${CREATE_TABLES_SQL}\n${CREATE_INDEXES_SQL}`,
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
    await runner.exec(m.sql);
    await runner.recordVersion(m.version, m.name);
  }
}

export { SCHEMA_VERSION };
