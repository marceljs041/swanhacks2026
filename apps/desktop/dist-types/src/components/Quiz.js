import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearQuizSession, getNote, getQuiz, getQuizSession, listQuizQuestions, quizAttemptsForQuiz, recordQuizAttempt, recordRewardPoints, recordXp, saveQuizSession, topicPerformance, upsertFlashcard, upsertFlashcardSet, upsertStudyTask, } from "../db/repositories.js";
import { useApp } from "../store.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { POINTS_RULES, ulid, XP_RULES } from "@studynest/shared";
import { withViewTransition } from "../lib/viewTransition.js";
import { BRAND_QUIZ_HERO_URL } from "../lib/brand.js";
import { QuizDetailRail } from "./QuizDetailRail.js";
import { Donut } from "./ui/ProgressRing.js";
import { ArrowLeftIcon, ArrowRightIcon, BookmarkIcon, CalendarIcon, CheckIcon, CloudCheckIcon, CloudOffIcon, FlashcardIcon, GraphIcon, NoteIcon, QuizIcon, SparklesIcon, TargetIcon, VolumeIcon, WarningIcon, } from "./icons.js";
export const Quiz = ({ quizId, mode }) => {
    const setView = useApp((s) => s.setView);
    const setSelectedQuiz = useApp((s) => s.setSelectedQuiz);
    const classes = useApp((s) => s.classes);
    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [note, setNote] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void (async () => {
            const [q, qs] = await Promise.all([
                getQuiz(quizId),
                listQuizQuestions(quizId),
            ]);
            if (cancelled)
                return;
            setQuiz(q);
            setQuestions(qs);
            if (q?.note_id) {
                const n = await getNote(q.note_id);
                if (!cancelled)
                    setNote(n);
            }
            else {
                setNote(null);
            }
            setSelectedQuiz(quizId);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [quizId, setSelectedQuiz]);
    const cls = useMemo(() => {
        const id = quiz?.class_id ?? note?.class_id ?? null;
        if (!id)
            return null;
        return classes.find((c) => c.id === id) ?? null;
    }, [quiz, note, classes]);
    if (loading || !quiz) {
        return (_jsx("main", { className: "main", children: _jsx("div", { className: "main-inner", children: _jsx("p", { className: "quiz-loading", children: "Loading quiz\u2026" }) }) }));
    }
    if (mode === "results") {
        return (_jsx(ResultsView, { quiz: quiz, questions: questions, cls: cls, note: note, onRetake: () => withViewTransition(() => setView({ kind: "quiz", quizId, mode: "take" })), onReview: () => withViewTransition(() => setView({ kind: "quiz", quizId, mode: "review" })) }));
    }
    if (mode === "review") {
        return (_jsx(ReviewView, { quiz: quiz, questions: questions, cls: cls, note: note, onBack: () => withViewTransition(() => setView({ kind: "quiz", quizId, mode: "results" })) }));
    }
    return (_jsx(TakeView, { quiz: quiz, questions: questions, cls: cls, note: note, onSubmitted: () => withViewTransition(() => setView({ kind: "quiz", quizId, mode: "results" })) }));
};
const TakeView = ({ quiz, questions, cls, note, onSubmitted }) => {
    const setView = useApp((s) => s.setView);
    const syncStatus = useApp((s) => s.syncStatus);
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState({});
    const [shortInput, setShortInput] = useState("");
    const [hintOpen, setHintOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [streak, setStreak] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    /** Bumped every second so "Time elapsed" recomputes without waiting on other state. */
    const [, setSessionClockTick] = useState(0);
    const startedAtRef = useRef(null);
    const total = questions.length;
    const current = questions[index] ?? null;
    useEffect(() => {
        const id = window.setInterval(() => {
            setSessionClockTick((n) => n + 1);
        }, 1000);
        return () => window.clearInterval(id);
    }, []);
    // Hydrate from a persisted session, if one exists.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const session = await getQuizSession(quiz.id);
            if (cancelled)
                return;
            if (session) {
                try {
                    const restored = JSON.parse(session.answers_json);
                    setAnswers(restored ?? {});
                    setIndex(Math.min(session.current_index, Math.max(0, total - 1)));
                }
                catch {
                    /* ignore */
                }
                startedAtRef.current = session.started_at;
            }
            else {
                startedAtRef.current = new Date().toISOString();
            }
            if (!cancelled)
                setSessionClockTick((n) => n + 1);
        })();
        return () => {
            cancelled = true;
        };
    }, [quiz.id, total]);
    // Reset per-question UI when the active question changes.
    useEffect(() => {
        setHintOpen(false);
        if (current?.type === "short_answer") {
            setShortInput(answers[current.id] ?? "");
        }
    }, [current?.id]);
    function setAnswer(questionId, value) {
        setAnswers((a) => ({ ...a, [questionId]: value }));
        void saveQuizSession({
            quiz_id: quiz.id,
            current_index: index,
            answers: { ...answers, [questionId]: value },
            started_at: startedAtRef.current ?? undefined,
        });
    }
    function isCorrectFor(question, given) {
        if (!given)
            return false;
        const a = given.trim().toLowerCase();
        const c = question.correct_answer.trim().toLowerCase();
        if (a === c)
            return true;
        // Lenient short-answer grading: punctuation-stripped match.
        if (question.type === "short_answer") {
            const norm = (s) => s.replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
            return norm(a) === norm(c);
        }
        return false;
    }
    function commitAnswer() {
        if (!current)
            return;
        if (current.type === "short_answer") {
            const v = shortInput.trim();
            if (!v)
                return;
            setAnswer(current.id, v);
        }
        const given = current.type === "short_answer" ? shortInput.trim() : answers[current.id];
        if (!given)
            return;
        setSubmitted((s) => ({ ...s, [current.id]: true }));
        const ok = isCorrectFor(current, given);
        if (ok) {
            setCorrectCount((c) => c + 1);
            setStreak((s) => s + 1);
        }
        else {
            setStreak(0);
        }
    }
    function next() {
        if (index < total - 1) {
            const nextIdx = index + 1;
            setIndex(nextIdx);
            void saveQuizSession({
                quiz_id: quiz.id,
                current_index: nextIdx,
                answers,
                started_at: startedAtRef.current ?? undefined,
            });
        }
        else {
            void finalize();
        }
    }
    function skip() {
        if (!current)
            return;
        setSubmitted((s) => ({ ...s, [current.id]: false }));
        setStreak(0);
        next();
    }
    async function finalize() {
        if (submitting)
            return;
        setSubmitting(true);
        try {
            const startIso = startedAtRef.current ?? new Date().toISOString();
            const finishIso = new Date().toISOString();
            const elapsed = Math.max(0, Math.round((Date.parse(finishIso) - Date.parse(startIso)) / 1000));
            let score = 0;
            const wrongTopics = new Set();
            for (const q of questions) {
                const a = answers[q.id];
                if (a && isCorrectFor(q, a)) {
                    score += 1;
                }
                else if (q.topic) {
                    wrongTopics.add(q.topic);
                }
            }
            const weakTopics = Array.from(wrongTopics);
            await recordQuizAttempt({
                quiz_id: quiz.id,
                score,
                total,
                answers,
                weak_topics: weakTopics,
                started_at: startIso,
                finished_at: finishIso,
                time_spent_seconds: elapsed,
            });
            await clearQuizSession(quiz.id);
            await recordXp("completeQuiz", XP_RULES.completeQuiz);
            if (total > 0 && score === total) {
                await recordXp("perfectQuizBonus", XP_RULES.perfectQuizBonus);
            }
            await recordRewardPoints("completeQuiz", POINTS_RULES.completeQuiz);
            if (total > 0 && score / total >= 0.8) {
                await recordRewardPoints("scoreEightyPlus", POINTS_RULES.scoreEightyPlus);
            }
            onSubmitted();
        }
        finally {
            setSubmitting(false);
        }
    }
    const progressPct = total === 0 ? 0 : Math.round((index / total) * 100);
    const completed = Object.keys(answers).length;
    const remaining = Math.max(0, total - completed);
    const accuracy = completed === 0 ? 0 : Math.round((correctCount / Math.max(1, completed)) * 100);
    const focusTopics = questions
        .slice(index, index + 3)
        .map((q) => q.topic)
        .filter((v) => !!v);
    const sessionStats = {
        total,
        completed,
        remaining,
        accuracy,
        currentFocus: focusTopics,
    };
    const elapsedSeconds = startedAtRef.current
        ? Math.max(0, Math.round((Date.now() - Date.parse(startedAtRef.current)) / 1000))
        : 0;
    return (_jsxs(_Fragment, { children: [_jsxs("main", { className: "main", children: [_jsxs("div", { className: "topbar", children: [_jsxs("button", { className: "btn-ghost", onClick: () => withViewTransition(() => setView({ kind: "quizzes" })), children: [_jsx(ArrowLeftIcon, { size: 14 }), " Quizzes"] }), _jsx("span", { style: { flex: 1 } }), _jsx(SyncPill, { status: syncStatus })] }), _jsx("div", { className: "main-inner", children: _jsxs("div", { className: "quiz-take-shell", children: [_jsxs("section", { className: "hero quiz-hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(Breadcrumb, { cls: cls, quiz: quiz }), _jsxs("div", { className: "hero-greeting", children: [_jsx("h1", { className: "hero-headline", children: "Take Quiz" }), _jsx("p", { children: "Answer each question, track your progress, and learn as you go." })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_QUIZ_HERO_URL, alt: "", decoding: "async" }) })] }), _jsx(MetaChips, { cls: cls, quiz: quiz, total: total, index: index, syncStatus: syncStatus }), _jsxs("div", { className: "qz-progress", "aria-label": "Quiz progress", children: [_jsx("span", { className: "qz-progress-fill", style: { width: `${progressPct}%` } }), _jsxs("span", { className: "qz-progress-meta", children: [progressPct, "% complete"] })] }), !current ? (_jsxs("div", { className: "qz-empty", children: [_jsx(QuizIcon, { size: 28 }), _jsx("p", { children: "This quiz has no questions yet." })] })) : (_jsx(QuestionCard, { question: current, index: index, total: total, given: answers[current.id], shortInput: shortInput, setShortInput: setShortInput, onSelect: (value) => setAnswer(current.id, value), showFeedback: !!submitted[current.id], hintOpen: hintOpen })), _jsxs("div", { className: "qz-action-bar", children: [current && !submitted[current.id] ? (_jsx("button", { type: "button", className: "btn-primary qz-action-primary", disabled: current.type === "short_answer"
                                                ? shortInput.trim().length === 0
                                                : !answers[current.id], onClick: commitAnswer, children: "Submit Answer" })) : (_jsxs("button", { type: "button", className: "btn-primary qz-action-primary", disabled: submitting, onClick: next, children: [index < total - 1 ? "Next Question" : submitting ? "Submitting…" : "Finish Quiz", _jsx(ArrowRightIcon, { size: 12 })] })), _jsx("button", { type: "button", className: "qz-action-ghost", onClick: skip, disabled: !current, children: "Skip" }), _jsxs("button", { type: "button", className: "qz-action-ghost", onClick: () => speak(current?.question ?? ""), disabled: !current, children: [_jsx(VolumeIcon, { size: 14 }), " Read Aloud"] }), _jsxs("button", { type: "button", className: "qz-action-ghost", onClick: () => setHintOpen((v) => !v), disabled: !current?.hint, children: [_jsx(SparklesIcon, { size: 14 }), " Hint"] })] }), hintOpen && current?.hint && (_jsx("p", { className: "qz-hint", children: current.hint })), _jsxs("div", { className: "qz-helper-row", children: [_jsx(HelperCard, { title: "Session Overview", icon: _jsx(GraphIcon, { size: 16 }), children: _jsxs("div", { className: "qz-helper-grid", children: [_jsx(KvStat, { label: "Accuracy", value: `${accuracy}%` }), _jsx(KvStat, { label: "Correct in a row", value: streak }), _jsx(KvStat, { label: "Time elapsed", value: fmtMinSec(elapsedSeconds) })] }) }), _jsx(HelperCard, { title: "Quick Actions", icon: _jsx(TargetIcon, { size: 16 }), children: _jsxs("div", { className: "qz-quick-row", children: [_jsx(QuickButton, { icon: _jsx(NoteIcon, { size: 14 }), label: "View Related Note", onClick: () => {
                                                            if (note)
                                                                setView({ kind: "note", noteId: note.id });
                                                        }, disabled: !note }), _jsx(QuickButton, { icon: _jsx(SparklesIcon, { size: 14 }), label: "Ask AI", onClick: () => {
                                                            if (cls)
                                                                setView({ kind: "classAsk", classId: cls.id });
                                                        }, disabled: !cls }), _jsx(QuickButton, { icon: _jsx(WarningIcon, { size: 14 }), label: "Report Issue", onClick: () => {
                                                            window.alert("Thanks — we'll log this question for review.");
                                                        } })] }) })] })] }) })] }), _jsx(QuizDetailRail, { variant: "session", quizId: quiz.id, sessionStats: sessionStats, currentQuestion: current, onExplainQuestion: () => {
                    if (current?.explanation) {
                        setHintOpen(true);
                    }
                }, onSummarizeWeakTopics: () => {
                    if (cls)
                        setView({ kind: "classAsk", classId: cls.id });
                }, onMakeReviewSet: () => {
                    if (note)
                        setView({ kind: "note", noteId: note.id });
                }, onAskQuiz: () => {
                    if (cls)
                        setView({ kind: "classAsk", classId: cls.id });
                } })] }));
};
const ResultsView = ({ quiz, questions, cls, note, onRetake, onReview, }) => {
    const setView = useApp((s) => s.setView);
    const syncStatus = useApp((s) => s.syncStatus);
    const [attempts, setAttempts] = useState([]);
    const [perf, setPerf] = useState([]);
    const [busy, setBusy] = useState(null);
    const [toast, setToast] = useState(null);
    useEffect(() => {
        void Promise.all([
            quizAttemptsForQuiz(quiz.id),
            topicPerformance(quiz.id),
        ]).then(([atts, p]) => {
            setAttempts(atts.filter((a) => a.completed === 1));
            setPerf(p);
        });
    }, [quiz.id]);
    useEffect(() => {
        if (!toast)
            return;
        const id = window.setTimeout(() => setToast(null), 2400);
        return () => window.clearTimeout(id);
    }, [toast]);
    const latest = attempts[0] ?? null;
    const wrong = useMemo(() => {
        if (!latest)
            return [];
        let parsed = {};
        try {
            parsed = JSON.parse(latest.answers_json);
        }
        catch {
            /* drop */
        }
        return questions
            .map((q) => ({
            question: q,
            given: parsed[q.id] ?? "",
            correct: (parsed[q.id] ?? "").trim().toLowerCase() ===
                q.correct_answer.trim().toLowerCase(),
        }))
            .filter((r) => !r.correct);
    }, [latest, questions]);
    const score = latest?.score ?? 0;
    const total = latest?.total ?? questions.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const timeSpent = latest?.time_spent_seconds ?? 0;
    const weakTopics = useMemo(() => {
        if (!latest?.weak_topics_json)
            return [];
        try {
            const v = JSON.parse(latest.weak_topics_json);
            if (Array.isArray(v))
                return v.filter((x) => typeof x === "string");
        }
        catch {
            /* drop */
        }
        return [];
    }, [latest]);
    async function generateFlashcards() {
        if (wrong.length === 0) {
            setToast("Nothing to turn into flashcards — perfect score!");
            return;
        }
        setBusy("flash");
        try {
            const deck = await upsertFlashcardSet({
                title: `${quiz.title} · review cards`,
                note_id: quiz.note_id ?? null,
            });
            for (const r of wrong) {
                await upsertFlashcard({
                    set_id: deck.id,
                    front: r.question.question,
                    back: r.question.correct_answer,
                });
            }
            setView({ kind: "flashcardSet", setId: deck.id });
        }
        catch {
            setToast("Couldn't generate flashcards.");
        }
        finally {
            setBusy(null);
        }
    }
    async function addToStudyPlan() {
        setBusy("plan");
        try {
            const at = new Date();
            at.setHours(at.getHours() + 1, 0, 0, 0);
            const topics = weakTopics.length > 0 ? weakTopics : [quiz.title];
            for (const t of topics.slice(0, 3)) {
                await upsertStudyTask({
                    id: ulid("tsk"),
                    title: `Review: ${t}`,
                    type: "review",
                    scheduled_for: at.toISOString(),
                    duration_minutes: 20,
                    note_id: quiz.note_id ?? null,
                });
                at.setHours(at.getHours() + 1);
            }
            setToast("Added review blocks to your study plan.");
        }
        catch {
            setToast("Couldn't add to your study plan.");
        }
        finally {
            setBusy(null);
        }
    }
    return (_jsxs(_Fragment, { children: [_jsxs("main", { className: "main", children: [_jsxs("div", { className: "topbar", children: [_jsxs("button", { className: "btn-ghost", onClick: () => withViewTransition(() => useApp.getState().setView({ kind: "quizzes" })), children: [_jsx(ArrowLeftIcon, { size: 14 }), " Quizzes"] }), _jsx("span", { style: { flex: 1 } }), _jsx(SyncPill, { status: syncStatus })] }), _jsxs("div", { className: "main-inner", children: [_jsxs("div", { className: "quiz-take-shell", children: [_jsxs("section", { className: "hero quiz-hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(Breadcrumb, { cls: cls, quiz: quiz, suffix: "Results" }), _jsxs("div", { className: "hero-greeting", children: [_jsx("h1", { className: "hero-headline", children: "Quiz Results" }), _jsx("p", { children: "Here's how you did. Review what you missed and turn gaps into wins." })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_QUIZ_HERO_URL, alt: "", decoding: "async" }) })] }), _jsxs("section", { className: "qz-result-summary", children: [_jsx("div", { className: "qz-result-ring", children: _jsxs(Donut, { segments: [
                                                        { value: pct, color: "var(--color-primary)" },
                                                        {
                                                            value: Math.max(0, 100 - pct),
                                                            color: "var(--color-surfaceMuted)",
                                                        },
                                                    ], size: 148, thickness: 14, children: [_jsxs("span", { className: "donut-num", children: [pct, "%"] }), _jsx("span", { className: "donut-unit", children: "score" })] }) }), _jsxs("div", { className: "qz-result-stats", children: [_jsx(KvStat, { label: "Score", value: `${score} / ${total}` }), _jsx(KvStat, { label: "Points earned", value: `+${POINTS_RULES.completeQuiz +
                                                            (total > 0 && score / total >= 0.8
                                                                ? POINTS_RULES.scoreEightyPlus
                                                                : 0)}` }), _jsx(KvStat, { label: "Correct", value: `${score} of ${total}` }), _jsx(KvStat, { label: "Time", value: fmtMinSec(timeSpent) }), _jsx(KvStat, { label: "Attempts", value: attempts.length })] }), _jsxs("div", { className: "qz-result-actions", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: onRetake, children: "Retake Quiz" }), _jsx("button", { type: "button", className: "btn-secondary", onClick: onReview, disabled: wrong.length === 0, children: "Review Wrong Answers" })] })] }), _jsxs("section", { className: "qz-result-block", children: [_jsx("header", { className: "qz-result-block-head", children: _jsx("h2", { children: "Performance by topic" }) }), perf.length === 0 ? (_jsx("p", { className: "qz-result-empty", children: "Add topics to your questions to see a breakdown here." })) : (_jsx("ul", { className: "qz-topic-bars", children: perf.map((t) => (_jsxs("li", { className: "qz-topic-bar", children: [_jsx("span", { className: "qz-topic-name", children: t.topic }), _jsx("span", { className: "qz-topic-track", children: _jsx("span", { className: "qz-topic-fill", style: { width: `${t.pct}%` } }) }), _jsxs("span", { className: "qz-topic-pct", children: [t.correct, "/", t.total, " \u00B7 ", t.pct, "%"] })] }, t.topic))) }))] }), wrong.length > 0 && (_jsxs("section", { className: "qz-result-block", children: [_jsx("header", { className: "qz-result-block-head", children: _jsx("h2", { children: "Wrong answers" }) }), _jsx("ul", { className: "qz-wrong-list", children: wrong.slice(0, 6).map((r) => (_jsxs("li", { className: "qz-wrong-item", children: [_jsxs("div", { className: "qz-wrong-q", children: [_jsx("span", { className: "qz-wrong-eyebrow", children: r.question.topic ?? "Question" }), _jsx("p", { children: r.question.question })] }), _jsxs("div", { className: "qz-wrong-rows", children: [_jsxs("span", { className: "qz-wrong-row wrong", children: [_jsx("span", { className: "qz-wrong-tag", children: "Your answer" }), _jsx("span", { children: r.given || "(skipped)" })] }), _jsxs("span", { className: "qz-wrong-row right", children: [_jsx("span", { className: "qz-wrong-tag", children: "Correct" }), _jsx("span", { children: r.question.correct_answer })] }), r.question.explanation && (_jsxs("span", { className: "qz-wrong-row hint", children: [_jsx("span", { className: "qz-wrong-tag", children: "Why" }), _jsx("span", { children: r.question.explanation })] }))] })] }, r.question.id))) })] })), _jsxs("section", { className: "qz-result-block", children: [_jsx("header", { className: "qz-result-block-head", children: _jsx("h2", { children: "Recommended next steps" }) }), _jsxs("div", { className: "qz-next-grid", children: [_jsx(NextCard, { icon: _jsx(TargetIcon, { size: 16 }), title: "Review Wrong Answers", caption: "Step through what you missed.", onClick: onReview, disabled: wrong.length === 0 }), _jsx(NextCard, { icon: _jsx(FlashcardIcon, { size: 16 }), title: "Generate Flashcards from Mistakes", caption: `${wrong.length} ${wrong.length === 1 ? "card" : "cards"}`, onClick: () => void generateFlashcards(), busy: busy === "flash", disabled: wrong.length === 0 }), _jsx(NextCard, { icon: _jsx(CalendarIcon, { size: 16 }), title: "Add Weak Topics to Study Plan", caption: weakTopics.length > 0
                                                            ? `${weakTopics.length} topic${weakTopics.length === 1 ? "" : "s"}`
                                                            : "Schedule a review block", onClick: () => void addToStudyPlan(), busy: busy === "plan" }), _jsx(NextCard, { icon: _jsx(SparklesIcon, { size: 16 }), title: "Ask AI for Help", caption: cls ? `In ${cls.name}` : "Open class chat", onClick: () => {
                                                            if (cls)
                                                                setView({ kind: "classAsk", classId: cls.id });
                                                        }, disabled: !cls })] })] })] }), toast && _jsx("div", { className: "quiz-toast", children: toast })] })] }), _jsx(QuizDetailRail, { variant: "results", quizId: quiz.id, resultsStats: {
                    score,
                    total,
                    pct,
                    timeSpentSeconds: timeSpent,
                    weakTopics,
                }, onSummarizeWeakTopics: () => {
                    if (cls)
                        setView({ kind: "classAsk", classId: cls.id });
                }, onMakeReviewSet: () => void generateFlashcards(), onAskQuiz: () => {
                    if (cls)
                        setView({ kind: "classAsk", classId: cls.id });
                } })] }));
};
const ReviewView = ({ quiz, questions, cls, note, onBack }) => {
    const setView = useApp((s) => s.setView);
    const syncStatus = useApp((s) => s.syncStatus);
    const [latest, setLatest] = useState(null);
    const [toast, setToast] = useState(null);
    useEffect(() => {
        void quizAttemptsForQuiz(quiz.id).then((atts) => {
            setLatest(atts.find((a) => a.completed === 1) ?? null);
        });
    }, [quiz.id]);
    useEffect(() => {
        if (!toast)
            return;
        const id = window.setTimeout(() => setToast(null), 2400);
        return () => window.clearTimeout(id);
    }, [toast]);
    const wrong = useMemo(() => {
        if (!latest)
            return [];
        let parsed = {};
        try {
            parsed = JSON.parse(latest.answers_json);
        }
        catch {
            /* drop */
        }
        return questions.filter((q) => {
            const a = (parsed[q.id] ?? "").trim().toLowerCase();
            return a !== q.correct_answer.trim().toLowerCase();
        }).map((q) => ({ question: q, given: parsed[q.id] ?? "" }));
    }, [latest, questions]);
    async function turnIntoFlashcard(q) {
        try {
            const deck = await upsertFlashcardSet({
                title: `${quiz.title} · review cards`,
                note_id: quiz.note_id ?? null,
            });
            await upsertFlashcard({
                set_id: deck.id,
                front: q.question,
                back: q.correct_answer,
            });
            setToast("Added to flashcards.");
        }
        catch {
            setToast("Couldn't add to flashcards.");
        }
    }
    return (_jsxs(_Fragment, { children: [_jsxs("main", { className: "main", children: [_jsxs("div", { className: "topbar", children: [_jsxs("button", { className: "btn-ghost", onClick: onBack, children: [_jsx(ArrowLeftIcon, { size: 14 }), " Results"] }), _jsx("span", { style: { flex: 1 } }), _jsx(SyncPill, { status: syncStatus })] }), _jsxs("div", { className: "main-inner", children: [_jsxs("div", { className: "quiz-take-shell", children: [_jsxs("section", { className: "hero quiz-hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(Breadcrumb, { cls: cls, quiz: quiz, suffix: "Review" }), _jsxs("div", { className: "hero-greeting", children: [_jsx("h1", { className: "hero-headline", children: "Review missed questions" }), _jsx("p", { children: "Walk through each question you missed and turn it into a flashcard." })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_QUIZ_HERO_URL, alt: "", decoding: "async" }) })] }), wrong.length === 0 ? (_jsxs("div", { className: "qz-empty", children: [_jsx(CheckIcon, { size: 28 }), _jsx("p", { children: "No missed questions on the latest attempt \u2014 nice work." })] })) : (_jsx("ul", { className: "qz-review-list", children: wrong.map((r, i) => (_jsxs("li", { className: "qz-review-item", children: [_jsxs("header", { className: "qz-review-head", children: [_jsxs("span", { className: "qz-review-eyebrow", children: ["Missed ", i + 1, " of ", wrong.length] }), r.question.topic && (_jsx("span", { className: "rail-chip rail-chip-rose", children: r.question.topic }))] }), _jsx("p", { className: "qz-review-question", children: r.question.question }), _jsxs("div", { className: "qz-review-rows", children: [_jsxs("span", { className: "qz-wrong-row wrong", children: [_jsx("span", { className: "qz-wrong-tag", children: "Your answer" }), _jsx("span", { children: r.given || "(skipped)" })] }), _jsxs("span", { className: "qz-wrong-row right", children: [_jsx("span", { className: "qz-wrong-tag", children: "Correct" }), _jsx("span", { children: r.question.correct_answer })] }), r.question.explanation && (_jsxs("span", { className: "qz-wrong-row hint", children: [_jsx("span", { className: "qz-wrong-tag", children: "Why" }), _jsx("span", { children: r.question.explanation })] }))] }), _jsxs("div", { className: "qz-review-actions", children: [_jsxs("button", { type: "button", className: "btn-secondary", onClick: () => {
                                                                if (note)
                                                                    setView({ kind: "note", noteId: note.id });
                                                            }, disabled: !note, children: [_jsx(NoteIcon, { size: 12 }), " Open source note"] }), _jsxs("button", { type: "button", className: "btn-primary", onClick: () => void turnIntoFlashcard(r.question), children: [_jsx(FlashcardIcon, { size: 12 }), " Turn into flashcard"] })] })] }, r.question.id))) }))] }), toast && _jsx("div", { className: "quiz-toast", children: toast })] })] }), _jsx(QuizDetailRail, { variant: "results", quizId: quiz.id })] }));
};
const Breadcrumb = ({ cls, quiz, suffix }) => {
    const setView = useApp((s) => s.setView);
    return (_jsxs("div", { className: "qz-breadcrumb", "aria-label": "Breadcrumb", children: [_jsx("button", { type: "button", className: "qz-breadcrumb-link", onClick: () => setView({ kind: "quizzes" }), children: "Quizzes" }), _jsx("span", { "aria-hidden": true, children: " / " }), cls ? (_jsx("button", { type: "button", className: "qz-breadcrumb-link", onClick: () => setView({ kind: "classView", classId: cls.id }), children: cls.name })) : (_jsx("span", { children: "Library" })), _jsx("span", { "aria-hidden": true, children: " / " }), _jsx("span", { children: suffix ? `${quiz.title} · ${suffix}` : quiz.title })] }));
};
const MetaChips = ({ cls, quiz, total, index, syncStatus }) => {
    const tone = cls ? toneFor(cls) : "sage";
    return (_jsxs("div", { className: "qz-meta-chips", children: [_jsx("span", { className: `qz-meta-chip tone-${tone}`, children: cls ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "qz-meta-chip-icon", children: iconFor(cls, 14) }), _jsx("span", { children: cls.name })] })) : (_jsxs(_Fragment, { children: [_jsx(QuizIcon, { size: 14 }), _jsx("span", { children: "Library" })] })) }), _jsxs("span", { className: "qz-meta-chip tone-sage", children: [_jsx(BookmarkIcon, { size: 14 }), _jsx("span", { children: quiz.title })] }), _jsxs("span", { className: "qz-meta-chip tone-sky", children: [_jsx(QuizIcon, { size: 14 }), _jsxs("span", { children: [total, " questions"] })] }), _jsxs("span", { className: "qz-meta-chip tone-lilac", children: [_jsx(ArrowRightIcon, { size: 14 }), _jsxs("span", { children: ["Question ", Math.min(index + 1, Math.max(1, total)), " of ", total] })] }), _jsxs("span", { className: `qz-meta-chip tone-${syncStatus === "offline" ? "rose" : "sage"}`, children: [syncStatus === "offline" ? (_jsx(CloudOffIcon, { size: 14 })) : (_jsx(CloudCheckIcon, { size: 14 })), _jsx("span", { children: syncStatus === "offline" ? "Offline" : "Synced" })] })] }));
};
const QuestionCard = ({ question, index, total, given, shortInput, setShortInput, onSelect, showFeedback, }) => {
    const correct = question.correct_answer.trim().toLowerCase();
    function optClasses(value) {
        const out = ["qz-option"];
        const norm = value.trim().toLowerCase();
        const sel = (given ?? "").trim().toLowerCase();
        if (sel === norm)
            out.push("active");
        if (showFeedback) {
            if (norm === correct)
                out.push("correct");
            else if (sel === norm)
                out.push("wrong");
        }
        return out.join(" ");
    }
    return (_jsxs("div", { className: "qz-question-card", children: [_jsxs("span", { className: "qz-question-eyebrow", children: ["Question ", index + 1, " of ", total] }), _jsx("h2", { className: "qz-question-prompt", children: question.question }), _jsx("p", { className: "qz-question-helper", children: question.type === "short_answer"
                    ? "Type your answer in your own words."
                    : question.type === "true_false"
                        ? "Pick true or false."
                        : "Select the best answer." }), question.type === "multiple_choice" && (_jsx("div", { className: "qz-options", children: parseOptions(question.options_json).map((opt, i) => (_jsxs("button", { type: "button", className: optClasses(opt), onClick: () => onSelect(opt), disabled: showFeedback, children: [_jsx("span", { className: "qz-option-letter", children: String.fromCharCode(65 + i) }), _jsx("span", { className: "qz-option-text", children: opt })] }, `${question.id}-${i}`))) })), question.type === "true_false" && (_jsx("div", { className: "qz-options", children: ["true", "false"].map((opt, i) => (_jsxs("button", { type: "button", className: optClasses(opt), onClick: () => onSelect(opt), disabled: showFeedback, children: [_jsx("span", { className: "qz-option-letter", children: String.fromCharCode(65 + i) }), _jsx("span", { className: "qz-option-text", style: { textTransform: "capitalize" }, children: opt })] }, opt))) })), question.type === "short_answer" && (_jsx("textarea", { className: "qz-short-input field", rows: 3, value: shortInput, onChange: (e) => setShortInput(e.target.value), placeholder: "Type your answer here\u2026", disabled: showFeedback })), showFeedback && (_jsxs("div", { className: `qz-feedback ${(given ?? "").trim().toLowerCase() === correct ? "correct" : "wrong"}`, children: [(given ?? "").trim().toLowerCase() === correct ? (_jsxs(_Fragment, { children: [_jsx(CheckIcon, { size: 14 }), _jsx("span", { children: "Correct." })] })) : (_jsxs(_Fragment, { children: [_jsx(WarningIcon, { size: 14 }), _jsxs("span", { children: ["Correct answer: ", _jsx("strong", { children: question.correct_answer })] })] })), question.explanation && (_jsx("p", { className: "qz-feedback-explain", children: question.explanation }))] }))] }));
};
const HelperCard = ({ title, icon, children, }) => (_jsxs("div", { className: "qz-helper-card", children: [_jsxs("header", { className: "qz-helper-head", children: [_jsx("span", { className: "qz-helper-icon", children: icon }), _jsx("h3", { children: title })] }), _jsx("div", { className: "qz-helper-body", children: children })] }));
const KvStat = ({ label, value }) => (_jsxs("div", { className: "qz-kv-stat", children: [_jsx("span", { className: "qz-kv-value", children: value }), _jsx("span", { className: "qz-kv-label", children: label })] }));
const QuickButton = ({ icon, label, onClick, disabled }) => (_jsxs("button", { type: "button", className: "qz-quick-btn", onClick: onClick, disabled: disabled, children: [_jsx("span", { className: "qz-quick-btn-icon", children: icon }), _jsx("span", { children: label })] }));
const NextCard = ({ icon, title, caption, onClick, busy, disabled }) => (_jsxs("button", { type: "button", className: "qz-next-card", onClick: onClick, disabled: busy || disabled, children: [_jsx("span", { className: "qz-next-icon", children: icon }), _jsxs("span", { className: "qz-next-text", children: [_jsx("span", { className: "qz-next-title", children: busy ? "Working…" : title }), _jsx("span", { className: "qz-next-caption", children: caption })] }), _jsx(ArrowRightIcon, { size: 12 })] }));
const SyncPill = ({ status }) => (_jsxs("span", { className: `pill ${status === "offline" ? "pill-rose" : "pill-sage"}`, style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [status === "offline" ? _jsx(CloudOffIcon, { size: 12 }) : _jsx(CloudCheckIcon, { size: 12 }), _jsx("span", { style: { textTransform: "capitalize" }, children: status })] }));
/* ============================================================ */
/* Helpers                                                      */
/* ============================================================ */
function parseOptions(json) {
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
function fmtMinSec(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0)
        return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0)
        return `${s}s`;
    if (s === 0)
        return `${m} min`;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
}
/** Read a question aloud via the browser's speech synthesis. Stubs out
 *  cleanly when the API isn't available (Electron renderer should have
 *  it, but tests / future Linux distros may not). */
function speak(text) {
    if (typeof window === "undefined" || !window.speechSynthesis)
        return;
    try {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 1.0;
        window.speechSynthesis.speak(utt);
    }
    catch {
        /* drop */
    }
}
//# sourceMappingURL=Quiz.js.map