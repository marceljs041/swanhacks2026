import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { getCloudSyncMeta, listClasses, reenqueueAllLocalRows, resetOutboxErrors, } from "../db/repositories.js";
import { describeAgo } from "../lib/relativeTime.js";
import { requestDesktopSync } from "../sync/controller.js";
import { useApp } from "../store.js";
import { BRAND_LOGO_URL } from "../lib/brand.js";
import { CalendarIcon, ClassIcon, FlashcardIcon, GlobeIcon, HomeIcon, NoteIcon, QuizIcon, SettingsIcon, TrophyIcon, } from "./icons.js";
/**
 * Primary destinations shown at the top of the sidebar. Settings is rendered
 * separately, pinned to the bottom of the rail.
 */
const NAV = [
    { key: "home", label: "Home", icon: _jsx(HomeIcon, {}), view: { kind: "home" } },
    { key: "notes", label: "Notes", icon: _jsx(NoteIcon, {}), view: { kind: "notes" } },
    { key: "points", label: "Rewards", icon: _jsx(TrophyIcon, {}), view: { kind: "points" } },
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
    const syncStatus = useApp((s) => s.syncStatus);
    const [syncMeta, setSyncMeta] = useState({
        lastPulledAt: null,
        lastPushedAt: null,
        lastActivityAt: null,
        pendingOutbox: 0,
        lastOutboxError: null,
    });
    /** Bumps every minute so relative “ago” text stays accurate without polling SQLite. */
    const [relativeTick, setRelativeTick] = useState(0);
    const refreshLastSynced = useCallback(async () => {
        const m = await getCloudSyncMeta();
        setSyncMeta(m);
    }, []);
    useEffect(() => {
        void listClasses().then(setClasses);
    }, [setClasses]);
    useEffect(() => {
        void refreshLastSynced();
    }, [refreshLastSynced, syncStatus]);
    useEffect(() => {
        const t = window.setInterval(() => setRelativeTick((n) => n + 1), 60_000);
        return () => window.clearInterval(t);
    }, []);
    const syncing = syncStatus === "syncing" || syncStatus === "saving";
    const { lastActivityAt, pendingOutbox, lastOutboxError } = syncMeta;
    let subLine;
    if (syncing)
        subLine = "Syncing…";
    else if (pendingOutbox > 0) {
        const pend = pendingOutbox === 1
            ? "1 change stuck"
            : `${pendingOutbox} changes stuck`;
        subLine = lastActivityAt ? `${pend} · ${describeAgo(lastActivityAt)}` : pend;
    }
    else if (!lastActivityAt)
        subLine = "Not yet";
    else
        subLine = describeAgo(lastActivityAt);
    const errorTooltip = pendingOutbox > 0 && lastOutboxError
        ? ` Last error on ${lastOutboxError.entity_type}: ${lastOutboxError.reason}.`
        : "";
    return (_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { className: "sidebar-brand", children: [_jsx("img", { className: "sidebar-brand-logo", src: BRAND_LOGO_URL, alt: "", width: 32, height: 32, decoding: "async" }), _jsx("span", { className: "brand-name", children: "Note Goat" })] }), _jsx("nav", { className: "sidebar-nav", children: NAV.map((it) => (_jsxs("button", { type: "button", className: `nav-item ${isActive(view.kind, it.key) ? "active" : ""}`, onClick: () => setView(it.view), children: [_jsx("span", { className: "nav-icon", children: it.icon }), _jsx("span", { children: it.label })] }, it.key))) }), _jsx("div", { className: "sidebar-spacer" }), _jsxs("nav", { className: "sidebar-nav sidebar-nav-bottom", children: [_jsxs("button", { type: "button", className: "nav-item nav-item-sync", "data-sync-tick": relativeTick, onClick: () => {
                            void (async () => {
                                // IMPORTANT: snapshot meta BEFORE resetting errors, otherwise
                                // `lastOutboxError` is wiped by `resetOutboxErrors()` and we
                                // can't tell that the previous push had FK failures.
                                const SEED_FLAG = "studynest:outbox-backfilled-v1";
                                const lsAvailable = typeof localStorage !== "undefined";
                                const beforeMeta = await getCloudSyncMeta();
                                const neverBackfilled = lsAvailable && !localStorage.getItem(SEED_FLAG);
                                const hadOutboxError = beforeMeta.lastOutboxError !== null;
                                // Clear retry counters so previously stuck rows get a fresh
                                // attempt after schema fixes / connectivity changes.
                                await resetOutboxErrors();
                                // Reseed when:
                                //  - outbox is empty AND we've never backfilled on this device
                                //    (covers seeded data / pre-outbox writes that need to go
                                //    up); OR
                                //  - the previous push left errors (FK failures, schema drift,
                                //    etc.) — re-enqueueing all rows in FK order fixes those,
                                //    and the reseed prunes orphan children whose required FK
                                //    doesn't resolve locally so they stop blocking sync.
                                const shouldReseed = (beforeMeta.pendingOutbox === 0 && neverBackfilled) ||
                                    hadOutboxError;
                                if (shouldReseed) {
                                    const queued = await reenqueueAllLocalRows();
                                    console.log(`[sync] backfill reseed queued ${queued} rows ` +
                                        `(pending was ${beforeMeta.pendingOutbox}, ` +
                                        `hadError=${hadOutboxError})`);
                                    if (lsAvailable) {
                                        localStorage.setItem(SEED_FLAG, new Date().toISOString());
                                    }
                                }
                                await requestDesktopSync();
                                await refreshLastSynced();
                            })();
                        }, disabled: syncing, title: syncing
                            ? "Sync in progress"
                            : pendingOutbox > 0
                                ? `${pendingOutbox} change${pendingOutbox === 1 ? "" : "s"} waiting to upload.${errorTooltip}`
                                : lastActivityAt
                                    ? `Last cloud activity ${describeAgo(lastActivityAt)}.`
                                    : "No successful cloud sync yet.", "aria-label": syncing
                            ? "Sync in progress"
                            : pendingOutbox > 0
                                ? `Sync now. ${pendingOutbox} change${pendingOutbox === 1 ? "" : "s"} waiting to upload.${errorTooltip}`
                                : lastActivityAt
                                    ? `Sync now. Last cloud activity ${describeAgo(lastActivityAt)}.`
                                    : "Sync now. No successful cloud sync yet.", children: [_jsx("span", { className: "nav-icon", children: _jsx(GlobeIcon, {}) }), _jsxs("span", { className: "nav-sync-stack", children: [_jsx("span", { className: "nav-sync-line", children: "Cloud sync" }), _jsx("span", { className: "nav-sync-sub", children: subLine })] })] }), _jsxs("button", { type: "button", className: `nav-item ${isActive(view.kind, SETTINGS_ITEM.key) ? "active" : ""}`, onClick: () => setView(SETTINGS_ITEM.view), children: [_jsx("span", { className: "nav-icon", children: SETTINGS_ITEM.icon }), _jsx("span", { children: SETTINGS_ITEM.label })] }, SETTINGS_ITEM.key)] })] }));
};
//# sourceMappingURL=Sidebar.js.map