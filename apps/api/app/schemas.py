from typing import Any, Literal

from pydantic import BaseModel, Field

# ---------- Sync ----------

SyncOperation = Literal["upsert", "delete"]


class SyncEnvelope(BaseModel):
    entity_type: str
    entity_id: str
    operation: SyncOperation
    payload: dict[str, Any]
    client_updated_at: str
    device_id: str


class SyncPushRequest(BaseModel):
    device_id: str
    user_id: str | None = None
    envelopes: list[SyncEnvelope]


class AppliedItem(BaseModel):
    entity_type: str
    entity_id: str
    server_updated_at: str


class ConflictItem(BaseModel):
    entity_type: str
    entity_id: str
    reason: str
    server_payload: dict[str, Any]


class SyncPushResponse(BaseModel):
    applied: list[AppliedItem]
    conflicts: list[ConflictItem] = []


class SyncPullRequest(BaseModel):
    device_id: str
    user_id: str | None = None
    since: str | None = None
    entity_types: list[str] | None = None


class SyncPullResponse(BaseModel):
    envelopes: list[SyncEnvelope]
    server_now: str


# ---------- AI ----------


class NoteContext(BaseModel):
    note_id: str
    title: str
    content: str
    class_name: str | None = None


class FlashcardsRequest(NoteContext):
    count: int = 10


class QuizRequest(NoteContext):
    count: int = 5
    types: list[Literal["multiple_choice", "true_false"]] = Field(
        default_factory=lambda: ["multiple_choice", "true_false"]
    )


class StudyPlanRequest(BaseModel):
    goal: str
    exam_date: str | None = None
    notes: list[dict[str, Any]] = []
    days_available: int = 7


class SimpleExplainRequest(NoteContext):
    audience: Literal["child", "highschool", "college"] = "highschool"


class SummaryResponse(BaseModel):
    summary: str
    key_terms: list[dict[str, str]] = []


class FlashcardsResponse(BaseModel):
    cards: list[dict[str, str]]


class QuizResponse(BaseModel):
    questions: list[dict[str, Any]]


class StudyPlanResponse(BaseModel):
    tasks: list[dict[str, Any]]


# ---------- Attachments ----------


class UploadUrlRequest(BaseModel):
    attachment_id: str
    note_id: str
    file_name: str
    mime_type: str
    size_bytes: int


class UploadUrlResponse(BaseModel):
    upload_url: str
    public_url: str | None = None
    storage_path: str
    expires_in: int


# ---------- Devices / pairing ----------


class PairStartResponse(BaseModel):
    code: str
    user_id: str
    expires_at: str


class PairConfirmRequest(BaseModel):
    code: str
    device_id: str
    label: str | None = None


class PairConfirmResponse(BaseModel):
    user_id: str
    paired_device_id: str
