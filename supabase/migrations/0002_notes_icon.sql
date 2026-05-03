-- Mirror of local migration v2: each note carries an icon key so the
-- list view can render a per-note glyph. Default keeps existing rows
-- showing the standard note icon.

alter table notes
  add column if not exists icon text not null default 'note';
