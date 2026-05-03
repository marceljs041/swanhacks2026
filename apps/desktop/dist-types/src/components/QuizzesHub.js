import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { quizSummaries, quizzesHubStats, recentWeakTopics, softDeleteQuiz, } from "../db/repositories.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { useApp } from "../store.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { HeroSearch } from "./HeroSearch.js";
import { RightPanel } from "./RightPanel.js";
import { QuizDetailRail } from "./QuizDetailRail.js";
import { QuizGenerationModal } from "./QuizGenerationModal.js";
import { BRAND_QUIZ_HERO_URL } from "../lib/brand.js";
import { getQuizGenerationQueueState, subscribeQuizGenerationQueue, } from "../lib/quizGenerationQueue.js";
import { ArrowRightIcon, CalendarIcon, GraphIcon, PlayIcon, PlusIcon, QuizIcon, RestartIcon, SparklesIcon, TargetIcon, WarningIcon, } from "./icons.js";
import { MoreMenu } from "./ui/MoreMenu.js";
const ZERO_STATS = {
    taken: 0,
    avgPct: 0,
    weakTopicCount: 0,
    dueToday: 0,
};
export const QuizzesHub = () => {
    const setView = useApp((s) => s.setView);
    const setSelectedQuiz = useApp((s) => s.setSelectedQuiz);
    const selectedQuizId = useApp((s) => s.selectedQuizId);
    const setQuizzesDetailPanelOpen = useApp((s) => s.setQuizzesDetailPanelOpen);
    const classes = useApp((s) => s.classes);
    const [stats, setStats] = useState(ZERO_STATS);
    const [summaries, setSummaries] = useState([]);
    const [weakTopics, setWeakTopics] = useState([]);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [generateOpen, setGenerateOpen] = useState(false);
    const [reload, setReload] = useState(0);
    const [queueState, setQueueState] = useState(getQuizGenerationQueueState());
    useEffect(() => {
        void (async () => {
            const [hub, list, weak] = await Promise.all([
                quizzesHubStats(),
                quizSummaries(),
                recentWeakTopics(8),
            ]);
            setStats(hub);
            setSummaries(list);
            setWeakTopics(weak);
            const prev = useApp.getState().selectedQuizId;
            if (prev && list.some((s) => s.quiz.id === prev))
                return;
            setSelectedQuiz(null);
        })();
    }, [reload, setSelectedQuiz]);
    useEffect(() => {
        setQuizzesDetailPanelOpen(!!selectedQuizId);
        return () => setQuizzesDetailPanelOpen(false);
    }, [selectedQuizId, setQuizzesDetailPanelOpen]);
    useEffect(() => subscribeQuizGenerationQueue(setQueueState), []);
    const selectQuizPreview = useCallback((id) => {
        withViewTransition(() => setSelectedQuiz(id));
    }, [setSelectedQuiz]);
    const filteredSummaries = useMemo(() => {
        const q = search.trim().toLowerCase();
        return summaries.filter((s) => {
            if (q) {
                const haystack = [
                    s.quiz.title,
                    s.noteTitle ?? "",
                    classes.find((c) => c.id === s.classId)?.name ?? "",
                    parseTags(s.quiz.tags_json).join(" "),
                ]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(q))
                    return false;
            }
            if (filter === "all")
                return true;
            if (filter === "completed")
                return s.status === "completed";
            if (filter === "in-progress")
                return s.status === "in_progress";
            if (filter === "needs-review")
                return s.needsReview;
            if (filter.startsWith("class:")) {
                return s.classId === filter.slice("class:".length);
            }
            return true;
        });
    }, [summaries, search, filter, classes]);
    function startQuiz(quizId) {
        setSelectedQuiz(quizId);
        setView({ kind: "quiz", quizId, mode: "take" });
    }
    function openResults(quizId) {
        setSelectedQuiz(quizId);
        setView({ kind: "quiz", quizId, mode: "results" });
    }
    function takeDue() {
        const target = summaries.find((s) => s.status !== "completed") ?? summaries[0];
        if (target)
            startQuiz(target.quiz.id);
    }
    function reviewWeak() {
        const target = summaries.find((s) => s.needsReview) ?? summaries.find((s) => s.attempts > 0);
        if (target) {
            setSelectedQuiz(target.quiz.id);
            setView({ kind: "quiz", quizId: target.quiz.id, mode: "review" });
        }
    }
    function practiceAgain() {
        const target = summaries
            .filter((s) => s.attempts > 0)
            .sort((a, b) => (a.lastAttemptAt ?? "").localeCompare(b.lastAttemptAt ?? ""))
            .pop();
        if (target)
            startQuiz(target.quiz.id);
    }
    return (_jsxs(_Fragment, { children: [_jsxs("main", { className: "main", children: [_jsx("div", { className: "main-inner", children: _jsxs("div", { className: "quizzes-center", children: [_jsxs("section", { className: "hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(HeroSearch, {}), _jsxs("div", { className: "hero-greeting", children: [_jsx("h1", { className: "hero-headline", children: "Quizzes" }), _jsx("p", { children: "Practice what you know, find weak spots, and get ready for exams." })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_QUIZ_HERO_URL, alt: "", decoding: "async" }) })] }), _jsxs("section", { className: "qz-stat-grid", children: [_jsx(QzStat, { icon: _jsx(QuizIcon, { size: 18 }), tone: "peach", value: stats.taken, label: "Quizzes Taken" }), _jsx(QzStat, { icon: _jsx(GraphIcon, { size: 18 }), tone: "sky", value: `${stats.avgPct}%`, label: "Average Score" }), _jsx(QzStat, { icon: _jsx(TargetIcon, { size: 18 }), tone: "sage", value: stats.weakTopicCount, label: stats.weakTopicCount === 1 ? "Weak Topic" : "Weak Topics" }), _jsx(QzStat, { icon: _jsx(CalendarIcon, { size: 18 }), tone: "lilac", value: stats.dueToday, label: stats.dueToday === 1 ? "Exam Soon" : "Exams Soon" })] }), _jsx("div", { className: "search-wrap qz-deck-filter", children: _jsxs("label", { className: "search", children: [_jsx("span", { className: "search-icon", children: _jsx(SearchInline, {}) }), _jsx("input", { type: "search", placeholder: "Search quizzes, decks, or topics...", "aria-label": "Filter quizzes", value: search, onChange: (e) => setSearch(e.target.value) })] }) }), _jsxs("section", { className: "qz-action-chips", "aria-label": "Quiz actions", children: [_jsx(ActionChip, { icon: _jsx(PlusIcon, { size: 16 }), label: "Generate Quiz", tone: "peach", onClick: () => setGenerateOpen(true) }), _jsx(ActionChip, { icon: _jsx(PlayIcon, { size: 16 }), label: "Take Due Quiz", tone: "sage", onClick: takeDue }), _jsx(ActionChip, { icon: _jsx(TargetIcon, { size: 16 }), label: "Review Weak Topics", tone: "rose", onClick: reviewWeak }), _jsx(ActionChip, { icon: _jsx(RestartIcon, { size: 16 }), label: "Practice Again", tone: "sky", onClick: practiceAgain })] }), queueState.total > 0 && _jsx(QuizGenerationQueuePanel, { queue: queueState }), _jsx(FilterRow, { classes: classes, summaries: summaries, filter: filter, setFilter: setFilter }), _jsx("section", { className: "qz-deck-grid", "aria-label": "Quizzes", children: filteredSummaries.length === 0 ? (_jsxs("div", { className: "qz-empty", children: [_jsx(QuizIcon, { size: 28 }), _jsx("p", { children: summaries.length === 0
                                                    ? "You don't have any quizzes yet — generate one from a note, class, or deck."
                                                    : "No quizzes match this filter." }), summaries.length === 0 && (_jsx("button", { type: "button", className: "btn-primary", onClick: () => setGenerateOpen(true), children: "Generate quiz" }))] })) : (filteredSummaries.map((s) => (_jsx(QuizCard, { summary: s, classes: classes, active: selectedQuizId === s.quiz.id, onSelect: () => {
                                            if (selectedQuizId === s.quiz.id)
                                                selectQuizPreview(null);
                                            else
                                                selectQuizPreview(s.quiz.id);
                                        }, onTake: () => startQuiz(s.quiz.id), onResults: () => openResults(s.quiz.id), onAskAi: () => {
                                            setSelectedQuiz(s.quiz.id);
                                            setView({ kind: "quiz", quizId: s.quiz.id, mode: "review" });
                                        }, onDelete: () => {
                                            void softDeleteQuiz(s.quiz.id).then(() => {
                                                if (selectedQuizId === s.quiz.id)
                                                    setSelectedQuiz(null);
                                                setReload((n) => n + 1);
                                            });
                                        } }, s.quiz.id)))) }), weakTopics.length > 0 && (_jsxs("section", { className: "qz-insights", children: [_jsxs("span", { className: "qz-insights-label", children: [_jsx(SparklesIcon, { size: 14 }), " Quiz Insights"] }), _jsx("div", { className: "qz-insights-chips", children: weakTopics.map((t) => (_jsx("span", { className: "rail-chip rail-chip-rose", children: t }, t))) })] }))] }) }), generateOpen && (_jsx(QuizGenerationModal, { onClose: () => setGenerateOpen(false), onGenerated: (quizId) => {
                            setGenerateOpen(false);
                            setSelectedQuiz(quizId);
                            setReload((n) => n + 1);
                        } }))] }), selectedQuizId ? (_jsx(QuizDetailRail, { variant: "hub", quizId: selectedQuizId })) : (_jsx(RightPanel, {}))] }));
};
const QzStat = ({ icon, tone, value, label }) => (_jsxs("div", { className: `fh-stat qz-stat tone-${tone}`, children: [_jsx("span", { className: "fh-stat-icon", children: icon }), _jsxs("div", { className: "fh-stat-body", children: [_jsx("span", { className: "fh-stat-value", children: value }), _jsx("span", { className: "fh-stat-label", children: label })] })] }));
const ActionChip = ({ icon, label, tone, onClick }) => (_jsxs("button", { type: "button", className: `fh-chip tone-${tone}`, onClick: onClick, children: [_jsx("span", { className: "fh-chip-icon", children: icon }), _jsx("span", { children: label })] }));
const FilterRow = ({ classes, summaries, filter, setFilter }) => {
    const classCounts = useMemo(() => {
        const m = new Map();
        for (const s of summaries) {
            if (s.classId)
                m.set(s.classId, (m.get(s.classId) ?? 0) + 1);
        }
        return m;
    }, [summaries]);
    const usedClasses = classes.filter((c) => classCounts.has(c.id));
    const items = [
        { id: "all", label: "All" },
        ...usedClasses.map((c) => ({
            id: `class:${c.id}`,
            label: c.name,
        })),
        { id: "completed", label: "Completed" },
        { id: "in-progress", label: "In Progress" },
        { id: "needs-review", label: "Needs Review" },
    ];
    return (_jsx("section", { className: "qz-filter-row", "aria-label": "Filter quizzes", children: items.map((it) => (_jsx("button", { type: "button", className: `qz-filter-chip${filter === it.id ? " active" : ""}`, onClick: () => setFilter(it.id), children: it.label }, it.id))) }));
};
const QuizCard = ({ summary, classes, active, onSelect, onTake, onResults, onAskAi, onDelete, }) => {
    const cls = summary.classId
        ? classes.find((c) => c.id === summary.classId) ?? null
        : null;
    const tone = cls ? toneFor(cls) : "sage";
    const subtitle = cls?.name ?? summary.noteTitle ?? "Unfiled";
    const typeLabel = labelForQuiz(summary);
    const statusPill = pillForStatus(summary);
    const moreItems = [
        {
            label: summary.attempts > 0 ? "View results" : "Take quiz",
            icon: _jsx(ArrowRightIcon, { size: 14 }),
            onClick: summary.attempts > 0 ? onResults : onTake,
        },
        {
            label: "Delete quiz",
            icon: _jsx(WarningIcon, { size: 14 }),
            onClick: onDelete,
            danger: true,
        },
    ];
    return (_jsxs("article", { className: `qz-deck-card${active ? " active" : ""}`, onClick: onSelect, children: [_jsxs("header", { className: "qz-deck-head", children: [_jsx("span", { className: `qz-deck-icon tone-${tone}`, children: cls ? iconFor(cls, 20) : _jsx(QuizIcon, { size: 20 }) }), _jsx("div", { className: "qz-deck-more", onClick: (e) => e.stopPropagation(), children: _jsx(MoreMenu, { items: moreItems, label: "Quiz actions" }) })] }), _jsx("h3", { className: "qz-deck-title", children: summary.quiz.title }), _jsx("p", { className: "qz-deck-subtitle", children: subtitle }), _jsxs("p", { className: "qz-deck-meta", children: [summary.questionCount, " ", summary.questionCount === 1 ? "question" : "questions", " • ", typeLabel] }), _jsxs("div", { className: "qz-deck-pills", children: [_jsx(DeckStatPill, { label: "Last score", value: summary.lastScorePct !== null ? `${summary.lastScorePct}%` : "—" }), _jsx(DeckStatPill, { label: "Best", value: summary.bestScorePct !== null ? `${summary.bestScorePct}%` : "—" }), _jsx(DeckStatPill, { label: "Attempts", value: summary.attempts })] }), statusPill && (_jsxs("div", { className: `qz-deck-status ${statusPill.tone}`, children: [_jsx("span", { className: "qz-deck-status-dot", "aria-hidden": true }), _jsx("span", { children: statusPill.label }), statusPill.detail && (_jsx("span", { className: "qz-deck-status-detail", children: statusPill.detail }))] })), _jsxs("div", { className: "qz-deck-actions", children: [_jsxs("button", { type: "button", className: "qz-deck-button primary", onClick: (e) => {
                            e.stopPropagation();
                            if (summary.status === "in_progress") {
                                onTake();
                            }
                            else if (summary.attempts > 0) {
                                onTake();
                            }
                            else {
                                onTake();
                            }
                        }, children: [summary.status === "in_progress"
                                ? "Resume Quiz"
                                : summary.attempts > 0
                                    ? "Take Quiz"
                                    : "Take Quiz", _jsx(ArrowRightIcon, { size: 12 })] }), _jsxs("button", { type: "button", className: "qz-deck-button ghost", onClick: (e) => {
                            e.stopPropagation();
                            onAskAi();
                        }, children: [_jsx(SparklesIcon, { size: 12 }), "Ask AI"] })] })] }));
};
const DeckStatPill = ({ label, value }) => (_jsxs("div", { className: "qz-deck-pill", children: [_jsx("span", { className: "qz-deck-pill-value", children: value }), _jsx("span", { className: "qz-deck-pill-label", children: label })] }));
const QuizGenerationQueuePanel = ({ queue }) => (_jsxs("section", { className: "qz-queue-panel", "aria-live": "polite", children: [_jsxs("header", { className: "qz-queue-head", children: [_jsx("span", { className: "qz-queue-title", children: "Quiz generation queue" }), _jsxs("span", { className: "qz-queue-count", children: [queue.total, " in queue"] })] }), queue.active && (_jsxs("p", { className: "qz-queue-active", children: [_jsx("strong", { children: "Generating:" }), " ", queue.active.label] })), queue.pending.length > 0 && (_jsx("ul", { className: "qz-queue-list", children: queue.pending.map((item, idx) => (_jsxs("li", { children: [_jsxs("span", { className: "qz-queue-order", children: [idx + 1, "."] }), " ", item.label] }, item.id))) }))] }));
/* =========== helpers =========== */
function parseTags(json) {
    if (!json)
        return [];
    try {
        const v = JSON.parse(json);
        if (Array.isArray(v))
            return v.filter((x) => typeof x === "string");
    }
    catch {
        /* drop */
    }
    return [];
}
function labelForQuiz(s) {
    const src = s.quiz.source_type;
    if (src === "class")
        return "Mixed";
    if (src === "flashcards")
        return "Practice";
    return "Multiple Choice";
}
function pillForStatus(s) {
    if (s.status === "in_progress") {
        return { label: "In Progress", tone: "tone-amber" };
    }
    if (s.needsReview) {
        const weak = parseTags(s.quiz.weak_topics_json);
        return {
            label: "Needs Review",
            tone: "tone-rose",
            detail: weak.length > 0 ? `Weak topic: ${weak[0]}` : undefined,
        };
    }
    if (s.attempts > 0) {
        return { label: "On Track", tone: "tone-sage" };
    }
    return null;
}
const SearchInline = () => (_jsxs("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("path", { d: "m21 21-3.5-3.5" })] }));
//# sourceMappingURL=QuizzesHub.js.map