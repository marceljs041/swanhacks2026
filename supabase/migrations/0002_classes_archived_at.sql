-- Mirror local SQLite: hide archived classes from active lists without deleting.

alter table classes
  add column if not exists archived_at timestamptz;
