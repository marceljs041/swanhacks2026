"""Thin Supabase client wrapper. Falls back to an in-memory store when
Supabase isn't configured — handy for local dev and the demo when the
network is flaky.
"""

from __future__ import annotations

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

    def upsert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        if self._client is None:
            return self._memory.upsert(table, row)
        result = self._client.table(table).upsert(row).execute()
        return (result.data or [row])[0]

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
