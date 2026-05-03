import { jsx as _jsx } from "react/jsx-runtime";
import { BookIcon, ClassIcon, FlashcardIcon, PencilIcon, QuizIcon, SparklesIcon, TargetIcon, TrophyIcon, BellIcon, } from "../icons.js";
const COLOR_TO_TONE = {
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
const TYPE_TO_TONE = {
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
export function toneForEvent(event, cls) {
    if (event.color) {
        const exact = COLOR_TO_TONE[event.color];
        if (exact)
            return exact;
        const lc = event.color.toLowerCase();
        for (const [k, v] of Object.entries(COLOR_TO_TONE)) {
            if (lc.includes(k.toLowerCase()))
                return v;
        }
    }
    if (cls?.color) {
        const lc = cls.color.toLowerCase();
        for (const [k, v] of Object.entries(COLOR_TO_TONE)) {
            if (lc.includes(k.toLowerCase()))
                return v;
        }
    }
    if (cls?.name) {
        const n = cls.name.toLowerCase();
        if (/(bio|cell|genetic|anatom)/.test(n))
            return "sage";
        if (/(chem|lab|reaction)/.test(n))
            return "sky";
        if (/(history|civics|world|europe)/.test(n))
            return "rose";
        if (/(physics|mechanic|astro)/.test(n))
            return "amber";
        if (/(english|writing|literature|comp)/.test(n))
            return "lilac";
    }
    return TYPE_TO_TONE[event.type];
}
export function iconForEvent(event, size = 14) {
    if (event.source_type === "ai_generated")
        return _jsx(SparklesIcon, { size: size });
    switch (event.type) {
        case "class":
            return _jsx(ClassIcon, { size: size });
        case "exam":
            return _jsx(TrophyIcon, { size: size });
        case "study_block":
            return _jsx(TargetIcon, { size: size });
        case "quiz":
            return _jsx(QuizIcon, { size: size });
        case "flashcards":
            return _jsx(FlashcardIcon, { size: size });
        case "assignment":
            return _jsx(PencilIcon, { size: size });
        case "reading":
            return _jsx(BookIcon, { size: size });
        case "reminder":
            return _jsx(BellIcon, { size: size });
        default:
            return _jsx(TargetIcon, { size: size });
    }
}
const TYPE_LABELS = {
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
export function labelForType(t) {
    return TYPE_LABELS[t];
}
/* ---------------- Date helpers ---------------- */
export function startOfWeek(d) {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    // Anchor weeks on Monday (matches the reference image and most
    // study-planner conventions in non-US locales).
    const dow = out.getDay();
    const offset = (dow + 6) % 7;
    out.setDate(out.getDate() - offset);
    return out;
}
export function startOfDay(d) {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
}
export function startOfMonth(d) {
    const out = new Date(d.getFullYear(), d.getMonth(), 1);
    out.setHours(0, 0, 0, 0);
    return out;
}
export function isoDate(d) {
    return d.toISOString().slice(0, 10);
}
export function fromIsoDate(iso) {
    const [y, m, dd] = iso.split("-").map((s) => parseInt(s, 10));
    return new Date(y, (m ?? 1) - 1, dd ?? 1);
}
export function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}
export function fmtTimeRange(startIso, endIso, allDay = false) {
    if (allDay)
        return "All day";
    return `${fmtTime(startIso)} – ${fmtTime(endIso)}`;
}
export function fmtRangeLabel(start, end) {
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    const sFmt = sameMonth
        ? { month: "short", day: "numeric" }
        : { month: "short", day: "numeric" };
    const eFmt = sameMonth
        ? { day: "numeric", year: "numeric" }
        : sameYear
            ? { month: "short", day: "numeric", year: "numeric" }
            : { month: "short", day: "numeric", year: "numeric" };
    return `${start.toLocaleDateString(undefined, sFmt)} – ${end.toLocaleDateString(undefined, eFmt)}`;
}
//# sourceMappingURL=eventVisuals.js.map