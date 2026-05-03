/**
 * Color/icon resolution for `CalendarEventRow` cards.
 *
 * Every event maps to an `EventTone` (sage / sky / lilac / amber /
 * peach / rose) — a pure visual concept that the styles.css cal-event
 * blocks turn into theme-token CSS variables. We never hardcode hex
 * here: callers either set `data-tone="…"` or read the tone via JS to
 * apply existing class chips.
 *
 * Resolution order:
 *   1. Explicit `event.color` (set during AI plan generation or by the
 *      Add/Edit drawer). Recognized values match `Palette` accent
 *      names ("accentSage", "accentSky", …) for forward-compat.
 *   2. Linked class color — keeps biology events green, chemistry
 *      blue, etc.
 *   3. Class-name heuristic.
 *   4. Type-based default — exam → rose, study_block → lilac, etc.
 */
import type { ReactNode } from "react";
import type {
  CalendarEventRow,
  CalendarEventType,
  ClassRow,
} from "@studynest/shared";
import {
  BookIcon,
  ClassIcon,
  FlashcardIcon,
  PencilIcon,
  QuizIcon,
  SparklesIcon,
  TargetIcon,
  TrophyIcon,
  BellIcon,
} from "../icons.js";

export type EventTone = "sage" | "sky" | "lilac" | "amber" | "peach" | "rose";

const COLOR_TO_TONE: Record<string, EventTone> = {
  accentSage: "sage",
  accentSky: "sky",
  accentLilac: "lilac",
  accentAmber: "amber",
  accentPeach: "peach",
  accentRose: "rose",
  green: "sage",
  blue: "sky",
  purple: "lilac",
  lilac: "lilac",
  yellow: "amber",
  amber: "amber",
  orange: "peach",
  peach: "peach",
  red: "rose",
  rose: "rose",
};

const TYPE_TO_TONE: Record<CalendarEventType, EventTone> = {
  class: "sky",
  exam: "rose",
  study_block: "lilac",
  quiz: "sky",
  flashcards: "sage",
  assignment: "peach",
  reading: "amber",
  reminder: "lilac",
  custom: "sage",
};

export function toneForEvent(
  event: Pick<CalendarEventRow, "color" | "type" | "class_id">,
  cls?: ClassRow | null,
): EventTone {
  if (event.color) {
    const exact = COLOR_TO_TONE[event.color];
    if (exact) return exact;
    const lc = event.color.toLowerCase();
    for (const [k, v] of Object.entries(COLOR_TO_TONE)) {
      if (lc.includes(k.toLowerCase())) return v;
    }
  }
  if (cls?.color) {
    const lc = cls.color.toLowerCase();
    for (const [k, v] of Object.entries(COLOR_TO_TONE)) {
      if (lc.includes(k.toLowerCase())) return v;
    }
  }
  if (cls?.name) {
    const n = cls.name.toLowerCase();
    if (/(bio|cell|genetic|anatom)/.test(n)) return "sage";
    if (/(chem|lab|reaction)/.test(n)) return "sky";
    if (/(history|civics|world|europe)/.test(n)) return "rose";
    if (/(physics|mechanic|astro)/.test(n)) return "amber";
    if (/(english|writing|literature|comp)/.test(n)) return "lilac";
  }
  return TYPE_TO_TONE[event.type];
}

export function iconForEvent(
  event: Pick<CalendarEventRow, "type" | "source_type">,
  size = 14,
): ReactNode {
  if (event.source_type === "ai_generated") return <SparklesIcon size={size} />;
  switch (event.type) {
    case "class":
      return <ClassIcon size={size} />;
    case "exam":
      return <TrophyIcon size={size} />;
    case "study_block":
      return <TargetIcon size={size} />;
    case "quiz":
      return <QuizIcon size={size} />;
    case "flashcards":
      return <FlashcardIcon size={size} />;
    case "assignment":
      return <PencilIcon size={size} />;
    case "reading":
      return <BookIcon size={size} />;
    case "reminder":
      return <BellIcon size={size} />;
    default:
      return <TargetIcon size={size} />;
  }
}

const TYPE_LABELS: Record<CalendarEventType, string> = {
  class: "Class",
  exam: "Exam",
  study_block: "Study Block",
  quiz: "Quiz",
  flashcards: "Flashcards",
  assignment: "Assignment",
  reading: "Reading",
  reminder: "Reminder",
  custom: "Custom",
};

export function labelForType(t: CalendarEventType): string {
  return TYPE_LABELS[t];
}

/* ---------------- Date helpers ---------------- */

export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  // Anchor weeks on Monday (matches the reference image and most
  // study-planner conventions in non-US locales).
  const dow = out.getDay();
  const offset = (dow + 6) % 7;
  out.setDate(out.getDate() - offset);
  return out;
}

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function startOfMonth(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), 1);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromIsoDate(iso: string): Date {
  const [y, m, dd] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y!, (m ?? 1) - 1, dd ?? 1);
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtTimeRange(startIso: string, endIso: string, allDay = false): string {
  if (allDay) return "All day";
  return `${fmtTime(startIso)} – ${fmtTime(endIso)}`;
}

export function fmtRangeLabel(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const sFmt: Intl.DateTimeFormatOptions = sameMonth
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric" };
  const eFmt: Intl.DateTimeFormatOptions = sameMonth
    ? { day: "numeric", year: "numeric" }
    : sameYear
    ? { month: "short", day: "numeric", year: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString(undefined, sFmt)} – ${end.toLocaleDateString(undefined, eFmt)}`;
}
