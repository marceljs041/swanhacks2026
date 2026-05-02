from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import ai, attachments, devices, sync
from app.services.supabase_service import get_supabase

settings = get_settings()

app = FastAPI(
    title="StudyNest Cloud API",
    description="Sync, attachments, device pairing, and cloud AI fallback for StudyNest.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^(http://localhost:\d+|http://127\.0\.0\.1:\d+|app://.*)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, object]:
    sb = get_supabase()
    return {
        "ok": True,
        "service": "studynest-api",
        "supabase": "configured" if not sb.using_memory else "memory_fallback",
    }


app.include_router(sync.router)
app.include_router(ai.router)
app.include_router(attachments.router)
app.include_router(devices.router)
