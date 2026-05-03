"""Thin Supabase client wrapper. Falls back to an in-memory store when
Supabase isn't configured — handy for local dev and the demo when the
network is flaky.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from threading import RLock
from typing import Any

from app.config import get_settings

try:  # supabase is optional in dev
    from supabase import Client, create_client  # type: ignore
except Exception:  # pragma: no cover
    Client = None  # type: ignore
    create_client = None  # type: ignore


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class _MemoryStore:
    """Tiny in-process Postgres stand-in. Keeps the demo running offline."""

    def __init__(self) -> None:
        self._tables: dict[str, dict[str, dict[str, Any]]] = {}
        self._lock = RLock()

    def upsert(self, table: str, row: dict[str, Any], pk: str = "id") -> dict[str, Any]:
        with self._lock:
            self._tables.setdefault(table, {})
            row = {**row, "server_updated_at": _now_iso()}
            self._tables[table][row[pk]] = row
            return row

    def get(self, table: str, pk_value: str, pk: str = "id") -> dict[str, Any] | None:
        with self._lock:
            return self._tables.get(table, {}).get(pk_value)

    def delete(self, table: str, pk_value: str, pk: str = "id") -> None:
        with self._lock:
            self._tables.get(table, {}).pop(pk_value, None)

    def query_since(
        self,
        table: str,
        user_id: str,
        since: str | None,
    ) -> list[dict[str, Any]]:
        with self._lock:
            rows = list(self._tables.get(table, {}).values())
            rows = [r for r in rows if r.get("user_id") == user_id]
            if since:
                rows = [r for r in rows if r.get("server_updated_at", "") > since]
            return rows


class SupabaseService:
    """Public surface. Use either the real Supabase client or the memory store."""

    def __init__(self) -> None:
        settings = get_settings()
        self._memory = _MemoryStore()
        self._client: Client | None = None
        # Per-table set of column names known to be missing from Postgres.
        # Populated lazily from upsert errors so payloads silently drop
        # fields that the schema hasn't migrated to yet.
        self._missing_columns: dict[str, set[str]] = {}
        if settings.supabase_url and settings.supabase_service_key and create_client:
            try:
                self._client = create_client(
                    settings.supabase_url, settings.supabase_service_key
                )
            except Exception:  # pragma: no cover
                self._client = None

    @property
    def using_memory(self) -> bool:
        return self._client is None

    def get_missing_columns(self) -> dict[str, list[str]]:
        """Diagnostic: which columns the API has had to strip from upserts."""
        return {t: sorted(c) for t, c in self._missing_columns.items() if c}

    @staticmethod
    def _extract_missing_column(error_message: str) -> str | None:
        """Parses a PostgREST/Postgres error to find a missing column name.

        Handles common shapes:
          - PGRST204: "Could not find the 'icon' column of 'notes' in the schema cache"
          - 42703:    "column \"icon\" of relation \"notes\" does not exist"
          - JSON dump of APIError that contains either of the above
        """
        for pattern in (
            r"Could not find the '([^']+)' column",
            r"Could not find the \\?\"([^\\\"]+)\\?\" column",
            r"column \"([^\"]+)\" of relation",
            r"column \\?\"([^\\\"]+)\\?\" of relation",
            r"column ([A-Za-z_][A-Za-z0-9_]*) does not exist",
        ):
            m = re.search(pattern, error_message)
            if m:
                return m.group(1)
        return None

    def _filter_payload(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        skip = self._missing_columns.get(table)
        if not skip:
            return row
        return {k: v for k, v in row.items() if k not in skip}

    def upsert(
        self, table: str, row: dict[str, Any], pk: str = "id"
    ) -> dict[str, Any]:
        if self._client is None:
            return self._memory.upsert(table, row, pk=pk)

        # Retry up to len(row) times, each time dropping one missing column.
        max_attempts = max(1, len(row))
        for _ in range(max_attempts):
            payload = self._filter_payload(table, row)
            try:
                result = self._client.table(table).upsert(payload).execute()
                return (result.data or [payload])[0]
            except Exception as exc:
                col = self._extract_missing_column(str(exc))
                if not col or col in self._missing_columns.get(table, set()):
                    raise
                self._missing_columns.setdefault(table, set()).add(col)
        # Final attempt with stripped payload.
        payload = self._filter_payload(table, row)
        result = self._client.table(table).upsert(payload).execute()
        return (result.data or [payload])[0]

    def hard_delete(
        self, table: str, pk_column: str, pk_value: str, user_id: str
    ) -> None:
        """Row removal for tables without soft-delete (e.g. quiz_sessions)."""
        if self._client is None:
            self._memory.delete(table, pk_value, pk=pk_column)
            return
        (
            self._client.table(table)
            .delete()
            .eq(pk_column, pk_value)
            .eq("user_id", user_id)
            .execute()
        )

    def soft_delete(self, table: str, row_id: str, user_id: str) -> None:
        ts = _now_iso()
        if self._client is None:
            existing = self._memory.get(table, row_id) or {"id": row_id, "user_id": user_id}
            self._memory.upsert(
                table,
                {**existing, "deleted_at": ts, "updated_at": ts},
            )
            return
        self._client.table(table).update(
            {"deleted_at": ts, "updated_at": ts, "server_updated_at": ts}
        ).eq("id", row_id).execute()

    def query_since(
        self, table: str, user_id: str, since: str | None
    ) -> list[dict[str, Any]]:
        if self._client is None:
            return self._memory.query_since(table, user_id, since)
        q = self._client.table(table).select("*").eq("user_id", user_id)
        if since:
            q = q.gt("server_updated_at", since)
        result = q.order("server_updated_at").execute()
        return result.data or []

    def register_device(
        self, device_id: str, user_id: str, label: str | None
    ) -> None:
        """Upsert into `devices` (PK id); preserves created_at on updates."""
        now = _now_iso()
        if self._client is None:
            with self._memory._lock:
                t = self._memory._tables.setdefault("devices", {})
                prev = t.get(device_id)
                if prev:
                    prev["last_seen_at"] = now
                    prev["user_id"] = user_id
                    if label:
                        prev["label"] = label
                else:
                    t[device_id] = {
                        "id": device_id,
                        "user_id": user_id,
                        "label": label or "StudyNest",
                        "created_at": now,
                        "last_seen_at": now,
                    }
            return
        existing = (
            self._client.table("devices")
            .select("id")
            .eq("id", device_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            upd: dict[str, Any] = {
                "last_seen_at": now,
                "user_id": user_id,
            }
            if label:
                upd["label"] = label
            self._client.table("devices").update(upd).eq("id", device_id).execute()
        else:
            self._client.table("devices").insert(
                {
                    "id": device_id,
                    "user_id": user_id,
                    "label": label or "StudyNest",
                    "created_at": now,
                    "last_seen_at": now,
                }
            ).execute()

    def signed_upload_url(
        self, bucket: str, path: str, content_type: str, expires_in: int = 3600
    ) -> dict[str, Any]:
        if self._client is None:
            return {
                "upload_url": f"memory://{bucket}/{path}",
                "public_url": f"memory://{bucket}/{path}",
                "storage_path": path,
                "expires_in": expires_in,
            }
        # supabase-py exposes create_signed_upload_url on storage.from_
        signed = self._client.storage.from_(bucket).create_signed_upload_url(path)
        public = self._client.storage.from_(bucket).get_public_url(path)
        return {
            "upload_url": signed.get("signedUrl") or signed.get("signed_url"),
            "public_url": public,
            "storage_path": path,
            "expires_in": expires_in,
        }


_service: SupabaseService | None = None


def get_supabase() -> SupabaseService:
    global _service
    if _service is None:
        _service = SupabaseService()
    return _service
