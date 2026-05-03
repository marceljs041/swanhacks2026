/**
 * Per-note icon registry. The `icon` column on `notes` stores one of
 * these keys; the editor picker (added later) writes them. The notes
 * list reads them through `<NoteGlyph icon={…} />` which falls back to
 * the default `note` glyph when the key is unknown so we never blank
 * out a row because of bad data.
 */
import type { FC } from "react";
import {
  AtomIcon,
  BeakerIcon,
  BookIcon,
  ClassIcon,
  FlashcardIcon,
  GlobeIcon,
  MaskIcon,
  NoteIcon,
  PencilIcon,
  QuizIcon,
  SparklesIcon,
} from "../components/icons.js";

export interface NoteIconMeta {
  key: string;
  label: string;
  Icon: FC<{ size?: number }>;
}

/**
 * Ordered list so a future picker has a stable presentation. The first
 * entry is the default and what `default-icon if someone doesn't select
 * one` resolves to.
 */
export const NOTE_ICON_LIST: NoteIconMeta[] = [
  { key: "note",       label: "Note",       Icon: NoteIcon },
  { key: "biology",    label: "Biology",    Icon: BeakerIcon },
  { key: "chemistry",  label: "Chemistry",  Icon: BeakerIcon },
  { key: "history",    label: "History",    Icon: GlobeIcon },
  { key: "physics",    label: "Physics",    Icon: AtomIcon },
  { key: "literature", label: "Literature", Icon: MaskIcon },
  { key: "book",       label: "Book",       Icon: BookIcon },
  { key: "class",      label: "Class",      Icon: ClassIcon },
  { key: "flashcards", label: "Flashcards", Icon: FlashcardIcon },
  { key: "quiz",       label: "Quiz",       Icon: QuizIcon },
  { key: "sparkles",   label: "Idea",       Icon: SparklesIcon },
  { key: "pencil",     label: "Draft",      Icon: PencilIcon },
];

const NOTE_ICON_MAP: Record<string, FC<{ size?: number }>> = Object.fromEntries(
  NOTE_ICON_LIST.map((m) => [m.key, m.Icon]),
);

export const DEFAULT_NOTE_ICON = "note";

export function getNoteIconComponent(key: string | null | undefined): FC<{ size?: number }> {
  if (key && NOTE_ICON_MAP[key]) return NOTE_ICON_MAP[key]!;
  return NOTE_ICON_MAP[DEFAULT_NOTE_ICON]!;
}

interface GlyphProps {
  icon: string | null | undefined;
  size?: number;
}

export const NoteGlyph: FC<GlyphProps> = ({ icon, size = 16 }) => {
  const Icon = getNoteIconComponent(icon);
  return <Icon size={size} />;
};
