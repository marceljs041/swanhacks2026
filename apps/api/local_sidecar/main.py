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
    flashcards_prompt,
    quiz_prompt,
    simple_explain_prompt,
    study_plan_prompt,
    summarize_prompt,
)
from app.schemas import (
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
from app.services import ai_service as cloud_ai
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


async def _local_or_cloud(prompt: dict, fallback_coro) -> dict:
    """Try local Gemma first; on any failure fall back to cloud or template."""
    try:
        return llm.generate_json(prompt["system"], prompt["user"])
    except Exception:
        return await fallback_coro


@app.post("/local-ai/summarize", response_model=SummaryResponse)
async def summarize(req: NoteContext) -> SummaryResponse:
    prompt = summarize_prompt(title=req.title, content=req.content)
    data = await _local_or_cloud(
        prompt, cloud_ai.summarize(title=req.title, content=req.content)
    )
    return SummaryResponse(**data)


@app.post("/local-ai/flashcards", response_model=FlashcardsResponse)
async def flashcards(req: FlashcardsRequest) -> FlashcardsResponse:
    prompt = flashcards_prompt(title=req.title, content=req.content, count=req.count)
    data = await _local_or_cloud(
        prompt,
        cloud_ai.flashcards(title=req.title, content=req.content, count=req.count),
    )
    return FlashcardsResponse(**data)


@app.post("/local-ai/quiz", response_model=QuizResponse)
async def quiz(req: QuizRequest) -> QuizResponse:
    prompt = quiz_prompt(
        title=req.title, content=req.content, count=req.count, types=req.types
    )
    data = await _local_or_cloud(
        prompt,
        cloud_ai.quiz(
            title=req.title, content=req.content, count=req.count, types=req.types
        ),
    )
    return QuizResponse(**data)


@app.post("/local-ai/study-plan", response_model=StudyPlanResponse)
async def study_plan(req: StudyPlanRequest) -> StudyPlanResponse:
    prompt = study_plan_prompt(
        goal=req.goal, exam_date=req.exam_date, notes=req.notes, days=req.days_available
    )
    data = await _local_or_cloud(
        prompt,
        cloud_ai.study_plan(
            goal=req.goal,
            exam_date=req.exam_date,
            notes=req.notes,
            days_available=req.days_available,
        ),
    )
    return StudyPlanResponse(**data)


@app.post("/local-ai/simple-explain", response_model=SummaryResponse)
async def simple_explain(req: SimpleExplainRequest) -> SummaryResponse:
    prompt = simple_explain_prompt(
        title=req.title, content=req.content, audience=req.audience
    )
    data = await _local_or_cloud(
        prompt,
        cloud_ai.explain_simple(
            title=req.title, content=req.content, audience=req.audience
        ),
    )
    return SummaryResponse(**data)


@app.post("/local-ai/key-terms", response_model=SummaryResponse)
async def key_terms(req: NoteContext) -> SummaryResponse:
    # Reuses summarize prompt — model is told to focus on key terms.
    prompt = summarize_prompt(title=req.title, content=req.content)
    data = await _local_or_cloud(
        prompt, cloud_ai.summarize(title=req.title, content=req.content)
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
