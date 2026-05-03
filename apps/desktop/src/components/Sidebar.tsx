import type { FC, ReactNode } from "react";
import { useEffect } from "react";
import { listClasses } from "../db/repositories.js";
import { useApp, type View } from "../store.js";
import { BRAND_LOGO_URL } from "../lib/brand.js";
import {
  CalendarIcon,
  ClassIcon,
  FlashcardIcon,
  HomeIcon,
  NoteIcon,
  QuizIcon,
  SettingsIcon,
} from "./icons.js";

interface NavItem {
  key: View["kind"];
  label: string;
  icon: ReactNode;
  view: View;
}

/**
 * Primary destinations shown at the top of the sidebar. Settings is rendered
 * separately, pinned to the bottom of the rail.
 */
const NAV: NavItem[] = [
  { key: "home",       label: "Home",       icon: <HomeIcon />,      view: { kind: "home" } },
  { key: "notes",      label: "Notes",      icon: <NoteIcon />,      view: { kind: "notes" } },
  { key: "classes",    label: "Classes",    icon: <ClassIcon />,     view: { kind: "classes" } },
  { key: "flashcards", label: "Flashcards", icon: <FlashcardIcon />, view: { kind: "flashcards" } },
  { key: "quizzes",    label: "Quizzes",    icon: <QuizIcon />,      view: { kind: "quizzes" } },
  { key: "calendar",   label: "Calendar",   icon: <CalendarIcon />,  view: { kind: "calendar" } },
];

const SETTINGS_ITEM: NavItem = {
  key: "settings",
  label: "Settings",
  icon: <SettingsIcon />,
  view: { kind: "settings" },
};

/** A sub-view counts as "active" if it belongs to the same top-level destination. */
function isActive(viewKind: View["kind"], itemKey: View["kind"]): boolean {
  if (viewKind === itemKey) return true;
  if (itemKey === "notes" && (viewKind === "note" || viewKind === "allNotes")) return true;
  if (itemKey === "flashcards" && viewKind === "flashcardSet") return true;
  if (itemKey === "quizzes" && viewKind === "quiz") return true;
  return false;
}

export const Sidebar: FC = () => {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const setClasses = useApp((s) => s.setClasses);

  useEffect(() => {
    void listClasses().then(setClasses);
  }, [setClasses]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img
          className="sidebar-brand-logo"
          src={BRAND_LOGO_URL}
          alt=""
          width={32}
          height={32}
          decoding="async"
        />
        <span className="brand-name">Note Goat</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`nav-item ${isActive(view.kind, it.key) ? "active" : ""}`}
            onClick={() => setView(it.view)}
          >
            <span className="nav-icon">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <nav className="sidebar-nav sidebar-nav-bottom">
        <button
          key={SETTINGS_ITEM.key}
          type="button"
          className={`nav-item ${isActive(view.kind, SETTINGS_ITEM.key) ? "active" : ""}`}
          onClick={() => setView(SETTINGS_ITEM.view)}
        >
          <span className="nav-icon">{SETTINGS_ITEM.icon}</span>
          <span>{SETTINGS_ITEM.label}</span>
        </button>
      </nav>
    </aside>
  );
};
