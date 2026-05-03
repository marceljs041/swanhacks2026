"""Server-side sync logic. Each push is upserted into Supabase and stamped
with `server_updated_at`. Pull returns rows changed since the client's
`since` timestamp.

Conflict policy (matches the brief):
  - Last-write-wins on most entities by comparing `client_updated_at` vs
    `server_updated_at` of the existing row.
  - On a stale write we DO NOT silently drop — we report a conflict so the
    client can present a "conflict copy" banner.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.schemas import (
    AppliedItem,
    ConflictItem,
    SyncEnvelope,
    SyncPullRequest,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.services.supabase_service import get_supabase

# Tables that participate in sync. Order doesn't matter for push — only
# for pull, where the client must apply parents before children.
SYNCABLE_TABLES = (
    "classes",
    "notes",
    "attachments",
    "flashcard_sets",
    "flashcards",
    "quizzes",
    "quiz_questions",
    "quiz_attempts",
    "quiz_sessions",
    "study_plans",
    "study_tasks",
    "calendar_events",
    "checklist_items",
    "xp_events",
)

# Primary key column per table (default "id"). Must match client envelopes / Postgres.
def _pk_field(entity_type: str) -> str:
    if entity_type == "quiz_sessions":
        return "quiz_id"
    return "id"


def _entity_id_from_row(table: str, row: dict[str, Any]) -> str:
    pk = _pk_field(table)
    val = row.get(pk) or row.get("id")
    if val is None:
        raise ValueError(f"sync pull row missing pk for {table}: {row!r}")
    return str(val)

# Tables that should never reject a stale write — append-only or merge-by-id.
NEVER_CONFLICT = {"xp_events", "quiz_attempts"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_id_for(req_user: str | None) -> str:
    return req_user or get_settings().demo_user_id


def push(req: SyncPushRequest) -> SyncPushResponse:
    sb = get_supabase()
    user_id = _user_id_for(req.user_id)
    applied: list[AppliedItem] = []
    conflicts: list[ConflictItem] = []

    for env in req.envelopes:
        if env.entity_type not in SYNCABLE_TABLES:
            conflicts.append(
                ConflictItem(
                    entity_type=env.entity_type,
                    entity_id=env.entity_id,
                    reason="unknown_entity_type",
                    server_payload={},
                )
            )
            continue

        pk = _pk_field(env.entity_type)
        existing = None
        try:
            rows = sb.query_since(env.entity_type, user_id, since=None)
            existing = next(
                (r for r in rows if r.get(pk) == env.entity_id or r.get("id") == env.entity_id),
                None,
            )
        except Exception:
            existing = None

        if env.operation == "delete":
            if env.entity_type == "quiz_sessions":
                sb.hard_delete(env.entity_type, pk, env.entity_id, user_id)
            else:
                sb.soft_delete(env.entity_type, env.entity_id, user_id)
            applied.append(
                AppliedItem(
                    entity_type=env.entity_type,
                    entity_id=env.entity_id,
                    server_updated_at=_now_iso(),
                )
            )
            continue

        # Stale-write check: server is newer AND client didn't see it.
        if (
            existing
            and env.entity_type not in NEVER_CONFLICT
            and existing.get("updated_at")
            and env.client_updated_at <= existing["updated_at"]
            and existing.get("device_id") != env.device_id
        ):
            conflicts.append(
                ConflictItem(
                    entity_type=env.entity_type,
                    entity_id=env.entity_id,
                    reason="server_newer",
                    server_payload=existing,
                )
            )
            continue

        payload = dict(env.payload)
        payload[pk] = env.entity_id
        if pk != "id":
            payload.pop("id", None)
        row: dict[str, Any] = {
            **payload,
            "user_id": user_id,
            "device_id": env.device_id,
        }
        try:
            sb.upsert(env.entity_type, row, pk=pk)
        except Exception as exc:
            msg = str(exc)[:400]
            conflicts.append(
                ConflictItem(
                    entity_type=env.entity_type,
                    entity_id=env.entity_id,
                    reason=f"upsert_failed:{msg}",
                    server_payload={},
                )
            )
            continue
        applied.append(
            AppliedItem(
                entity_type=env.entity_type,
                entity_id=env.entity_id,
                server_updated_at=_now_iso(),
            )
        )

    return SyncPushResponse(applied=applied, conflicts=conflicts)


def pull(req: SyncPullRequest) -> SyncPullResponse:
    sb = get_supabase()
    user_id = _user_id_for(req.user_id)
    tables = req.entity_types or list(SYNCABLE_TABLES)
    envelopes: list[SyncEnvelope] = []

    for table in tables:
        rows = sb.query_since(table, user_id, since=req.since)
        for row in rows:
            # Don't echo our own writes back to the same device.
            if row.get("device_id") == req.device_id and row.get("server_updated_at") == row.get(
                "updated_at"
            ):
                pass  # still send — clients dedupe by id+updated_at

            operation = "delete" if row.get("deleted_at") else "upsert"
            envelopes.append(
                SyncEnvelope(
                    entity_type=table,
                    entity_id=_entity_id_from_row(table, row),
                    operation=operation,
                    payload=row,
                    client_updated_at=row.get("updated_at") or _now_iso(),
                    device_id=row.get("device_id") or "server",
                )
            )

    return SyncPullResponse(envelopes=envelopes, server_now=_now_iso())
