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
    configured = not sb.using_memory
    return {
        "ok": True,
        "service": "studynest-api",
        "supabase": "configured" if configured else "memory_fallback",
        "hint": None
        if configured
        else (
            "Sync is using in-memory storage — Postgres/Supabase stay empty. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_KEY (e.g. from the repo root .env) and restart the API."
        ),
        # Lists columns the API has had to drop because Postgres is missing
        # them (older migration). Shown so users know which migrations to run.
        "schema_drift": sb.get_missing_columns(),
    }


app.include_router(sync.router)
app.include_router(ai.router)
app.include_router(attachments.router)
app.include_router(devices.router)
