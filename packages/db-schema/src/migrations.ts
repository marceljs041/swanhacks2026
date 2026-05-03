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
  {
    version: 3,
    name: "classes_archived_at",
    sql: /* sql */ `
      alter table classes add column archived_at text;
    `,
    idempotentAddColumn: true,
  },
  {
    version: 4,
    name: "classes_overview_text",
    sql: /* sql */ `
      alter table classes add column overview_text text;
    `,
    idempotentAddColumn: true,
  },
  /**
   * Quiz feature buildout: a string of additive `alter table` statements
   * followed by a new `quiz_sessions` table and supporting indexes.
   *
   * We split each `alter table … add column …` into its own migration
   * entry rather than batching them, because the runner stops at the
   * first failure and the `idempotentAddColumn` swallow only covers a
   * single statement. Existing devices apply each alter in order; fresh
   * installs (where `CREATE_TABLES_SQL` already includes the columns)
   * see "duplicate column name" errors that are swallowed one by one.
   */
  ...quizBuildoutMigrations(),
  /**
   * Calendar feature: introduces the rich `calendar_events` and
   * `checklist_items` tables, plus supporting indexes. Idempotent
   * `create table if not exists` so fresh installs (where
   * `CREATE_TABLES_SQL` already includes these tables) skip safely.
   */
  {
    version: 23,
    name: "calendar_events",
    sql: /* sql */ `
      create table if not exists calendar_events (
        id text primary key,
        title text not null,
        type text not null,
        class_id text,
        note_id text,
        quiz_id text,
        flashcard_set_id text,
        study_plan_id text,
        description text,
        location text,
        start_at text not null,
        end_at text not null,
        all_day integer not null default 0,
        color text,
        tags_json text not null default '[]',
        reminder_at text,
        source_type text not null default 'manual',
        status text not null default 'scheduled',
        recurrence_json text,
        created_at text not null,
        updated_at text not null,
        deleted_at text,
        sync_version integer not null default 1
      );
      create table if not exists checklist_items (
        id text primary key,
        event_id text not null,
        label text not null,
        completed integer not null default 0,
        position integer,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      );
      create index if not exists idx_calendar_events_start_at on calendar_events(start_at) where deleted_at is null;
      create index if not exists idx_calendar_events_class_id on calendar_events(class_id) where deleted_at is null;
      create index if not exists idx_calendar_events_study_plan_id on calendar_events(study_plan_id) where deleted_at is null;
      create index if not exists idx_checklist_items_event_id on checklist_items(event_id) where deleted_at is null;
    `,
  },
  {
    version: 24,
    name: "sync_state_last_pushed_at",
    sql: /* sql */ `
      alter table sync_state add column last_pushed_at text;
    `,
    idempotentAddColumn: true,
  },
  {
    version: 25,
    name: "reward_points_events",
    sql: /* sql */ `
      create table if not exists reward_points_events (
        id text primary key,
        action text not null,
        points integer not null,
        created_at text not null
      );
      create index if not exists idx_reward_points_events_created_at on reward_points_events(created_at);
    `,
  },
];

/**
 * Generates the sequential migration entries for the v5 quiz buildout.
 * Lives next to `MIGRATIONS` (instead of inline) so the version numbers
 * stay easy to read at a glance.
 */
function quizBuildoutMigrations(): Migration[] {
  let v = 5;
  const addColumn = (table: string, name: string, type: string): Migration => ({
    version: v++,
    name: `${table}_${name}`,
    sql: /* sql */ `alter table ${table} add column ${name} ${type};`,
    idempotentAddColumn: true,
  });
  const out: Migration[] = [
    addColumn("quizzes", "class_id", "text"),
    addColumn("quizzes", "description", "text"),
    addColumn("quizzes", "difficulty", "text not null default 'medium'"),
    addColumn("quizzes", "status", "text not null default 'new'"),
    addColumn("quizzes", "source_type", "text not null default 'note'"),
    addColumn("quizzes", "source_ids_json", "text"),
    addColumn("quizzes", "weak_topics_json", "text"),
    addColumn("quizzes", "tags_json", "text"),
    addColumn("quiz_questions", "topic", "text"),
    addColumn("quiz_questions", "hint", "text"),
    addColumn("quiz_questions", "source_note_id", "text"),
    addColumn("quiz_questions", "position", "integer"),
    addColumn("quiz_attempts", "started_at", "text"),
    addColumn("quiz_attempts", "finished_at", "text"),
    addColumn("quiz_attempts", "completed", "integer not null default 1"),
    addColumn("quiz_attempts", "weak_topics_json", "text"),
    addColumn("quiz_attempts", "time_spent_seconds", "integer"),
    {
      version: v++,
      name: "quiz_sessions",
      sql: /* sql */ `
        create table if not exists quiz_sessions (
          quiz_id text primary key,
          current_index integer not null default 0,
          answers_json text not null default '{}',
          started_at text not null,
          updated_at text not null,
          foreign key (quiz_id) references quizzes(id)
        );
        create index if not exists idx_quizzes_class_id on quizzes(class_id) where deleted_at is null;
        create index if not exists idx_quiz_attempts_quiz_id on quiz_attempts(quiz_id);
      `,
    },
  ];
  return out;
}

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
