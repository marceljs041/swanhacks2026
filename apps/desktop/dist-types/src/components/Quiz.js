import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { listQuizQuestions, recordQuizAttempt, recordXp } from "../db/repositories.js";
import { useApp } from "../store.js";
import { XP_RULES } from "@studynest/shared";
import { Card } from "./ui/Card.js";
import { ChevLeftIcon } from "./icons.js";
export const Quiz = ({ quizId }) => {
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState(null);
    const setView = useApp((s) => s.setView);
    useEffect(() => {
        void listQuizQuestions(quizId).then(setQuestions);
        setAnswers({});
        setSubmitted(null);
    }, [quizId]);
    function answer(qid, value) {
        setAnswers((a) => ({ ...a, [qid]: value }));
    }
    async function submit() {
        const score = questions.reduce((acc, q) => {
            const a = answers[q.id]?.trim().toLowerCase();
            const correct = q.correct_answer.trim().toLowerCase();
            return acc + (a === correct ? 1 : 0);
        }, 0);
        const total = questions.length;
        setSubmitted({ score, total });
        await recordQuizAttempt({ quiz_id: quizId, score, total, answers });
        await recordXp("completeQuiz", XP_RULES.completeQuiz);
        if (total > 0 && score === total) {
            await recordXp("perfectQuizBonus", XP_RULES.perfectQuizBonus);
        }
    }
    return (_jsxs("main", { className: "main", children: [_jsx("div", { className: "topbar", children: _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [_jsxs("button", { className: "btn-ghost", onClick: () => setView({ kind: "quizzes" }), children: [_jsx(ChevLeftIcon, { size: 14 }), " Quizzes"] }), _jsx("span", { style: { flex: 1 } }), submitted && (_jsxs("span", { className: "pill", style: { background: "var(--color-primarySoft)", color: "var(--color-primaryStrong)" }, children: ["Score: ", submitted.score, " / ", submitted.total] }))] }) }), _jsxs("div", { className: "main-inner", style: { maxWidth: 760 }, children: [questions.map((q, i) => {
                        const opts = q.options_json ? JSON.parse(q.options_json) : [];
                        const userAnswer = answers[q.id];
                        const isCorrect = submitted && userAnswer?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
                        return (_jsxs(Card, { children: [_jsxs("div", { style: { fontWeight: 600, fontSize: 14 }, children: [i + 1, ". ", q.question] }), _jsxs("div", { style: { marginTop: 4, display: "grid", gap: 8 }, children: [q.type === "multiple_choice" &&
                                            opts.map((o) => (_jsxs("label", { style: {
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    padding: "8px 10px",
                                                    borderRadius: "var(--radius-md)",
                                                    border: "1px solid var(--color-border)",
                                                    cursor: "pointer",
                                                    background: userAnswer === o ? "var(--color-primarySoft)" : "transparent",
                                                }, children: [_jsx("input", { type: "radio", name: q.id, checked: userAnswer === o, onChange: () => answer(q.id, o), disabled: !!submitted }), _jsx("span", { children: o })] }, o))), q.type === "true_false" &&
                                            ["true", "false"].map((o) => (_jsxs("label", { style: {
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    padding: "8px 10px",
                                                    borderRadius: "var(--radius-md)",
                                                    border: "1px solid var(--color-border)",
                                                    cursor: "pointer",
                                                    background: userAnswer === o ? "var(--color-primarySoft)" : "transparent",
                                                }, children: [_jsx("input", { type: "radio", name: q.id, checked: userAnswer === o, onChange: () => answer(q.id, o), disabled: !!submitted }), _jsx("span", { style: { textTransform: "capitalize" }, children: o })] }, o)))] }), submitted && (_jsxs("div", { style: {
                                        fontSize: 13,
                                        color: isCorrect ? "var(--color-success)" : "var(--color-danger)",
                                    }, children: [isCorrect ? "Correct" : `Correct answer: ${q.correct_answer}`, q.explanation && (_jsx("div", { style: { color: "var(--color-textMuted)", marginTop: 4 }, children: q.explanation }))] }))] }, q.id));
                    }), !submitted && questions.length > 0 && (_jsx("button", { className: "btn-primary", style: { alignSelf: "flex-start" }, onClick: () => void submit(), children: "Submit answers" })), questions.length === 0 && (_jsx("div", { className: "empty", children: "No questions in this quiz yet." }))] })] }));
};
//# sourceMappingURL=Quiz.js.map