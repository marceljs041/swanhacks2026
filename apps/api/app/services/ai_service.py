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
