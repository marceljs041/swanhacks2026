from fastapi import APIRouter

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
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/summarize", response_model=SummaryResponse)
async def post_summarize(req: NoteContext) -> SummaryResponse:
    data = await ai_service.summarize(title=req.title, content=req.content)
    return SummaryResponse(**data)


@router.post("/flashcards", response_model=FlashcardsResponse)
async def post_flashcards(req: FlashcardsRequest) -> FlashcardsResponse:
    data = await ai_service.flashcards(title=req.title, content=req.content, count=req.count)
    return FlashcardsResponse(**data)


@router.post("/quiz", response_model=QuizResponse)
async def post_quiz(req: QuizRequest) -> QuizResponse:
    data = await ai_service.quiz(
        title=req.title, content=req.content, count=req.count, types=req.types
    )
    return QuizResponse(**data)


@router.post("/study-plan", response_model=StudyPlanResponse)
async def post_study_plan(req: StudyPlanRequest) -> StudyPlanResponse:
    data = await ai_service.study_plan(
        goal=req.goal,
        exam_date=req.exam_date,
        notes=req.notes,
        days_available=req.days_available,
    )
    return StudyPlanResponse(**data)


@router.post("/explain-simple", response_model=SummaryResponse)
async def post_explain_simple(req: SimpleExplainRequest) -> SummaryResponse:
    data = await ai_service.explain_simple(
        title=req.title, content=req.content, audience=req.audience
    )
    return SummaryResponse(**data)
