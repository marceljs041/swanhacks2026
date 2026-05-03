-- Align Postgres with desktop SQLite payloads so /sync/push upserts succeed.

alter table classes add column if not exists overview_text text;
alter table classes add column if not exists archived_at timestamptz;

alter table notes add column if not exists icon text not null default 'note';

alter table quizzes add column if not exists class_id text references classes(id);
alter table quizzes add column if not exists description text;
alter table quizzes add column if not exists difficulty text not null default 'medium';
alter table quizzes add column if not exists status text not null default 'new';
alter table quizzes add column if not exists source_type text not null default 'note';
alter table quizzes add column if not exists source_ids_json text;
alter table quizzes add column if not exists weak_topics_json text;
alter table quizzes add column if not exists tags_json text;

alter table quiz_questions add column if not exists topic text;
alter table quiz_questions add column if not exists hint text;
alter table quiz_questions add column if not exists source_note_id text;
alter table quiz_questions add column if not exists position integer;

alter table quiz_attempts add column if not exists started_at timestamptz;
alter table quiz_attempts add column if not exists finished_at timestamptz;
alter table quiz_attempts add column if not exists completed integer not null default 1;
alter table quiz_attempts add column if not exists weak_topics_json text;
alter table quiz_attempts add column if not exists time_spent_seconds integer;
