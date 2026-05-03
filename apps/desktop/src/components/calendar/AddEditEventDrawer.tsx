/**
 * Slide-over drawer for creating new events or editing an existing one.
 * Opened by setting `calendarComposer` in the global store. Submitting
 * persists the event + any inline checklist items, then selects the
 * saved event in the rail.
 */
import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  CalendarEventRow,
  CalendarEventType,
  ClassRow,
  FlashcardSetRow,
  NoteRow,
  QuizRow,
} from "@studynest/shared";
import { useApp } from "../../store.js";
import {
  getEvent,
  listChecklist,
  softDeleteChecklistItem,
  upsertChecklistItem,
  upsertEvent,
} from "../../db/calendar.js";
import {
  listClasses,
  listFlashcardSets,
  listNotes,
  listQuizzes,
} from "../../db/repositories.js";
import { CheckIcon, PlusIcon, XIcon } from "../icons.js";
import { labelForType } from "./eventVisuals.js";

const ALL_TYPES: CalendarEventType[] = [
  "study_block",
  "class",
  "exam",
  "quiz",
  "flashcards",
  "assignment",
  "reading",
  "reminder",
  "custom",
];

interface DraftItem {
  id?: string;
  label: string;
  completed: number;
  /** Set on items that came from the DB so we can hard-delete on save. */
  isExisting?: boolean;
  /** Items the user removed locally; we tombstone these on save. */
  removed?: boolean;
}

interface DraftState {
  title: string;
  type: CalendarEventType;
  class_id: string;
  note_id: string;
  quiz_id: string;
  flashcard_set_id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;
  allDay: boolean;
  recurringWeekly: boolean;
  location: string;
  description: string;
  reminderTime: string;
  color: string;
  tagsCsv: string;
  checklist: DraftItem[];
}

const EMPTY_DRAFT: DraftState = {
  title: "",
  type: "study_block",
  class_id: "",
  note_id: "",
  quiz_id: "",
  flashcard_set_id: "",
  date: todayIso(),
  startTime: "09:00",
  endTime: "10:00",
  allDay: false,
  recurringWeekly: false,
  location: "",
  description: "",
  reminderTime: "",
  color: "",
  tagsCsv: "",
  checklist: [],
};

export const AddEditEventDrawer: FC = () => {
  const composer = useApp((s) => s.calendarComposer);
  const setComposer = useApp((s) => s.setCalendarComposer);
  const setSelected = useApp((s) => s.setCalendarSelectedEvent);
  const open = composer !== null;

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [decks, setDecks] = useState<FlashcardSetRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");

  // Hydrate option lists every time the drawer opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      listClasses(),
      listNotes(null),
      listFlashcardSets(null),
      listQuizzes(null),
    ]).then(([cs, ns, ds, qs]) => {
      if (cancelled) return;
      setClasses(cs);
      setNotes(ns);
      setDecks(ds);
      setQuizzes(qs);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Hydrate draft from prefill or from an existing event.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (composer?.mode === "edit" && composer.eventId) {
      void hydrateFromEvent(composer.eventId);
    } else {
      const next: DraftState = { ...EMPTY_DRAFT };
      if (composer?.prefill) {
        const p = composer.prefill;
        if (p.title) next.title = p.title;
        if (p.type) next.type = p.type;
        if (p.class_id !== undefined) next.class_id = p.class_id ?? "";
        if (p.note_id !== undefined) next.note_id = p.note_id ?? "";
        if (p.quiz_id !== undefined) next.quiz_id = p.quiz_id ?? "";
        if (p.flashcard_set_id !== undefined)
          next.flashcard_set_id = p.flashcard_set_id ?? "";
        if (p.start_at) {
          const sd = new Date(p.start_at);
          next.date = isoFromDate(sd);
          next.startTime = hhmm(sd);
        }
        if (p.end_at) next.endTime = hhmm(new Date(p.end_at));
        if (p.all_day !== undefined) next.allDay = p.all_day;
        if (p.location) next.location = p.location;
        if (p.description) next.description = p.description;
      }
      setDraft(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, composer?.mode, composer?.eventId]);

  async function hydrateFromEvent(id: string): Promise<void> {
    const ev = await getEvent(id);
    if (!ev) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    const items = await listChecklist(id);
    const start = new Date(ev.start_at);
    const end = new Date(ev.end_at);
    const tags = (() => {
      try {
        const arr = JSON.parse(ev.tags_json) as unknown;
        if (Array.isArray(arr)) return arr.filter((t): t is string => typeof t === "string");
      } catch {
        /* drop */
      }
      return [] as string[];
    })();
    let recurringWeekly = false;
    if (ev.recurrence_json) {
      try {
        const v = JSON.parse(ev.recurrence_json) as { freq?: string };
        recurringWeekly = v.freq === "weekly";
      } catch {
        /* drop */
      }
    }
    setDraft({
      title: ev.title,
      type: ev.type,
      class_id: ev.class_id ?? "",
      note_id: ev.note_id ?? "",
      quiz_id: ev.quiz_id ?? "",
      flashcard_set_id: ev.flashcard_set_id ?? "",
      date: isoFromDate(start),
      startTime: hhmm(start),
      endTime: hhmm(end),
      allDay: !!ev.all_day,
      recurringWeekly,
      location: ev.location ?? "",
      description: ev.description ?? "",
      reminderTime: ev.reminder_at ? hhmm(new Date(ev.reminder_at)) : "",
      color: ev.color ?? "",
      tagsCsv: tags.join(", "),
      checklist: items.map((it) => ({
        id: it.id,
        label: it.label,
        completed: it.completed,
        isExisting: true,
      })),
    });
  }

  function close(): void {
    if (busy) return;
    setComposer(null);
  }

  async function save(): Promise<void> {
    if (!draft.title.trim()) {
      setError("Give the event a title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { startIso, endIso, reminderIso } = composeTimes(draft);
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        setError("End time must be after start time.");
        setBusy(false);
        return;
      }
      const tags = draft.tagsCsv
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const recurrence_json = draft.recurringWeekly
        ? JSON.stringify({ freq: "weekly" })
        : null;

      // Preserve existing fields when editing so we don't clobber e.g.
      // status / source_type that the rail manages directly.
      const existing =
        composer?.mode === "edit" && composer.eventId
          ? await getEvent(composer.eventId)
          : null;

      const saved = await upsertEvent({
        ...(existing ?? {}),
        id: existing?.id,
        title: draft.title.trim(),
        type: draft.type,
        class_id: draft.class_id || null,
        note_id: draft.note_id || null,
        quiz_id: draft.quiz_id || null,
        flashcard_set_id: draft.flashcard_set_id || null,
        start_at: startIso,
        end_at: endIso,
        all_day: draft.allDay ? 1 : 0,
        location: draft.location.trim() || null,
        description: draft.description.trim() || null,
        reminder_at: reminderIso,
        color: draft.color || null,
        tags_json: JSON.stringify(tags),
        recurrence_json,
      });

      // Apply checklist diffs.
      for (const item of draft.checklist) {
        if (item.removed && item.id) {
          await softDeleteChecklistItem(item.id);
          continue;
        }
        if (item.removed) continue;
        await upsertChecklistItem({
          id: item.id,
          event_id: saved.id,
          label: item.label,
          completed: item.completed,
        });
      }

      setSelected(saved.id);
      setComposer(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Computed before the early return so the hook order stays stable.
  const filteredNotes = useMemo<NoteRow[]>(() => {
    if (!draft.class_id) return notes;
    return notes.filter((n) => n.class_id === draft.class_id);
  }, [notes, draft.class_id]);

  if (!open || !composer) return null;

  const title = composer.mode === "edit" ? "Edit event" : "Add event";

  const visibleChecklist = draft.checklist.filter((c) => !c.removed);

  function patch<K extends keyof DraftState>(key: K, value: DraftState[K]): void {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function addChecklist(): void {
    const label = newItem.trim();
    if (!label) return;
    patch("checklist", [...draft.checklist, { label, completed: 0 }]);
    setNewItem("");
  }

  function toggleChecklist(idx: number): void {
    const next = [...draft.checklist];
    const cur = next[idx];
    if (!cur) return;
    next[idx] = { ...cur, completed: cur.completed ? 0 : 1 };
    patch("checklist", next);
  }

  function removeChecklist(idx: number): void {
    const next = [...draft.checklist];
    const cur = next[idx];
    if (!cur) return;
    if (cur.isExisting) next[idx] = { ...cur, removed: true };
    else next.splice(idx, 1);
    patch("checklist", next);
  }

  return (
    <div
      className="event-drawer-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside
        className="event-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="event-drawer-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="event-drawer-close"
            aria-label="Close"
            onClick={close}
          >
            <XIcon size={16} />
          </button>
        </header>

        <div className="event-drawer-body">
          <Field label="Title">
            <input
              autoFocus
              className="field"
              placeholder="e.g. Biology 201 Lecture"
              value={draft.title}
              onChange={(e) => patch("title", e.target.value)}
            />
          </Field>

          <Field label="Event type">
            <div className="event-drawer-segments">
              {ALL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`event-drawer-segment${draft.type === t ? " active" : ""}`}
                  onClick={() => patch("type", t)}
                >
                  {labelForType(t)}
                </button>
              ))}
            </div>
          </Field>

          <div className="event-drawer-grid">
            <Field label="Date">
              <input
                type="date"
                className="field"
                value={draft.date}
                onChange={(e) => patch("date", e.target.value)}
              />
            </Field>
            {!draft.allDay && (
              <>
                <Field label="Starts">
                  <input
                    type="time"
                    step={300}
                    className="field"
                    value={draft.startTime}
                    onChange={(e) =>
                      patch("startTime", snapTimeStr(e.target.value))
                    }
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="time"
                    step={300}
                    className="field"
                    value={draft.endTime}
                    onChange={(e) =>
                      patch("endTime", snapTimeStr(e.target.value))
                    }
                  />
                </Field>
              </>
            )}
          </div>

          <div className="event-drawer-toggles">
            <label className="event-drawer-toggle">
              <input
                type="checkbox"
                checked={draft.allDay}
                onChange={(e) => patch("allDay", e.target.checked)}
              />
              All-day
            </label>
            <label className="event-drawer-toggle">
              <input
                type="checkbox"
                checked={draft.recurringWeekly}
                onChange={(e) => patch("recurringWeekly", e.target.checked)}
              />
              Repeats weekly
            </label>
          </div>

          <div className="event-drawer-grid">
            <Field label="Linked class">
              <select
                className="field"
                value={draft.class_id}
                onChange={(e) => patch("class_id", e.target.value)}
              >
                <option value="">— none —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Linked note">
              <select
                className="field"
                value={draft.note_id}
                onChange={(e) => patch("note_id", e.target.value)}
              >
                <option value="">— none —</option>
                {filteredNotes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Linked deck">
              <select
                className="field"
                value={draft.flashcard_set_id}
                onChange={(e) => patch("flashcard_set_id", e.target.value)}
              >
                <option value="">— none —</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Linked quiz">
              <select
                className="field"
                value={draft.quiz_id}
                onChange={(e) => patch("quiz_id", e.target.value)}
              >
                <option value="">— none —</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Location">
            <input
              className="field"
              placeholder="e.g. Science Building, Room 204"
              value={draft.location}
              onChange={(e) => patch("location", e.target.value)}
            />
          </Field>

          <Field label="Description">
            <textarea
              className="field"
              rows={3}
              placeholder="What you'll cover or focus on…"
              value={draft.description}
              onChange={(e) => patch("description", e.target.value)}
            />
          </Field>

          <div className="event-drawer-grid">
            <Field label="Reminder">
              <input
                type="time"
                step={300}
                className="field"
                value={draft.reminderTime}
                onChange={(e) =>
                  patch("reminderTime", snapTimeStr(e.target.value))
                }
              />
            </Field>
            <Field label="Color">
              <select
                className="field"
                value={draft.color}
                onChange={(e) => patch("color", e.target.value)}
              >
                <option value="">Default</option>
                <option value="accentSage">Sage</option>
                <option value="accentSky">Sky</option>
                <option value="accentLilac">Lilac</option>
                <option value="accentAmber">Amber</option>
                <option value="accentPeach">Peach</option>
                <option value="accentRose">Rose</option>
              </select>
            </Field>
            <Field label="Tags">
              <input
                className="field"
                placeholder="Important, Weekly"
                value={draft.tagsCsv}
                onChange={(e) => patch("tagsCsv", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Checklist">
            <div className="event-drawer-checklist">
              {visibleChecklist.length === 0 && (
                <p className="event-rail-empty">No subtasks yet.</p>
              )}
              {draft.checklist.map((it, idx) =>
                it.removed ? null : (
                  <div
                    key={`${it.id ?? "new"}-${idx}`}
                    className={`event-drawer-task${it.completed ? " done" : ""}`}
                  >
                    <button
                      type="button"
                      className={`event-rail-check${it.completed ? " done" : ""}`}
                      aria-label={it.completed ? "Mark incomplete" : "Mark complete"}
                      onClick={() => toggleChecklist(idx)}
                    >
                      {it.completed ? <CheckIcon size={12} /> : null}
                    </button>
                    <span>{it.label}</span>
                    <button
                      type="button"
                      className="event-rail-task-remove"
                      aria-label="Remove"
                      onClick={() => removeChecklist(idx)}
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                ),
              )}
              <div className="event-rail-add">
                <input
                  className="field"
                  placeholder="Add subtask…"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChecklist();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addChecklist}
                  disabled={!newItem.trim()}
                >
                  <PlusIcon size={12} /> Add
                </button>
              </div>
            </div>
          </Field>

          {error && <p className="pill error">{error}</p>}
        </div>

        <footer className="event-drawer-foot">
          <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={busy || !draft.title.trim()}
          >
            {busy ? "Saving…" : composer.mode === "edit" ? "Save changes" : "Create event"}
          </button>
        </footer>
      </aside>
    </div>
  );
};

const Field: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="event-drawer-field">
    <span className="event-drawer-field-label">{label}</span>
    {children}
  </label>
);

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Snap a manually-typed `HH:MM` to the nearest 5 minutes. We let the
 * user type freely (so they can keep typing past invalid intermediate
 * states), but commit only round-five values to keep the calendar grid
 * and the database consistent.
 */
function snapTimeStr(input: string): string {
  if (!input) return input;
  const [h, m] = input.split(":").map((s) => parseInt(s, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return input;
  const snapped = Math.round(m! / 5) * 5;
  const carry = snapped >= 60 ? 1 : 0;
  const mm = snapped % 60;
  const hh = (h! + carry) % 24;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function composeTimes(draft: DraftState): {
  startIso: string;
  endIso: string;
  reminderIso: string | null;
} {
  const [yy, mm, dd] = draft.date.split("-").map((s) => parseInt(s, 10));
  const baseDate = new Date(yy!, (mm ?? 1) - 1, dd ?? 1);
  if (draft.allDay) {
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const rem = parseTimeOnDate(draft.reminderTime, baseDate);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      reminderIso: rem,
    };
  }
  const start = parseTimeOnDate(draft.startTime, baseDate);
  const end = parseTimeOnDate(draft.endTime, baseDate);
  const rem = parseTimeOnDate(draft.reminderTime, baseDate);
  return {
    startIso: start ?? new Date(baseDate).toISOString(),
    endIso: end ?? new Date(baseDate).toISOString(),
    reminderIso: rem,
  };
}

function parseTimeOnDate(time: string, baseDate: Date): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map((s) => parseInt(s, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(baseDate);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}
