"""Cloud AI fallback. Used by mobile and as a backup when the desktop
sidecar is unavailable. Tries Gemini → OpenAI → a deterministic local
template generator (so the demo never breaks).
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.config import get_settings
from app.prompts import (
    ask_class_prompt,
    class_overview_prompt,
    flashcards_prompt,
    quiz_prompt,
    simple_explain_prompt,
    study_plan_prompt,
    summarize_prompt,
)


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _parse_json(raw: str) -> dict[str, Any]:
    cleaned = _strip_code_fences(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find the first {...} block.
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise


async def _call_gemini(system: str, user: str) -> str | None:
    key = get_settings().gemini_api_key
    if not key:
        return None
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.0-flash:generateContent?key=" + key
    )
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.3},
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, json=body)
        r.raise_for_status()
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def _call_openai(system: str, user: str) -> str | None:
    key = get_settings().openai_api_key
    if not key:
        return None
    url = "https://api.openai.com/v1/chat/completions"
    body = {
        "model": "gpt-4o-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.3,
    }
    headers = {"Authorization": f"Bearer {key}"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, json=body, headers=headers)
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"]


async def _generate_json(system: str, user: str) -> dict[str, Any]:
    for fn in (_call_gemini, _call_openai):
        try:
            raw = await fn(system, user)
            if raw:
                return _parse_json(raw)
        except Exception:
            continue
    raise RuntimeError("no_cloud_ai_provider_configured")


# ---------- Public API ----------


async def summarize(*, title: str, content: str) -> dict[str, Any]:
    p = summarize_prompt(title=title, content=content)
    try:
        return await _generate_json(p["system"], p["user"])
    except Exception:
        return _fallback_summary(title, content)


async def flashcards(*, title: str, content: str, count: int = 10) -> dict[str, Any]:
    p = flashcards_prompt(title=title, content=content, count=count)
    try:
        return await _generate_json(p["system"], p["user"])
    except Exception:
        return _fallback_flashcards(title, content, count)


async def quiz(
    *, title: str, content: str, count: int = 5, types: list[str] | None = None
) -> dict[str, Any]:
    p = quiz_prompt(title=title, content=content, count=count, types=types)
    try:
        return await _generate_json(p["system"], p["user"])
    except Exception:
        return _fallback_quiz(title, content, count)


async def study_plan(
    *,
    goal: str,
    exam_date: str | None,
    notes: list[dict[str, Any]],
    days_available: int = 7,
) -> dict[str, Any]:
    p = study_plan_prompt(goal=goal, exam_date=exam_date, notes=notes, days=days_available)
    try:
        return await _generate_json(p["system"], p["user"])
    except Exception:
        return _fallback_study_plan(notes, days_available)


async def explain_simple(
    *, title: str, content: str, audience: str = "highschool"
) -> dict[str, Any]:
    p = simple_explain_prompt(title=title, content=content, audience=audience)
    try:
        return await _generate_json(p["system"], p["user"])
    except Exception:
        return _fallback_summary(title, content)


async def ask_class(
    *,
    class_name: str,
    class_subtitle: str | None,
    recent_notes: list[dict[str, Any]],
    weak_topics: list[str],
    history: list[dict[str, Any]],
    question: str,
) -> dict[str, Any]:
    p = ask_class_prompt(
        class_name=class_name,
        class_subtitle=class_subtitle,
        recent_notes=recent_notes,
        weak_topics=weak_topics,
        history=history,
        question=question,
    )
    try:
        return await _generate_json(p["system"], p["user"])
    except Exception:
        return _fallback_ask(class_name, recent_notes, question)


async def class_overview(
    *,
    class_name: str,
    class_subtitle: str | None,
    notes: list[dict[str, Any]],
) -> dict[str, Any]:
    p = class_overview_prompt(
        class_name=class_name,
        class_subtitle=class_subtitle,
        notes=notes,
    )
    try:
        return await _generate_json(p["system"], p["user"])
    except Exception:
        return _fallback_class_overview(class_name, notes)


# ---------- Deterministic fallbacks (so demos never blow up) ----------


def _first_sentences(text: str, n: int = 3) -> str:
    sents = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(sents[:n])


def _fallback_summary(title: str, content: str) -> dict[str, Any]:
    return {
        "summary": _first_sentences(content, 3) or f"Notes about {title}.",
        "key_terms": [],
    }


def _fallback_flashcards(title: str, content: str, count: int) -> dict[str, Any]:
    sents = [s for s in re.split(r"(?<=[.!?])\s+", content) if s.strip()]
    cards = []
    for i, s in enumerate(sents[:count]):
        cards.append({"front": f"What does this say? ({i + 1})", "back": s.strip()})
    if not cards:
        cards = [{"front": title, "back": "No content available."}]
    return {"cards": cards}


def _fallback_quiz(title: str, content: str, count: int) -> dict[str, Any]:
    sents = [s for s in re.split(r"(?<=[.!?])\s+", content) if s.strip()][:count]
    questions = [
        {
            "type": "true_false",
            "question": s.strip(),
            "answer": "true",
            "explanation": "Stated in the note.",
        }
        for s in sents
    ]
    if not questions:
        questions = [
            {
                "type": "true_false",
                "question": f"This note is titled '{title}'.",
                "answer": "true",
                "explanation": "From the note title.",
            }
        ]
    return {"questions": questions}


def _fallback_class_overview(
    class_name: str,
    notes: list[dict[str, Any]],
) -> dict[str, Any]:
    """Offline-safe stitch from note snippets when model/cloud are unavailable."""
    if not notes:
        return {
            "overview": (
                f"Add notes to {class_name} to generate an overview — "
                "there's nothing to synthesize yet."
            )
        }
    chunks: list[str] = []
    for n in notes[:8]:
        title = (n.get("title") or "Note").strip()
        snippet = (n.get("summary") or "").strip()
        if not snippet:
            body = (n.get("content") or "").strip()
            if body:
                snippet = _first_sentences(body, 2)
        if snippet:
            chunks.append(f"{title}: {snippet}")
    text = " ".join(chunks)
    if not text.strip():
        return {
            "overview": (
                f"Your {class_name} notes don't have readable content yet — "
                "add text to a note and try again."
            )
        }
    if len(text) > 720:
        text = text[:717].rsplit(" ", 1)[0] + "…"
    return {"overview": text}


def _fallback_ask(
    class_name: str,
    recent_notes: list[dict[str, Any]],
    question: str,
) -> dict[str, Any]:
    """Last-resort answer when no cloud provider is configured AND the
    local model isn't available. Never invents content about the class —
    just echoes what the user has actually written down so the UI stays
    consistent with the strict-grounding contract of the real prompt."""

    # Prefer notes that have a summary; if none, fall back to a snippet
    # of the raw content. Either way, only quote the user's own words.
    refs: list[dict[str, Any]] = []
    bullets: list[str] = []
    for n in recent_notes:
        title = n.get("title", "note")
        snippet = (n.get("summary") or "").strip()
        if not snippet:
            body = (n.get("content") or "").strip()
            if body:
                snippet = body[:240].replace("\n", " ").strip()
                if len(body) > 240:
                    snippet += "…"
        if snippet:
            refs.append(n)
            bullets.append(f"- From “{title}” ({n.get('note_id', '?')}): {snippet}")
        if len(refs) >= 3:
            break

    if bullets:
        answer = (
            f"Here is what your {class_name} notes say so far — I can only use "
            "what you have written, not guess beyond it:\n\n"
            + "\n".join(bullets)
            + "\n\nIf that does not answer your question, add more detail in a note and ask again."
        )
    else:
        answer = (
            f"I don't have any notes attached for {class_name} yet, so I "
            "can't ground an answer for you. Add a note (or summarize an "
            "existing one) for this class and ask again — I'll only "
            "answer from your own material.\n\n"
            f"Your question was: “{question.strip()}”."
        )
    return {
        "answer": answer,
        "memory_trick": None,
        "related_note_ids": [n.get("note_id") for n in refs if n.get("note_id")],
    }


def _fallback_study_plan(notes: list[dict[str, Any]], days: int) -> dict[str, Any]:
    from datetime import date, timedelta

    today = date.today()
    tasks = []
    for i, note in enumerate(notes[: max(1, days)]):
        d = today + timedelta(days=i)
        tasks.append(
            {
                "title": f"Review: {note.get('title', 'Note')}",
                "scheduled_for": d.isoformat(),
                "duration_minutes": 30,
                "type": "review",
                "note_id": note.get("id"),
            }
        )
    return {"tasks": tasks}
