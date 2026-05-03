/**
 * Right-column detail rail for a single calendar event. Lives in the
 * same grid cell that other "detail rails" use across the app
 * (Classes, Flashcards, Quizzes), and matches the layout from the
 * reference image: header → tags → metadata → description → tasks →
 * related → sync footer.
 */
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CalendarEventRow,
  ChecklistItemRow,
  ClassRow,
  FlashcardSetRow,
  NoteRow,
  QuizRow,
} from "@studynest/shared";
import { useApp } from "../../store.js";
import { withViewTransition } from "../../lib/viewTransition.js";
import {
  duplicateEvent,
  getEvent,
  listChecklist,
  setEventStatus,
  softDeleteChecklistItem,
  softDeleteEvent,
  toggleChecklistItem,
  upsertChecklistItem,
  upsertEvent,
} from "../../db/calendar.js";
import {
  getNote,
  listClasses,
  listFlashcardSets,
  listQuizzes,
} from "../../db/repositories.js";
import { MoreMenu, type MoreMenuItem } from "../ui/MoreMenu.js";
import {
  ArrowLeftIcon,
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CloudCheckIcon,
  CloudOffIcon,
  FlashcardIcon,
  LinkIcon,
  NoteIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  QuizIcon,
  RepeatIcon,
  TrashIcon,
  XIcon,
} from "../icons.js";
import {
  fmtTime,
  iconForEvent,
  labelForType,
  toneForEvent,
} from "./eventVisuals.js";

interface Props {
  eventId: string;
}

export const EventDetailRail: FC<Props> = ({ eventId }) => {
  const setSelected = useApp((s) => s.setCalendarSelectedEvent);
  const setView = useApp((s) => s.setView);
  const setComposer = useApp((s) => s.setCalendarComposer);
  const syncStatus = useApp((s) => s.syncStatus);

  const [event, setEvent] = useState<CalendarEventRow | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItemRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [note, setNote] = useState<NoteRow | null>(null);
  const [decks, setDecks] = useState<FlashcardSetRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [reload, setReload] = useState(0);
  const [newItem, setNewItem] = useState("");

  // Load the event and any related rows the rail needs to render.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ev = await getEvent(eventId);
      if (cancelled) return;
      setEvent(ev);
      if (!ev) {
        setChecklist([]);
        setNote(null);
        return;
      }
      const [list, cls, allDecks, allQuizzes] = await Promise.all([
        listChecklist(eventId),
        listClasses(),
        listFlashcardSets(null),
        listQuizzes(null),
      ]);
      if (cancelled) return;
      setChecklist(list);
      setClasses(cls);
      setDecks(allDecks);
      setQuizzes(allQuizzes);
      if (ev.note_id) {
        const n = await getNote(ev.note_id);
        if (!cancelled) setNote(n);
      } else {
        setNote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, reload]);

  const cls = useMemo<ClassRow | null>(() => {
    if (!event?.class_id) return null;
    return classes.find((c) => c.id === event.class_id) ?? null;
  }, [event, classes]);

  const deck = useMemo<FlashcardSetRow | null>(() => {
    if (!event?.flashcard_set_id) return null;
    return decks.find((d) => d.id === event.flashcard_set_id) ?? null;
  }, [event, decks]);

  const quiz = useMemo<QuizRow | null>(() => {
    if (!event?.quiz_id) return null;
    return quizzes.find((q) => q.id === event.quiz_id) ?? null;
  }, [event, quizzes]);

  const tags = useMemo<string[]>(() => {
    if (!event) return [];
    try {
      const arr = JSON.parse(event.tags_json) as unknown;
      if (Array.isArray(arr)) return arr.filter((t): t is string => typeof t === "string");
    } catch {
      /* drop */
    }
    return [];
  }, [event]);

  const close = useCallback((): void => {
    withViewTransition(() => setSelected(null));
  }, [setSelected]);

  if (!event) {
    return (
      <aside
        className="right-panel calendar-rail empty right-panel--calendar-swap"
        aria-label="Event details"
      >
        <div className="event-rail-head">
          <button
            type="button"
            className="event-rail-back"
            aria-label="Close event"
            onClick={close}
          >
            <ArrowLeftIcon size={16} />
          </button>
        </div>
        <p className="event-rail-empty-msg">Loading event…</p>
      </aside>
    );
  }

  const tone = toneForEvent(event, cls);

  async function refresh(): Promise<void> {
    setReload((n) => n + 1);
  }

  async function toggleItem(id: string): Promise<void> {
    await toggleChecklistItem(id);
    await refresh();
  }

  async function addItem(): Promise<void> {
    const label = newItem.trim();
    if (!label) return;
    await upsertChecklistItem({ event_id: event!.id, label });
    setNewItem("");
    await refresh();
  }

  async function removeItem(id: string): Promise<void> {
    await softDeleteChecklistItem(id);
    await refresh();
  }

  async function markComplete(): Promise<void> {
    const next = event!.status === "completed" ? "scheduled" : "completed";
    await setEventStatus(event!.id, next);
    await refresh();
  }

  async function deleteEvent(): Promise<void> {
    await softDeleteEvent(event!.id);
    withViewTransition(() => setSelected(null));
  }

  async function duplicate(): Promise<void> {
    const copy = await duplicateEvent(event!.id);
    if (copy) setSelected(copy.id);
  }

  function edit(): void {
    setComposer({ mode: "edit", eventId: event!.id });
  }

  const moreItems: MoreMenuItem[] = [
    { label: "Edit event", icon: <PencilIcon size={14} />, onClick: edit },
    {
      label: event.status === "completed" ? "Mark incomplete" : "Mark complete",
      icon: <CheckIcon size={14} />,
      onClick: () => void markComplete(),
    },
    {
      label: "Duplicate",
      icon: <PlusIcon size={14} />,
      onClick: () => void duplicate(),
    },
    {
      label: "Delete",
      icon: <TrashIcon size={14} />,
      onClick: () => void deleteEvent(),
      danger: true,
    },
  ];

  const dateLabel = new Date(event.start_at).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  async function saveTimes(startIso: string, endIso: string): Promise<void> {
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) return;
    await upsertEvent({ ...event!, start_at: startIso, end_at: endIso });
    await refresh();
  }

  const description =
    event.description?.trim() ||
    autoDescription(event, cls);

  const recurrenceLabel = recurrenceToLabel(event.recurrence_json);

  return (
    <aside
      className="right-panel calendar-rail right-panel--calendar-swap"
      aria-label="Event details"
    >
      <header className="event-rail-head">
        <button
          type="button"
          className="event-rail-back"
          aria-label="Close event"
          onClick={close}
        >
          <ArrowLeftIcon size={16} />
        </button>
        <span className="event-rail-spacer" />
        <MoreMenu items={moreItems} label="Event actions" />
      </header>

      <div className="event-rail-title">
        <span className={`event-rail-icon tone-${tone}`} aria-hidden>
          {iconForEvent(event, 22)}
        </span>
        <div className="event-rail-title-text">
          <h2>{event.title}</h2>
          <span className="event-rail-subtitle">
            {cls ? cls.name : labelForType(event.type)}
          </span>
        </div>
      </div>

      <div className="event-rail-chips">
        <span className={`rail-chip rail-chip-${tone}`}>{labelForType(event.type)}</span>
        {tags.map((t) => (
          <span key={t} className={`rail-chip rail-chip-${chipTone(t)}`}>
            {t}
          </span>
        ))}
        {event.source_type === "ai_generated" && (
          <span className="rail-chip rail-chip-lilac">AI Plan</span>
        )}
        {recurrenceLabel && (
          <span className="rail-chip rail-chip-sky">{recurrenceLabel}</span>
        )}
      </div>

      <div className="event-rail-meta">
        <MetaRow icon={<CalendarIcon size={14} />} label={dateLabel} />
        <EditableTimeRow
          startIso={event.start_at}
          endIso={event.end_at}
          allDay={!!event.all_day}
          onSave={(s, e) => void saveTimes(s, e)}
        />
        {event.location && (
          <MetaRow icon={<PinIcon size={14} />} label={event.location} />
        )}
        {event.reminder_at && (
          <MetaRow
            icon={<BellIcon size={14} />}
            label={`Reminder ${fmtTime(event.reminder_at)}`}
          />
        )}
        {recurrenceLabel && !event.location && !event.reminder_at && (
          <MetaRow icon={<RepeatIcon size={14} />} label={recurrenceLabel} />
        )}
      </div>

      <section className="event-rail-block">
        <header className="event-rail-block-head">Description</header>
        <p className="event-rail-description">{description}</p>
      </section>

      <section className="event-rail-block">
        <header className="event-rail-block-head">Tasks &amp; Reminders</header>
        <div className="event-rail-checklist">
          {checklist.length === 0 && (
            <p className="event-rail-empty">No tasks yet — add one below.</p>
          )}
          {checklist.map((it) => (
            <div key={it.id} className={`event-rail-task${it.completed ? " done" : ""}`}>
              <button
                type="button"
                className={`event-rail-check${it.completed ? " done" : ""}`}
                aria-label={it.completed ? "Mark incomplete" : "Mark complete"}
                onClick={() => void toggleItem(it.id)}
              >
                {it.completed ? <CheckIcon size={12} /> : null}
              </button>
              <span className="event-rail-task-label">{it.label}</span>
              <button
                type="button"
                className="event-rail-task-remove"
                aria-label="Remove task"
                onClick={() => void removeItem(it.id)}
              >
                <XIcon size={12} />
              </button>
            </div>
          ))}
          <div className="event-rail-add">
            <input
              className="field"
              placeholder="Add a task or reminder…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addItem();
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void addItem()}
              disabled={!newItem.trim()}
            >
              Add
            </button>
          </div>
        </div>
      </section>

      <section className="event-rail-block">
        <header className="event-rail-block-head">Related</header>
        <div className="event-rail-related">
          {note && (
            <RelatedRow
              icon={<NoteIcon size={14} />}
              label={note.title}
              tone="sage"
              onClick={() => setView({ kind: "note", noteId: note.id })}
            />
          )}
          {deck && (
            <RelatedRow
              icon={<FlashcardIcon size={14} />}
              label={deck.title}
              tone="sky"
              onClick={() => setView({ kind: "flashcardSet", setId: deck.id })}
            />
          )}
          {quiz && (
            <RelatedRow
              icon={<QuizIcon size={14} />}
              label={quiz.title}
              tone="lilac"
              onClick={() => setView({ kind: "quiz", quizId: quiz.id })}
            />
          )}
          {cls && (
            <RelatedRow
              icon={<LinkIcon size={14} />}
              label={cls.name}
              tone="peach"
              onClick={() => setView({ kind: "classView", classId: cls.id })}
            />
          )}
          {!note && !deck && !quiz && !cls && (
            <p className="event-rail-empty">Link this event to a note, deck, quiz, or class from Edit.</p>
          )}
        </div>
      </section>

      <footer className={`event-rail-sync sync-${syncStatus}`}>
        <span className="event-rail-sync-icon" aria-hidden>
          {syncStatus === "offline" ? (
            <CloudOffIcon size={14} />
          ) : (
            <CloudCheckIcon size={14} />
          )}
        </span>
        <div className="event-rail-sync-text">
          <span className="lead">
            {syncStatus === "offline" ? "Working offline" : "All changes synced"}
          </span>
          <span className="sub">
            {syncStatus === "syncing"
              ? "Syncing…"
              : syncStatus === "offline"
              ? "We'll sync when you're back online"
              : "Last synced just now"}
          </span>
        </div>
      </footer>
    </aside>
  );
};

const MetaRow: FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="event-rail-meta-row">
    <span className="event-rail-meta-icon" aria-hidden>
      {icon}
    </span>
    <span>{label}</span>
  </div>
);

/**
 * Click-to-edit time row. Renders the formatted range until the user
 * clicks it; then exposes two `<input type="time" step="300">` so the
 * user can type new times in 5-minute increments. Commits on blur or
 * Enter; reverts on Escape.
 */
const EditableTimeRow: FC<{
  startIso: string;
  endIso: string;
  allDay: boolean;
  onSave: (startIso: string, endIso: string) => void;
}> = ({ startIso, endIso, allDay, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(() => hhmmFromIso(startIso));
  const [end, setEnd] = useState(() => hhmmFromIso(endIso));

  // Keep local input state in sync if the underlying event changes from
  // a different surface (e.g. the user drags the card on the grid).
  useEffect(() => {
    setStart(hhmmFromIso(startIso));
    setEnd(hhmmFromIso(endIso));
  }, [startIso, endIso]);

  if (allDay) {
    return <MetaRow icon={<ClockIcon size={14} />} label="All day" />;
  }

  function commit(): void {
    setEditing(false);
    const startTime = snapHHMM(start);
    const endTime = snapHHMM(end);
    const baseStart = new Date(startIso);
    const baseEnd = new Date(endIso);
    const newStart = setHHMM(baseStart, startTime);
    const newEnd = setHHMM(baseEnd, endTime);
    if (newStart.toISOString() === startIso && newEnd.toISOString() === endIso) {
      return;
    }
    onSave(newStart.toISOString(), newEnd.toISOString());
  }

  function cancel(): void {
    setEditing(false);
    setStart(hhmmFromIso(startIso));
    setEnd(hhmmFromIso(endIso));
  }

  if (!editing) {
    const label = `${fmtTime(startIso)} – ${fmtTime(endIso)}`;
    return (
      <button
        type="button"
        className="event-rail-meta-row event-rail-time-trigger"
        onClick={() => setEditing(true)}
        aria-label={`Edit time, currently ${label}`}
      >
        <span className="event-rail-meta-icon" aria-hidden>
          <ClockIcon size={14} />
        </span>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="event-rail-meta-row event-rail-time-edit">
      <span className="event-rail-meta-icon" aria-hidden>
        <ClockIcon size={14} />
      </span>
      <input
        type="time"
        step={300}
        className="field event-rail-time-input"
        value={start}
        autoFocus
        onChange={(e) => setStart(e.target.value)}
        onBlur={(e) => {
          const next = e.relatedTarget as HTMLElement | null;
          if (!next?.closest(".event-rail-time-edit")) commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
      />
      <span className="event-rail-time-sep">–</span>
      <input
        type="time"
        step={300}
        className="field event-rail-time-input"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        onBlur={(e) => {
          const next = e.relatedTarget as HTMLElement | null;
          if (!next?.closest(".event-rail-time-edit")) commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
      />
    </div>
  );
};

function hhmmFromIso(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function setHHMM(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  const d = new Date(base);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function snapHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const snapped = Math.round(m! / 5) * 5;
  const carry = snapped >= 60 ? 1 : 0;
  const mm = snapped % 60;
  const hh = (h! + carry) % 24;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const RelatedRow: FC<{
  icon: React.ReactNode;
  label: string;
  tone: "sage" | "sky" | "lilac" | "peach";
  onClick: () => void;
}> = ({ icon, label, tone, onClick }) => (
  <button type="button" className={`event-rail-related-row tone-${tone}`} onClick={onClick}>
    <span className="event-rail-related-icon">{icon}</span>
    <span className="event-rail-related-label">{label}</span>
  </button>
);

function chipTone(tag: string): "sage" | "sky" | "lilac" | "amber" | "peach" | "rose" {
  const lc = tag.toLowerCase();
  if (lc.includes("important") || lc.includes("exam") || lc.includes("urgent")) return "rose";
  if (lc.includes("weekly") || lc.includes("recurring")) return "sky";
  if (lc.includes("review") || lc.includes("study")) return "lilac";
  if (lc.includes("reading")) return "amber";
  if (lc.includes("class") || lc.includes("lecture")) return "peach";
  return "sage";
}

function autoDescription(
  event: Pick<CalendarEventRow, "type" | "title">,
  cls: ClassRow | null,
): string {
  const subject = cls ? cls.name : "your studies";
  switch (event.type) {
    case "exam":
      return `Stay calm and bring everything you need. Review key concepts for ${subject} ahead of time.`;
    case "study_block":
      return `Use this block to make focused progress on ${subject}.`;
    case "quiz":
      return `Take this quiz to reinforce what you've learned in ${subject}.`;
    case "flashcards":
      return `A quick deck pass to lock in vocabulary and key facts.`;
    case "reading":
      return `Quiet reading time — bring your highlighter and take light notes.`;
    case "assignment":
      return `Make consistent progress on this assignment so it doesn't pile up.`;
    case "reminder":
      return `Don't forget — gentle nudge so this doesn't slip.`;
    case "class":
    default:
      return `Class session for ${subject}. Bring your notes and lab materials.`;
  }
}

function recurrenceToLabel(json: string | null): string | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as { freq?: string };
    if (v.freq === "weekly") return "Weekly";
    if (v.freq === "daily") return "Daily";
    if (v.freq === "monthly") return "Monthly";
  } catch {
    /* drop */
  }
  return null;
}
