import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { listClasses } from "../db/repositories.js";
import { useApp } from "../store.js";
import { BRAND_LOGO_URL } from "../lib/brand.js";
import { CalendarIcon, ClassIcon, FlashcardIcon, HomeIcon, NoteIcon, QuizIcon, SettingsIcon, } from "./icons.js";
/**
 * Primary destinations shown at the top of the sidebar. Settings is rendered
 * separately, pinned to the bottom of the rail.
 */
const NAV = [
    { key: "home", label: "Home", icon: _jsx(HomeIcon, {}), view: { kind: "home" } },
    { key: "notes", label: "Notes", icon: _jsx(NoteIcon, {}), view: { kind: "notes" } },
    { key: "classes", label: "Classes", icon: _jsx(ClassIcon, {}), view: { kind: "classes" } },
    { key: "flashcards", label: "Flashcards", icon: _jsx(FlashcardIcon, {}), view: { kind: "flashcards" } },
    { key: "quizzes", label: "Quizzes", icon: _jsx(QuizIcon, {}), view: { kind: "quizzes" } },
    { key: "calendar", label: "Calendar", icon: _jsx(CalendarIcon, {}), view: { kind: "calendar" } },
];
const SETTINGS_ITEM = {
    key: "settings",
    label: "Settings",
    icon: _jsx(SettingsIcon, {}),
    view: { kind: "settings" },
};
/** A sub-view counts as "active" if it belongs to the same top-level destination. */
function isActive(viewKind, itemKey) {
    if (viewKind === itemKey)
        return true;
    if (itemKey === "notes" && (viewKind === "note" || viewKind === "allNotes"))
        return true;
    if (itemKey === "flashcards" && viewKind === "flashcardSet")
        return true;
    if (itemKey === "quizzes" && viewKind === "quiz")
        return true;
    return false;
}
export const Sidebar = () => {
    const view = useApp((s) => s.view);
    const setView = useApp((s) => s.setView);
    const setClasses = useApp((s) => s.setClasses);
    useEffect(() => {
        void listClasses().then(setClasses);
    }, [setClasses]);
    return (_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { className: "sidebar-brand", children: [_jsx("img", { className: "sidebar-brand-logo", src: BRAND_LOGO_URL, alt: "", width: 32, height: 32, decoding: "async" }), _jsx("span", { className: "brand-name", children: "Note Goat" })] }), _jsx("nav", { className: "sidebar-nav", children: NAV.map((it) => (_jsxs("button", { type: "button", className: `nav-item ${isActive(view.kind, it.key) ? "active" : ""}`, onClick: () => setView(it.view), children: [_jsx("span", { className: "nav-icon", children: it.icon }), _jsx("span", { children: it.label })] }, it.key))) }), _jsx("div", { className: "sidebar-spacer" }), _jsx("nav", { className: "sidebar-nav sidebar-nav-bottom", children: _jsxs("button", { type: "button", className: `nav-item ${isActive(view.kind, SETTINGS_ITEM.key) ? "active" : ""}`, onClick: () => setView(SETTINGS_ITEM.view), children: [_jsx("span", { className: "nav-icon", children: SETTINGS_ITEM.icon }), _jsx("span", { children: SETTINGS_ITEM.label })] }, SETTINGS_ITEM.key) })] }));
};
//# sourceMappingURL=Sidebar.js.map