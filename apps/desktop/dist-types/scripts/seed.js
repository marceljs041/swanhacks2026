/**
 * Seed the local desktop SQLite with realistic demo data:
 *  - 1 class (COM S 309)
 *  - 3 notes with substantive content
 *  - 1 flashcard set with 5 cards
 *  - 1 quiz with 3 questions
 *  - 1 study plan with this-week tasks
 *  - A few XP events so the streak shows nonzero
 *
 * Run with: pnpm --filter ./apps/desktop seed
 */
import { recordXp, upsertClass, upsertFlashcard, upsertFlashcardSet, upsertNote, upsertQuiz, upsertQuizQuestion, upsertStudyPlan, upsertStudyTask, } from "../src/db/repositories.js";
import { XP_RULES } from "@studynest/shared";
async function main() {
    console.log("Seeding Note Goat demo data…");
    const cls = await upsertClass({ name: "COM S 309", code: "Software Eng", color: "#8B5CF6" });
    const notes = await Promise.all([
        upsertNote({
            class_id: cls.id,
            title: "Lecture 1: Requirements engineering",
            content_markdown: `# Requirements engineering

Requirements engineering is the process of defining, documenting, and maintaining the
needs of stakeholders for a software system.

## Functional vs non-functional
- **Functional requirements** describe what the system must do (e.g. "users can log in").
- **Non-functional requirements** describe qualities (performance, availability, security).

## Elicitation techniques
- Interviews
- Surveys
- Observation
- Workshops

## Why it matters
Bad requirements are the #1 cause of project failure. The cost of fixing a defect grows
roughly 10x at every stage downstream of where it could have been caught.`,
        }),
        upsertNote({
            class_id: cls.id,
            title: "Lecture 2: Software architecture",
            content_markdown: `# Software architecture

Architecture is the set of structures needed to reason about a system: software elements,
their relations, and their properties.

## Common styles
- Layered (N-tier)
- Client-server
- Event-driven
- Microservices
- Pipe and filter

## Quality attributes
Architectural decisions trade off attributes like modifiability, performance, security,
and testability. There is no "best" architecture — only one best for a context.

## Documentation
Capture views: module view (code), component-and-connector view (runtime), allocation view
(deployment).`,
        }),
        upsertNote({
            class_id: cls.id,
            title: "Exam 1 review notes",
            content_markdown: `# Exam 1 review

## Topics
1. Requirements engineering
2. Software architecture
3. Agile vs waterfall

## Key terms
- **MoSCoW**: Must, Should, Could, Won't.
- **SOLID**: principles of OO design.
- **CAP theorem**: Consistency, Availability, Partition tolerance — pick two.`,
        }),
    ]);
    const set = await upsertFlashcardSet({
        note_id: notes[0].id,
        title: "Requirements — flashcards",
    });
    const cards = [
        ["What is a functional requirement?", "Something the system must do, e.g. user login."],
        [
            "What is a non-functional requirement?",
            "A quality attribute like performance, availability, or security.",
        ],
        ["Name three elicitation techniques.", "Interviews, surveys, observation."],
        [
            "Why catch defects early?",
            "Cost of fixing grows roughly 10x at every downstream stage.",
        ],
        ["What does MoSCoW stand for?", "Must, Should, Could, Won't."],
    ];
    for (const [front, back] of cards) {
        await upsertFlashcard({ set_id: set.id, front: front, back: back });
    }
    const quiz = await upsertQuiz({ note_id: notes[1].id, title: "Architecture — quiz" });
    await upsertQuizQuestion({
        quiz_id: quiz.id,
        type: "multiple_choice",
        question: "Which is NOT a common architectural style?",
        options_json: JSON.stringify(["Layered", "Microservices", "Recursive merge", "Event-driven"]),
        correct_answer: "Recursive merge",
        explanation: "Recursive merge is a database technique, not an architectural style.",
    });
    await upsertQuizQuestion({
        quiz_id: quiz.id,
        type: "true_false",
        question: "There is one objectively best architecture for any system.",
        correct_answer: "false",
        explanation: "Architecture trades off quality attributes — context drives the choice.",
    });
    await upsertQuizQuestion({
        quiz_id: quiz.id,
        type: "multiple_choice",
        question: "Which view captures runtime structures?",
        options_json: JSON.stringify(["Module", "Component-and-connector", "Allocation", "Source"]),
        correct_answer: "Component-and-connector",
        explanation: "Module view = code; allocation = deployment; C&C = runtime.",
    });
    const plan = await upsertStudyPlan({ title: "Exam 1 prep", class_id: cls.id });
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        await upsertStudyTask({
            plan_id: plan.id,
            title: i === 0
                ? "Review requirements engineering"
                : i === 1
                    ? "Architecture flashcards"
                    : i === 2
                        ? "Take Architecture quiz"
                        : i === 3
                            ? "Cram sheet for weak topics"
                            : "Final 10-minute recap",
            type: i === 1 ? "flashcards" : i === 2 ? "quiz" : "review",
            scheduled_for: d.toISOString(),
            duration_minutes: 30,
            note_id: notes[i % notes.length].id,
        });
    }
    // Backdate a few XP events so the streak shows 3 days.
    for (let i = 0; i < 3; i++) {
        await recordXp("createNote", XP_RULES.createNote);
    }
    console.log("Seed complete. Open the app and explore.");
    process.exit(0);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map