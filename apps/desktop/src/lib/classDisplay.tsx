/**
 * Shared visual helpers for anywhere a class is rendered (hero icon /
 * accent tone / friendly subtitle). Lives here so the Classes index,
 * Class detail view, and Ask AI screen all derive identical visuals.
 */
import type { ReactNode } from "react";
import type { ClassRow } from "@studynest/shared";
import {
  AtomIcon,
  BeakerIcon,
  BookIcon,
  ClassIcon,
  GlobeIcon,
  LeafIcon,
  PencilIcon,
  PillarIcon,
} from "../components/icons.js";

export type AccentTone = "sage" | "sky" | "lilac" | "amber" | "peach";

const ALL_TONES: AccentTone[] = ["sage", "sky", "lilac", "amber", "peach"];

/** Map a class's stored colour (or fall back to a stable hash) to a tone. */
export function toneFor(cls: ClassRow): AccentTone {
  const color = (cls.color ?? "").toLowerCase();
  if (color.includes("sage") || color.includes("green")) return "sage";
  if (color.includes("sky") || color.includes("blue")) return "sky";
  if (color.includes("lilac") || color.includes("purple") || color.includes("violet"))
    return "lilac";
  if (color.includes("amber") || color.includes("yellow") || color.includes("gold"))
    return "amber";
  if (color.includes("peach") || color.includes("rose") || color.includes("orange"))
    return "peach";
  let h = 0;
  for (let i = 0; i < cls.id.length; i++) h = (h * 31 + cls.id.charCodeAt(i)) >>> 0;
  return ALL_TONES[h % ALL_TONES.length] ?? "sky";
}

/** Pick a subject-aware glyph based on the class name. */
export function iconFor(cls: ClassRow, size = 20): ReactNode {
  const n = cls.name.toLowerCase();
  if (/(bio|cell|genetic|anatom)/.test(n)) return <LeafIcon size={size} />;
  if (/(chem|lab|reaction)/.test(n)) return <BeakerIcon size={size} />;
  if (/(history|civics|world|europe)/.test(n)) return <PillarIcon size={size} />;
  if (/(physics|mechanic|astro)/.test(n)) return <AtomIcon size={size} />;
  if (/(english|writing|literature|comp)/.test(n)) return <PencilIcon size={size} />;
  if (/(geo|earth|map)/.test(n)) return <GlobeIcon size={size} />;
  if (/(book|reading)/.test(n)) return <BookIcon size={size} />;
  return <ClassIcon size={size} />;
}

/** Subtitle is derived from `code` when present (matches our seed convention). */
export function deriveSubtitle(cls: ClassRow): string | null {
  if (!cls.code || !cls.code.trim()) return null;
  return cls.code.trim();
}

/**
 * 0-100 progress from completed/total tasks; falls back to a coarse
 * "study tools coverage" heuristic when no plan exists yet.
 */
export function computeProgress(agg: {
  notes: number;
  flashcards: number;
  quizzes: number;
  totalTasks: number;
  completedTasks: number;
}): number {
  if (agg.totalTasks > 0) {
    return Math.round((agg.completedTasks / agg.totalTasks) * 100);
  }
  const score =
    (agg.notes > 0 ? 30 : 0) +
    (agg.flashcards > 0 ? 30 : 0) +
    (agg.quizzes > 0 ? 30 : 0);
  return Math.min(score, 90);
}

export function progressLabel(
  progress: number,
  agg: { totalTasks: number; notes: number },
): string {
  if (agg.totalTasks === 0 && agg.notes === 0) return "Just Starting";
  if (progress >= 60) return "On Track";
  if (progress >= 30) return "Catching Up";
  return "Behind";
}

export function progressTone(
  progress: number,
  agg: { totalTasks: number },
): "success" | "warning" {
  return progress >= 60 || agg.totalTasks === 0 ? "success" : "warning";
}

/** "May 6", "Today", "Yesterday", or weekday for last-week ISO timestamps. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round(
    (today.getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days >= 2 && days < 7)
    return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
