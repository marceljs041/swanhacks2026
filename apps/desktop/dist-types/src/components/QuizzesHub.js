import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { listQuizzes } from "../db/repositories.js";
import { useApp } from "../store.js";
import { Card } from "./ui/Card.js";
import { Donut } from "./ui/ProgressRing.js";
import { Placeholder } from "./ui/Placeholder.js";
import { ArrowRightIcon, QuizIcon, SearchIcon } from "./icons.js";
export const QuizzesHub = () => {
    const setView = useApp((s) => s.setView);
    const [quizzes, setQuizzes] = useState([]);
    useEffect(() => {
        void listQuizzes(null).then(setQuizzes);
    }, []);
    return (_jsxs("main", { className: "main", children: [_jsx("div", { className: "topbar", children: _jsxs("label", { className: "search", children: [_jsx("span", { className: "search-icon", children: _jsx(SearchIcon, { size: 16 }) }), _jsx("input", { type: "search", placeholder: "Search quizzes...", "aria-label": "Search quizzes" })] }) }), _jsxs("div", { className: "main-inner", children: [_jsxs("div", { className: "page-header", children: [_jsx("h1", { children: "Quizzes" }), _jsxs("span", { className: "pill", children: [quizzes.length, " total"] }), _jsx("span", { className: "spacer" })] }), _jsxs("div", { className: "dash-row cols-2", children: [_jsx(Card, { title: "Average Score", icon: _jsx(QuizIcon, { size: 18 }), children: _jsxs("div", { className: "donut-card", children: [_jsxs(Donut, { segments: [
                                                { value: 68, color: "var(--color-accentSky)" },
                                                { value: 32, color: "var(--color-surfaceMuted)" },
                                            ], size: 104, thickness: 12, children: [_jsx("span", { className: "donut-num", children: "68%" }), _jsx("span", { className: "donut-unit", children: "average" })] }), _jsx("div", { style: { fontSize: 12, color: "var(--color-textMuted)", lineHeight: 1.5 }, children: "Aggregate stats are placeholder while we wire up the quiz_attempts query." })] }) }), _jsx(Card, { title: "Adaptive Difficulty", children: _jsx(Placeholder, { title: "Adaptive quizzes not yet implemented", description: "Once on, Note Goat will pick harder questions for topics you nail and easier ones for topics you miss." }) })] }), _jsx(Card, { title: "Your Quizzes", action: "more", children: quizzes.length === 0 ? (_jsx(Placeholder, { icon: _jsx(QuizIcon, { size: 22 }), title: "No quizzes yet", description: "Open any note and tap \u201CGenerate quiz\u201D to make a quiz from it." })) : (_jsx("div", { className: "recent-notes", children: quizzes.map((q) => (_jsxs("div", { className: "recent-row", style: { gridTemplateColumns: "18px 1fr auto" }, onClick: () => setView({ kind: "quiz", quizId: q.id }), children: [_jsx(QuizIcon, { size: 14 }), _jsx("span", { className: "recent-title", children: q.title }), _jsxs("span", { className: "recent-when", children: ["Take ", _jsx(ArrowRightIcon, { size: 11 })] })] }, q.id))) })) })] })] }));
};
//# sourceMappingURL=QuizzesHub.js.map