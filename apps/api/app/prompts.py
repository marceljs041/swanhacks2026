"""Python copy of packages/prompts. Kept in sync manually for the
hackathon — both runtimes serialize the same shape so we accept the
duplication."""

from __future__ import annotations

SYSTEM = (
    "You are StudyNest, an AI study assistant. Always respond with VALID JSON only — "
    "no prose, no markdown fences, no commentary. The JSON must match the schema "
    "in the user's request exactly."
)


def _truncate(s: str, n: int = 6000) -> str:
    return s if len(s) <= n else s[:n] + "\n\n[truncated]"


def summarize_prompt(*, title: str, content: str) -> dict[str, str]:
    return {
        "system": SYSTEM,
        "user": (
            f"Summarize this note in 3-5 sentences and extract 5 key terms.\n\n"
            f"Title: {title}\n\nContent:\n{_truncate(content)}\n\n"
            'Respond with JSON matching this schema:\n'
            '{\n  "summary": "string",\n  "key_terms": [{"term": "string", "definition": "string"}]\n}'
        ),
    }


def flashcards_prompt(*, title: str, content: str, count: int = 10) -> dict[str, str]:
    return {
        "system": SYSTEM,
        "user": (
            f"Create {count} high-quality study flashcards from this note. "
            "Front = a question or term. Back = a concise answer or definition.\n\n"
            f"Title: {title}\n\nContent:\n{_truncate(content)}\n\n"
            'Respond with JSON matching this schema:\n'
            '{\n  "cards": [{"front": "string", "back": "string"}]\n}'
        ),
    }


def quiz_prompt(
    *, title: str, content: str, count: int = 5, types: list[str] | None = None
) -> dict[str, str]:
    types = types or ["multiple_choice", "true_false"]
    return {
        "system": SYSTEM,
        "user": (
            f"Create a quiz of {count} questions from this note. "
            f"Allowed question types: {', '.join(types)}. Always include the correct "
            "answer and a 1-sentence explanation.\n\n"
            f"Title: {title}\n\nContent:\n{_truncate(content)}\n\n"
            'Respond with JSON matching this schema:\n'
            '{\n  "questions": [\n'
            '    {"type": "multiple_choice", "question": "string", '
            '"options": ["a","b","c","d"], "answer": "string", "explanation": "string"},\n'
            '    {"type": "true_false", "question": "string", '
            '"answer": "true", "explanation": "string"}\n'
            "  ]\n}"
        ),
    }


def study_plan_prompt(
    *,
    goal: str,
    exam_date: str | None,
    notes: list[dict],
    days: int = 7,
) -> dict[str, str]:
    note_list = (
        "\n".join(
            f"- ({n.get('id', '?')}) {n.get('title', 'Untitled')}"
            f"{' — ' + n['summary'] if n.get('summary') else ''}"
            for n in notes
        )
        or "(no notes)"
    )
    return {
        "system": SYSTEM,
        "user": (
            "Create a daily study plan.\n\n"
            f"Goal: {goal}\nExam date: {exam_date or 'none'}\nDays available: {days}\n\n"
            f"Notes:\n{note_list}\n\n"
            "Distribute review/flashcards/quiz/practice tasks across the available days, "
            "building toward the exam. Use 20-45 minute task durations.\n\n"
            'Respond with JSON matching this schema:\n'
            '{\n  "tasks": [\n'
            '    {"title": "string", "scheduled_for": "YYYY-MM-DD", '
            '"duration_minutes": 30, "type": "review", "note_id": "string or null"}\n'
            "  ]\n}"
        ),
    }


def simple_explain_prompt(
    *, title: str, content: str, audience: str = "highschool"
) -> dict[str, str]:
    return {
        "system": SYSTEM,
        "user": (
            f"Explain this note in simple terms for a {audience} audience.\n\n"
            f"Title: {title}\n\nContent:\n{_truncate(content)}\n\n"
            'Respond with JSON matching this schema:\n'
            '{\n  "summary": "string",\n  "key_terms": [{"term": "string", "definition": "string"}]\n}'
        ),
    }
