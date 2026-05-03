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


class AskMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ClassOverviewNoteInput(BaseModel):
    note_id: str
    title: str
    summary: str | None = None
    content: str = ""


class ClassOverviewRequest(BaseModel):
    class_name: str
    class_subtitle: str | None = None
    notes: list[ClassOverviewNoteInput] = Field(default_factory=list)


class ClassOverviewResponse(BaseModel):
    overview: str


class AskNoteSummary(BaseModel):
    note_id: str
    title: str
    summary: str | None = None
    content: str | None = None


class AskRequest(BaseModel):
    class_name: str
    class_subtitle: str | None = None
    recent_notes: list[AskNoteSummary] = Field(default_factory=list)
    weak_topics: list[str] = Field(default_factory=list)
    history: list[AskMessage] = Field(default_factory=list)
    question: str


class AskResponse(BaseModel):
    answer: str
    memory_trick: str | None = None
    related_note_ids: list[str] = Field(default_factory=list)


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


class DeviceRegisterRequest(BaseModel):
    """Upserts `devices` when an offline-first client comes online."""

    device_id: str
    user_id: str | None = None
    label: str | None = None


class DeviceRegisterResponse(BaseModel):
    ok: bool = True
    resolved_user_id: str


# ---------- Audio chunk session (Gemma 4 E4B) ----------


class AudioSessionCreateResponse(BaseModel):
    session_id: str
    max_chunk_seconds: int
    sample_rate: int
    backend: Literal["gemma4", "stub"]


class AudioSessionChunkResponse(BaseModel):
    ok: bool = True
    chunks_received: int
    total_seconds: float


class AudioSessionFinalizeRequest(BaseModel):
    title_hint: str | None = None
    class_name: str | None = None


class AudioSessionFinalizeResponse(BaseModel):
    title: str
    content_markdown: str
    summary: str
    key_terms: list[dict[str, str]] = Field(default_factory=list)
    backend: Literal["gemma4", "stub"]
    audio_seconds: float
