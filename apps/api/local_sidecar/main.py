"""FastAPI sidecar that runs Gemma 3 4B locally for the desktop app.

Spawned as a child process by Electron (`apps/desktop/electron/local-ai.ts`).
Listens on 127.0.0.1:8765 by default. Endpoints accept the same shapes as
the cloud API's /ai/* routes — clients can swap base URLs transparently.
"""

from __future__ import annotations

import os
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.prompts import (
    ask_class_prompt,
    class_overview_prompt,
    flashcards_prompt,
    quiz_prompt,
    simple_explain_prompt,
    study_plan_prompt,
    summarize_prompt,
)
from app.schemas import (
    AskRequest,
    AskResponse,
    ClassOverviewRequest,
    ClassOverviewResponse,
    FlashcardsRequest,
    FlashcardsResponse,
    NoteContext,
    QuizRequest,
    QuizResponse,
    SimpleExplainRequest,
    StudyPlanRequest,
    StudyPlanResponse,
    SummaryResponse,
)
from app.services.ai_service import (
    _fallback_ask,
    _fallback_class_overview,
    _fallback_flashcards,
    _fallback_quiz,
    _fallback_study_plan,
    _fallback_summary,
)
from local_sidecar import llm

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Background load so Uvicorn binds immediately; /health updates when ready."""
    threading.Thread(target=llm.warm, daemon=True).start()
    yield


app = FastAPI(title="StudyNest Local AI Sidecar", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    s = llm.status()
    return {"ok": True, **s}


def _local_or_template(prompt: dict, sync_fallback) -> dict:
    """Run the on-device model; on failure use a deterministic template (no network)."""
    try:
        return llm.generate_json(prompt["system"], prompt["user"])
    except Exception:
        return sync_fallback()


def _ask_payload_has_answer(data: object) -> bool:
    """Local Gemma sometimes emits `{}` or `{\"answer\":\"\"}` — treat as failure."""
    if not isinstance(data, dict):
        return False
    ans = data.get("answer")
    if ans is None:
        return False
    return isinstance(ans, str) and bool(ans.strip())


def _normalize_ask_payload(data: dict) -> dict[str, str | list[str] | None]:
    """Shape arbitrary dict into kwargs compatible with :class:`AskResponse`."""
    ans = data.get("answer", "")
    if not isinstance(ans, str):
        ans = str(ans) if ans is not None else ""
    mt = data.get("memory_trick")
    if mt is not None:
        if not isinstance(mt, str):
            mt = str(mt)
        if not mt.strip():
            mt = None
    rids = data.get("related_note_ids")
    if not isinstance(rids, list):
        rids = []
    else:
        rids = [str(x) for x in rids if x is not None]
    return {"answer": ans.strip(), "memory_trick": mt, "related_note_ids": rids}


def _finalize_ask_payload(payload: dict[str, str | list[str] | None]) -> dict[str, str | list[str] | None]:
    """Guarantee a non-empty `answer` so FastAPI never 500s on validation."""
    if str(payload.get("answer", "")).strip():
        return payload
    return {
        "answer": (
            "I couldn't generate a reply right now. Try again in a moment, "
            "or shorten your notes if this class has very long attachments."
        ),
        "memory_trick": None,
        "related_note_ids": list(payload.get("related_note_ids") or []),
    }


async def _resolve_ask(req: AskRequest) -> dict[str, str | list[str] | None]:
    """Try local model with a generous token budget; if it omits `answer`,
    fall back to the deterministic offline template (no remote AI)."""
    prompt = ask_class_prompt(
        class_name=req.class_name,
        class_subtitle=req.class_subtitle,
        recent_notes=[n.model_dump() for n in req.recent_notes],
        weak_topics=req.weak_topics,
        history=[m.model_dump() for m in req.history],
        question=req.question,
    )
    notes_payload = [n.model_dump() for n in req.recent_notes]

    data: dict = {}
    try:
        # Ask prompts can be long (full note bodies); allow a wider completion budget.
        data = llm.generate_json(prompt["system"], prompt["user"], max_tokens=2048)
    except Exception:
        data = {}

    if _ask_payload_has_answer(data):
        return _finalize_ask_payload(_normalize_ask_payload(data))

    return _finalize_ask_payload(
        _normalize_ask_payload(_fallback_ask(req.class_name, notes_payload, req.question)),
    )


def _normalize_overview_payload(data: dict) -> dict[str, str]:
    o = data.get("overview", "")
    if not isinstance(o, str):
        o = str(o) if o is not None else ""
    return {"overview": o.strip()}


def _finalize_overview_payload(payload: dict[str, str]) -> dict[str, str]:
    if str(payload.get("overview", "")).strip():
        return payload
    return {
        "overview": (
            "Couldn't generate an overview right now. Try again in a moment, "
            "or shorten very long notes."
        ),
    }


def _overview_payload_ok(data: object) -> bool:
    if not isinstance(data, dict):
        return False
    o = data.get("overview")
    return isinstance(o, str) and bool(o.strip())


async def _resolve_class_overview(req: ClassOverviewRequest) -> dict[str, str]:
    notes_payload = [n.model_dump() for n in req.notes]
    prompt = class_overview_prompt(
        class_name=req.class_name,
        class_subtitle=req.class_subtitle,
        notes=notes_payload,
    )

    data: dict = {}
    try:
        data = llm.generate_json(prompt["system"], prompt["user"], max_tokens=768)
    except Exception:
        data = {}

    if _overview_payload_ok(data):
        return _finalize_overview_payload(_normalize_overview_payload(data))

    return _finalize_overview_payload(
        _normalize_overview_payload(_fallback_class_overview(req.class_name, notes_payload)),
    )


@app.post("/local-ai/summarize", response_model=SummaryResponse)
async def summarize(req: NoteContext) -> SummaryResponse:
    prompt = summarize_prompt(title=req.title, content=req.content)
    data = _local_or_template(
        prompt,
        lambda: _fallback_summary(req.title, req.content),
    )
    return SummaryResponse(**data)


@app.post("/local-ai/flashcards", response_model=FlashcardsResponse)
async def flashcards(req: FlashcardsRequest) -> FlashcardsResponse:
    prompt = flashcards_prompt(title=req.title, content=req.content, count=req.count)
    data = _local_or_template(
        prompt,
        lambda: _fallback_flashcards(req.title, req.content, req.count),
    )
    return FlashcardsResponse(**data)


@app.post("/local-ai/quiz", response_model=QuizResponse)
async def quiz(req: QuizRequest) -> QuizResponse:
    prompt = quiz_prompt(
        title=req.title, content=req.content, count=req.count, types=req.types
    )
    data = _local_or_template(
        prompt,
        lambda: _fallback_quiz(req.title, req.content, req.count),
    )
    return QuizResponse(**data)


@app.post("/local-ai/study-plan", response_model=StudyPlanResponse)
async def study_plan(req: StudyPlanRequest) -> StudyPlanResponse:
    prompt = study_plan_prompt(
        goal=req.goal, exam_date=req.exam_date, notes=req.notes, days=req.days_available
    )
    days = req.days_available if req.days_available is not None else 7
    data = _local_or_template(
        prompt,
        lambda: _fallback_study_plan(req.notes, days),
    )
    return StudyPlanResponse(**data)


@app.post("/local-ai/simple-explain", response_model=SummaryResponse)
async def simple_explain(req: SimpleExplainRequest) -> SummaryResponse:
    prompt = simple_explain_prompt(
        title=req.title, content=req.content, audience=req.audience
    )
    data = _local_or_template(
        prompt,
        lambda: _fallback_summary(req.title, req.content),
    )
    return SummaryResponse(**data)


@app.post("/local-ai/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    payload = await _resolve_ask(req)
    return AskResponse(**payload)


@app.post("/local-ai/class-overview", response_model=ClassOverviewResponse)
async def class_overview(req: ClassOverviewRequest) -> ClassOverviewResponse:
    payload = await _resolve_class_overview(req)
    return ClassOverviewResponse(**payload)


@app.post("/local-ai/key-terms", response_model=SummaryResponse)
async def key_terms(req: NoteContext) -> SummaryResponse:
    # Reuses summarize prompt — model is told to focus on key terms.
    prompt = summarize_prompt(title=req.title, content=req.content)
    data = _local_or_template(
        prompt,
        lambda: _fallback_summary(req.title, req.content),
    )
    return SummaryResponse(**data)


def run() -> None:
    import uvicorn

    port = int(os.environ.get("STUDYNEST_LOCAL_AI_PORT", "8765"))
    uvicorn.run(
        "local_sidecar.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    run()
