import { jsx as _jsx } from "react/jsx-runtime";
import { AtomIcon, BeakerIcon, BookIcon, ClassIcon, FlashcardIcon, GlobeIcon, MaskIcon, NoteIcon, PencilIcon, QuizIcon, SparklesIcon, } from "../components/icons.js";
/**
 * Ordered list so a future picker has a stable presentation. The first
 * entry is the default and what `default-icon if someone doesn't select
 * one` resolves to.
 */
export const NOTE_ICON_LIST = [
    { key: "note", label: "Note", Icon: NoteIcon },
    { key: "biology", label: "Biology", Icon: BeakerIcon },
    { key: "chemistry", label: "Chemistry", Icon: BeakerIcon },
    { key: "history", label: "History", Icon: GlobeIcon },
    { key: "physics", label: "Physics", Icon: AtomIcon },
    { key: "literature", label: "Literature", Icon: MaskIcon },
    { key: "book", label: "Book", Icon: BookIcon },
    { key: "class", label: "Class", Icon: ClassIcon },
    { key: "flashcards", label: "Flashcards", Icon: FlashcardIcon },
    { key: "quiz", label: "Quiz", Icon: QuizIcon },
    { key: "sparkles", label: "Idea", Icon: SparklesIcon },
    { key: "pencil", label: "Draft", Icon: PencilIcon },
];
const NOTE_ICON_MAP = Object.fromEntries(NOTE_ICON_LIST.map((m) => [m.key, m.Icon]));
export const DEFAULT_NOTE_ICON = "note";
export function getNoteIconComponent(key) {
    if (key && NOTE_ICON_MAP[key])
        return NOTE_ICON_MAP[key];
    return NOTE_ICON_MAP[DEFAULT_NOTE_ICON];
}
export const NoteGlyph = ({ icon, size = 16 }) => {
    const Icon = getNoteIconComponent(icon);
    return _jsx(Icon, { size: size });
};
//# sourceMappingURL=noteIcons.js.map