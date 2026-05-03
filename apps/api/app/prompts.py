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


ASK_SYSTEM = (
    "You are StudyNest, a careful study tutor. You answer ONLY from the "
    "student's own class notes that are provided in each request. "
    "Always respond with VALID JSON only — no prose, no markdown fences, "
    "no commentary. The JSON must match the schema in the user's request "
    "exactly."
)


def ask_class_prompt(
    *,
    class_name: str,
    class_subtitle: str | None,
    recent_notes: list[dict],
    weak_topics: list[str],
    history: list[dict],
    question: str,
) -> dict[str, str]:
    """Multi-turn chat prompt scoped to a single class. The model is told
    that the supplied notes are the *only* source of truth — anything not
    present must be acknowledged as missing, and any contradiction
    between the user and the notes must surface the note's wording.

    We send each note's title + summary + a truncated content body so the
    model can ground answers in the user's own words even when summaries
    don't exist yet. Output is a small JSON envelope so the UI can render
    a memory-trick callout and link cited notes back to the library.
    """

    if recent_notes:
        notes_block_lines: list[str] = []
        for n in recent_notes[:6]:
            note_id = n.get("note_id", "?")
            title = n.get("title", "Untitled")
            summary = (n.get("summary") or "").strip()
            content = (n.get("content") or "").strip()
            parts = [f"NOTE [{note_id}] — {title}"]
            if summary:
                parts.append(f"  Summary: {summary}")
            if content:
                parts.append(f"  Content:\n{_truncate(content, 2200)}")
            if not summary and not content:
                parts.append("  (no body recorded yet)")
            notes_block_lines.append("\n".join(parts))
        notes_block = "\n\n".join(notes_block_lines)
    else:
        notes_block = "(NO NOTES ATTACHED — the student has not added any notes for this class yet.)"

    weak_block = ", ".join(weak_topics[:6]) or "(none surfaced)"

    history_block = (
        "\n".join(
            f"{m.get('role', 'user').upper()}: "
            f"{_truncate(m.get('content', ''), 800)}"
            for m in history[-8:]
        )
        or "(start of conversation)"
    )

    subtitle = f" ({class_subtitle})" if class_subtitle else ""
    return {
        "system": ASK_SYSTEM,
        "user": (
            f"You are tutoring a student on their class \"{class_name}\"{subtitle}.\n\n"
            "STRICT GROUNDING RULES — follow exactly:\n"
            "1. The NOTES below are the ONLY source of truth about this "
            "class. Treat them as the syllabus, professor, and textbook "
            "combined.\n"
            "2. NEVER invent facts about this class from general "
            "knowledge or from the class name. The class name is just "
            "a label — it does NOT tell you what's in the course.\n"
            "3. If the question can be answered from the notes, answer "
            "from them and cite the relevant NOTE id(s) in "
            "`related_note_ids`.\n"
            "4. If the notes do NOT cover the question, say so plainly "
            "(e.g. \"I don't see this in your notes for this class\") "
            "and suggest what the student could add or which note to "
            "open. Do NOT fabricate a generic answer.\n"
            "5. If the student's message contradicts something in the "
            "notes, gently point out the mismatch, quote or paraphrase "
            "what the note actually says, and cite the note id.\n"
            "6. If general knowledge would genuinely help (e.g. clarifying a "
            "term used in the notes), prefix that part with \"From general "
            "knowledge:\" so the student knows it's not from their material.\n"
            "7. If there are zero notes attached, your answer must say "
            "you have no notes to ground in and ask the student to add "
            "one — do NOT guess.\n\n"
            f"NOTES FOR THIS CLASS (authoritative):\n{notes_block}\n\n"
            f"Topics the student has flagged as weak: {weak_block}\n\n"
            f"Conversation so far:\n{history_block}\n\n"
            f"STUDENT'S NEW MESSAGE:\n{_truncate(question, 2000)}\n\n"
            "Respond with JSON matching this schema:\n"
            '{\n  "answer": "string (markdown-light, 2-6 short paragraphs '
            "or a tight bullet list; cite note ids inline like (nt_…) when "
            "you reference a note)\",\n"
            '  "memory_trick": "string or null (one-line mnemonic, only if '
            "directly supported by the notes)\",\n"
            '  "related_note_ids": ["note_id", ...]  // ids you actually used; '
            "empty array if the answer is not grounded in any note\n}"
        ),
    }


def class_overview_prompt(
    *,
    class_name: str,
    class_subtitle: str | None,
    notes: list[dict],
) -> dict[str, str]:
    """One short overview paragraph from all supplied notes (titles + bodies).
    Uses every note in `notes` up to a practical limit — callers truncate each body."""
    lines: list[str] = []
    max_notes = 48
    per_note = 1400
    for n in notes[:max_notes]:
        note_id = n.get("note_id", "?")
        title = n.get("title", "Untitled")
        summary = (n.get("summary") or "").strip()
        content = (n.get("content") or "").strip()
        parts = [f"NOTE [{note_id}] — {title}"]
        if summary:
            parts.append(f"  Summary: {summary}")
        if content:
            parts.append(f"  Content:\n{_truncate(content, per_note)}")
        if not summary and not content:
            parts.append("  (empty)")
        lines.append("\n".join(parts))
    notes_block = (
        "\n\n".join(lines)
        if lines
        else "(NO NOTES — student has not added material for this class yet.)"
    )
    subtitle = f" ({class_subtitle})" if class_subtitle else ""
    return {
        "system": SYSTEM,
        "user": (
            f"The student is studying \"{class_name}\"{subtitle}.\n\n"
            "Below are their notes for this class (each body may be truncated). "
            "Write ONE cohesive overview paragraph using ONLY information that appears "
            "in these notes. "
            "Target length: 3–5 sentences — informative but concise. "
            "Plain prose only: no title line, no bullet list, no markdown headings, "
            "no greeting, no phrases like \"based on your notes\". "
            "If there is not enough in the notes to describe the course, say so in one or two sentences.\n\n"
            f"NOTES:\n{notes_block}\n\n"
            'Respond with JSON matching this schema:\n'
            '{\n  "overview": "string"\n}'
        ),
    }


AUDIO_NOTES_SYSTEM = (
    "You are StudyNest's audio note-taker. The user has just shared a "
    "recording broken into ordered 30-second audio chunks. Your job is to "
    "listen to ALL of them in order, treating them as one continuous "
    "recording (a lecture, a study session, a memo), and then produce "
    "structured study notes. "
    "Always respond with VALID JSON only — no prose, no markdown fences, "
    "no commentary. The JSON must match the schema in the user's request "
    "exactly."
)


def audio_notes_intro_text(*, total_chunks: int, total_seconds: float) -> str:
    """First text block in the multimodal user turn. Tells Gemma the chunks
    are coming, that they're in order, and how long the recording is."""
    return (
        f"I'm sending you {total_chunks} consecutive ~30-second audio "
        f"chunks (about {total_seconds:.0f}s total) from a single recording. "
        "Listen to ALL of them in order before responding — they form one "
        "continuous audio. After the last chunk you'll see a final "
        "instruction asking you to write the notes."
    )


def audio_notes_finalize_text(*, title_hint: str | None) -> str:
    """Last text block in the multimodal user turn — the "now make the
    notes" prompt. Gemma generates one JSON object summarising everything
    it heard across all chunks."""
    hint = ""
    if title_hint and title_hint.strip():
        hint = (
            f"\n\nThe recording is currently provisionally titled "
            f"\"{title_hint.strip()}\". Pick a better short title if the "
            "audio suggests one, otherwise reuse the hint."
        )
    return (
        "That was the last chunk. Now write study notes for the FULL "
        "recording you just heard.\n\n"
        "Requirements:\n"
        "- `title` is 3–8 words, no quotes, no trailing punctuation.\n"
        "- `summary` is 2–3 sentences capturing the main idea.\n"
        "- `content_markdown` is the body of a study note: short intro "
        "paragraph, then 4–10 bullet points or a couple of small "
        "subsections (`### Heading`) covering the substantive content. "
        "Use plain markdown — no front-matter, no code fences, no images.\n"
        "- `key_terms` lists 3–6 concepts that appeared in the audio with "
        "1-sentence definitions in the user's words where possible.\n"
        "- If the audio is silent / unintelligible, say so honestly in "
        "`summary` and keep `content_markdown` brief; do NOT invent "
        "content."
        f"{hint}\n\n"
        "Respond with JSON matching this schema:\n"
        "{\n"
        '  "title": "string",\n'
        '  "summary": "string",\n'
        '  "content_markdown": "string",\n'
        '  "key_terms": [{"term": "string", "definition": "string"}]\n'
        "}"
    )


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
