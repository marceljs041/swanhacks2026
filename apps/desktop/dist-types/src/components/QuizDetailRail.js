import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { getNote, getQuiz, quizAttemptsForQuiz, quizSummaries, } from "../db/repositories.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { useApp } from "../store.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { ArrowLeftIcon, ArrowRightIcon, BookmarkIcon, CheckIcon, CloudCheckIcon, CloudOffIcon, FlashcardIcon, GraphIcon, QuizIcon, SparklesIcon, TargetIcon, TrophyIcon, } from "./icons.js";
export const QuizDetailRail = ({ variant, quizId, sessionStats, currentQuestion, resultsStats, onExplainQuestion, onSummarizeWeakTopics, onMakeReviewSet, onAskQuiz, }) => {
    const setView = useApp((s) => s.setView);
    const setSelectedQuiz = useApp((s) => s.setSelectedQuiz);
    const classes = useApp((s) => s.classes);
    const syncStatus = useApp((s) => s.syncStatus);
    const selectedQuizId = useApp((s) => s.selectedQuizId);
    const effectiveQuizId = quizId ?? selectedQuizId;
    const [quiz, setQuiz] = useState(null);
    const [summary, setSummary] = useState(null);
    const [note, setNote] = useState(null);
    const [attempts, setAttempts] = useState([]);
    useEffect(() => {
        let cancelled = false;
        if (!effectiveQuizId) {
            setQuiz(null);
            setSummary(null);
            setNote(null);
            setAttempts([]);
            return () => undefined;
        }
        void (async () => {
            const [q, all, atts] = await Promise.all([
                getQuiz(effectiveQuizId),
                quizSummaries(),
                quizAttemptsForQuiz(effectiveQuizId),
            ]);
            if (cancelled)
                return;
            setQuiz(q);
            setSummary(all.find((s) => s.quiz.id === effectiveQuizId) ?? null);
            setAttempts(atts.filter((a) => a.completed === 1));
            if (q?.note_id) {
                const n = await getNote(q.note_id);
                if (!cancelled)
                    setNote(n);
            }
            else {
                setNote(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [effectiveQuizId, variant]);
    const cls = useMemo(() => {
        const id = quiz?.class_id ?? note?.class_id ?? null;
        if (!id)
            return null;
        return classes.find((c) => c.id === id) ?? null;
    }, [quiz, note, classes]);
    const panelChrome = "right-panel quiz-detail-rail quiz-rail right-panel--quizzes-swap";
    if (!effectiveQuizId) {
        return (_jsx("aside", { className: `${panelChrome} empty`, "aria-label": "Quiz details", children: _jsx("p", { className: "quiz-rail-empty-msg", children: "Select a quiz to see its progress and AI tools." }) }));
    }
    if (!quiz) {
        return (_jsx("aside", { className: `${panelChrome} empty`, "aria-label": "Quiz details", children: _jsx("p", { className: "quiz-rail-empty-msg", children: "Loading quiz\u2026" }) }));
    }
    const tone = cls ? toneFor(cls) : "sage";
    const subtitle = cls?.code ?? cls?.name ?? "Unfiled";
    const description = quiz.description ||
        note?.summary ||
        `Test your understanding of ${quiz.title.toLowerCase()} with practice questions.`;
    const tags = parseStringArray(quiz.tags_json);
    const defaultTags = (() => {
        const base = ["Lecture", "Exam 1"];
        if (summary?.needsReview)
            base.push("Needs Review");
        return base;
    })();
    const renderTags = tags.length > 0 ? tags : defaultTags;
    const weakTopics = parseStringArray(quiz.weak_topics_json);
    const sessionFocus = sessionStats?.currentFocus ?? [];
    const focusTopics = (sessionFocus.length > 0 ? sessionFocus : weakTopics).slice(0, 4);
    return (_jsxs("aside", { className: panelChrome, "aria-label": "Quiz details", children: [_jsxs("header", { className: "quiz-rail-head", children: [_jsx("button", { type: "button", className: "quiz-rail-back", "aria-label": "Back to all quizzes", onClick: () => {
                            withViewTransition(() => {
                                if (variant === "hub")
                                    setSelectedQuiz(null);
                                else
                                    setView({ kind: "quizzes" });
                            });
                        }, children: _jsx(ArrowLeftIcon, { size: 16 }) }), _jsx("span", { className: "quiz-rail-spacer" })] }), _jsxs("div", { className: "quiz-rail-title", children: [_jsx("span", { className: `quiz-rail-icon tone-${tone}`, children: cls ? iconFor(cls, 22) : _jsx(QuizIcon, { size: 22 }) }), _jsxs("div", { className: "quiz-rail-title-text", children: [_jsx("h2", { children: quiz.title }), _jsx("span", { className: "quiz-rail-subtitle", children: subtitle })] })] }), _jsx("div", { className: "quiz-rail-chips", children: renderTags.map((tag) => (_jsx("span", { className: `rail-chip rail-chip-${chipToneFor(tag)}`, children: tag }, tag))) }), _jsx("p", { className: "quiz-rail-description", children: description }), variant === "hub" && summary && (_jsx(HubBlocks, { summary: summary, attempts: attempts })), variant === "session" && sessionStats && (_jsx(SessionBlocks, { stats: sessionStats, focusTopics: focusTopics })), variant === "results" && resultsStats && (_jsx(ResultsBlocks, { stats: resultsStats })), _jsxs("section", { className: "quiz-rail-block", children: [_jsx("header", { className: "quiz-rail-block-head", children: _jsx("span", { children: "AI Tools" }) }), _jsxs("div", { className: "quiz-rail-tools", children: [variant === "session" && (_jsx(RailToolButton, { icon: _jsx(SparklesIcon, { size: 14 }), label: "Explain This Question", onClick: () => onExplainQuestion?.(), disabled: !currentQuestion, tone: "lilac" })), _jsx(RailToolButton, { icon: _jsx(TargetIcon, { size: 14 }), label: "Summarize Weak Topics", onClick: () => onSummarizeWeakTopics?.(), tone: "lilac" }), _jsx(RailToolButton, { icon: _jsx(FlashcardIcon, { size: 14 }), label: "Make Review Set", onClick: () => onMakeReviewSet?.(), tone: "sage" }), _jsx(RailToolButton, { icon: _jsx(QuizIcon, { size: 14 }), label: "Ask This Quiz", onClick: () => onAskQuiz?.(), tone: "sky" }), _jsx(RailToolButton, { icon: _jsx(BookmarkIcon, { size: 14 }), label: "Schedule practice", tone: "peach", onClick: () => {
                                    if (!quiz)
                                        return;
                                    const start = new Date();
                                    start.setDate(start.getDate() + 1);
                                    start.setHours(9, 0, 0, 0);
                                    const end = new Date(start.getTime() + 30 * 60_000);
                                    setView({ kind: "calendar" });
                                    queueMicrotask(() => {
                                        useApp.getState().setCalendarComposer({
                                            mode: "create",
                                            prefill: {
                                                type: "quiz",
                                                title: `Practice: ${quiz.title}`,
                                                quiz_id: quiz.id,
                                                note_id: quiz.note_id ?? null,
                                                class_id: quiz.class_id ?? cls?.id ?? null,
                                                start_at: start.toISOString(),
                                                end_at: end.toISOString(),
                                            },
                                        });
                                    });
                                } })] })] }), _jsxs("footer", { className: `quiz-rail-sync sync-${syncStatus}`, children: [_jsx("span", { className: "quiz-rail-sync-icon", children: syncStatus === "offline" ? (_jsx(CloudOffIcon, { size: 14 })) : (_jsx(CloudCheckIcon, { size: 14 })) }), _jsxs("div", { className: "quiz-rail-sync-text", children: [_jsx("span", { className: "lead", children: syncStatus === "offline" ? "Working offline" : "All changes synced" }), _jsx("span", { className: "sub", children: syncStatus === "offline"
                                    ? "We'll catch up when you're online."
                                    : "Last synced just now" })] })] })] }));
};
/* ============== blocks ============== */
const HubBlocks = ({ summary, attempts, }) => {
    const recent = attempts.slice(0, 3);
    const weak = parseStringArray(summary.quiz.weak_topics_json);
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: "quiz-rail-block", children: [_jsxs("header", { className: "quiz-rail-block-head", children: [_jsxs("span", { children: [_jsx(GraphIcon, { size: 14 }), " Recent Scores"] }), _jsx("span", { className: "quiz-rail-link-mute", children: "View all" })] }), recent.length === 0 ? (_jsx("p", { className: "quiz-rail-empty-msg", children: "No attempts yet \u2014 take the quiz to see scores here." })) : (_jsx("ul", { className: "quiz-rail-scores", children: recent.map((a) => {
                            const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
                            const at = a.finished_at ?? a.created_at;
                            return (_jsxs("li", { className: "quiz-rail-score-row", children: [_jsx("span", { className: "quiz-rail-score-date", children: shortDate(at) }), _jsxs("span", { className: "quiz-rail-score-pct", children: [pct, "%"] })] }, a.id));
                        }) }))] }), _jsxs("section", { className: "quiz-rail-block", children: [_jsx("header", { className: "quiz-rail-block-head", children: _jsx("span", { children: "Quiz Progress" }) }), _jsxs("div", { className: "quiz-rail-stats", children: [_jsx(RailStat, { label: "Questions", value: summary.questionCount, icon: _jsx(QuizIcon, { size: 14 }), tone: "amber" }), _jsx(RailStat, { label: "Attempts", value: summary.attempts, icon: _jsx(BookmarkIcon, { size: 14 }), tone: "peach" }), _jsx(RailStat, { label: "Best", value: summary.bestScorePct !== null ? `${summary.bestScorePct}%` : "—", icon: _jsx(TrophyIcon, { size: 14 }), tone: "lilac" }), _jsx(RailStat, { label: "Avg", value: summary.lastScorePct !== null ? `${summary.lastScorePct}%` : "—", icon: _jsx(GraphIcon, { size: 14 }), tone: "sage" })] })] }), weak.length > 0 && (_jsxs("section", { className: "quiz-rail-block", children: [_jsx("header", { className: "quiz-rail-block-head", children: _jsx("span", { children: "Weak Topics" }) }), _jsx("div", { className: "quiz-rail-topic-chips", children: weak.map((t) => (_jsx("span", { className: "rail-chip rail-chip-rose", children: t }, t))) })] }))] }));
};
const SessionBlocks = ({ stats, focusTopics }) => (_jsxs(_Fragment, { children: [_jsxs("section", { className: "quiz-rail-block", children: [_jsx("header", { className: "quiz-rail-block-head", children: _jsxs("span", { children: [_jsx(GraphIcon, { size: 14 }), " Quiz Session"] }) }), _jsxs("div", { className: "quiz-rail-stats", children: [_jsx(RailStat, { label: "Questions", value: stats.total, icon: _jsx(QuizIcon, { size: 14 }), tone: "amber" }), _jsx(RailStat, { label: "Completed", value: stats.completed, icon: _jsx(CheckIcon, { size: 14 }), tone: "sage" }), _jsx(RailStat, { label: "Remaining", value: stats.remaining, icon: _jsx(BookmarkIcon, { size: 14 }), tone: "peach" }), _jsx(RailStat, { label: "Accuracy", value: `${stats.accuracy}%`, icon: _jsx(TrophyIcon, { size: 14 }), tone: "lilac" })] })] }), focusTopics.length > 0 && (_jsxs("section", { className: "quiz-rail-block", children: [_jsx("header", { className: "quiz-rail-block-head", children: _jsxs("span", { children: [_jsx(TargetIcon, { size: 14 }), " Current Focus"] }) }), _jsx("div", { className: "quiz-rail-topic-chips", children: focusTopics.map((t) => (_jsx("span", { className: "rail-chip rail-chip-rose", children: t }, t))) })] }))] }));
const ResultsBlocks = ({ stats }) => (_jsxs(_Fragment, { children: [_jsxs("section", { className: "quiz-rail-block", children: [_jsx("header", { className: "quiz-rail-block-head", children: _jsxs("span", { children: [_jsx(TrophyIcon, { size: 14 }), " Result"] }) }), _jsxs("div", { className: "quiz-rail-stats", children: [_jsx(RailStat, { label: "Score", value: `${stats.score}/${stats.total}`, icon: _jsx(QuizIcon, { size: 14 }), tone: "amber" }), _jsx(RailStat, { label: "Percent", value: `${stats.pct}%`, icon: _jsx(TrophyIcon, { size: 14 }), tone: "lilac" }), _jsx(RailStat, { label: "Time", value: fmtMinSec(stats.timeSpentSeconds), icon: _jsx(GraphIcon, { size: 14 }), tone: "sage" }), _jsx(RailStat, { label: "Missed", value: Math.max(0, stats.total - stats.score), icon: _jsx(TargetIcon, { size: 14 }), tone: "peach" })] })] }), stats.weakTopics.length > 0 && (_jsxs("section", { className: "quiz-rail-block", children: [_jsx("header", { className: "quiz-rail-block-head", children: _jsx("span", { children: "Weak Topics" }) }), _jsx("div", { className: "quiz-rail-topic-chips", children: stats.weakTopics.map((t) => (_jsx("span", { className: "rail-chip rail-chip-rose", children: t }, t))) })] }))] }));
const RailStat = ({ label, value, icon, tone }) => (_jsxs("div", { className: `rail-stat tone-${tone}`, children: [_jsx("span", { className: "rail-stat-icon", children: icon }), _jsx("span", { className: "rail-stat-num", children: value }), _jsx("span", { className: "rail-stat-label", children: label })] }));
const RailToolButton = ({ icon, label, onClick, busy, disabled, tone = "lilac", }) => (_jsxs("button", { type: "button", className: `quiz-rail-tool tone-${tone}`, onClick: onClick, disabled: busy || disabled, children: [_jsx("span", { className: "quiz-rail-tool-icon", children: icon }), _jsx("span", { className: "quiz-rail-tool-label", children: busy ? "Working…" : label }), _jsx(ArrowRightIcon, { size: 12 })] }));
/* ============== helpers ============== */
function parseStringArray(json) {
    if (!json)
        return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
            return parsed.filter((v) => typeof v === "string" && v.length > 0);
        }
    }
    catch {
        /* drop */
    }
    return [];
}
function chipToneFor(tag) {
    const t = tag.toLowerCase();
    if (t.includes("review") || t.includes("weak"))
        return "rose";
    if (t.includes("exam"))
        return "amber";
    if (t.includes("lecture") || t.includes("note"))
        return "sage";
    return "sky";
}
function shortDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtMinSec(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0)
        return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0)
        return `${s}s`;
    if (s === 0)
        return `${m}m`;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
}
//# sourceMappingURL=QuizDetailRail.js.map