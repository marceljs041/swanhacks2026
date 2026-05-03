"""In-memory store for chunked audio uploads.

Each session is the server-side mirror of a single recording the
renderer is splitting into 30-second chunks. The renderer:

1. POST /local-ai/audio-session
       → {session_id, max_chunk_seconds, sample_rate, backend}
2. for each chunk in order:
       POST /local-ai/audio-session/{id}/chunk   (multipart WAV)
3. POST /local-ai/audio-session/{id}/finalize
       → {title, content_markdown, summary, key_terms, backend}

Sessions live only in memory and self-expire after 30 minutes of
inactivity so a crashed renderer doesn't leak audio buffers. They're
cheap to keep around (one session ≈ a few MB of PCM); we don't hit
disk so there's nothing to clean up on shutdown.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from threading import Lock
from typing import Iterable

# Gemma 4 E4B's audio encoder caps a single audio block at 30 s.
# We accept up to ~32 s to give the renderer's chunker a tiny margin
# for the resampling rounding error; anything larger is rejected.
MAX_CHUNK_SECONDS_HARD = 32
MAX_CHUNK_SECONDS_TARGET = 30
TARGET_SAMPLE_RATE = 16000

# Soft caps so a runaway client can't OOM the sidecar. 30 min @ 16kHz
# mono 16-bit is ~57 MB, comfortable on a laptop.
MAX_CHUNKS_PER_SESSION = 60      # ≈ 30 minutes of audio
MAX_TOTAL_BYTES = 256 * 1024 * 1024  # 256 MiB per session

# Idle TTL — sessions that haven't seen a chunk in this long get evicted.
SESSION_IDLE_TTL_SECONDS = 30 * 60


@dataclass
class AudioSession:
    """Pure data container — locking is handled by the registry."""

    session_id: str
    created_at: float
    last_activity_at: float
    chunks: list[bytes] = field(default_factory=list)
    chunk_seconds: list[float] = field(default_factory=list)

    @property
    def total_seconds(self) -> float:
        return sum(self.chunk_seconds)

    @property
    def total_bytes(self) -> int:
        return sum(len(c) for c in self.chunks)


class AudioSessionRegistry:
    """Thread-safe map of session_id → AudioSession with idle eviction.

    Uvicorn runs FastAPI handlers in a worker pool, so even though each
    handler is async we may see concurrent calls into the same session
    if a misbehaving client double-fires. The lock keeps the chunk list
    consistent."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._sessions: dict[str, AudioSession] = {}

    def create(self) -> AudioSession:
        with self._lock:
            self._evict_idle_locked()
            sid = f"asn_{uuid.uuid4().hex[:12]}"
            now = time.time()
            session = AudioSession(session_id=sid, created_at=now, last_activity_at=now)
            self._sessions[sid] = session
            return session

    def get(self, sid: str) -> AudioSession | None:
        with self._lock:
            self._evict_idle_locked()
            return self._sessions.get(sid)

    def append_chunk(
        self, sid: str, *, audio_bytes: bytes, seconds: float
    ) -> AudioSession | None:
        with self._lock:
            session = self._sessions.get(sid)
            if session is None:
                return None
            if len(session.chunks) >= MAX_CHUNKS_PER_SESSION:
                raise ValueError(
                    f"session_full: max {MAX_CHUNKS_PER_SESSION} chunks per session"
                )
            if session.total_bytes + len(audio_bytes) > MAX_TOTAL_BYTES:
                raise ValueError("session_full: per-session byte limit reached")
            if seconds > MAX_CHUNK_SECONDS_HARD:
                raise ValueError(
                    f"chunk_too_long: {seconds:.2f}s > {MAX_CHUNK_SECONDS_HARD}s"
                )
            session.chunks.append(audio_bytes)
            session.chunk_seconds.append(seconds)
            session.last_activity_at = time.time()
            return session

    def pop(self, sid: str) -> AudioSession | None:
        """Remove and return a session — used by finalize so the audio
        bytes are freed as soon as the model has consumed them."""
        with self._lock:
            return self._sessions.pop(sid, None)

    def _evict_idle_locked(self) -> None:
        cutoff = time.time() - SESSION_IDLE_TTL_SECONDS
        stale = [sid for sid, s in self._sessions.items() if s.last_activity_at < cutoff]
        for sid in stale:
            self._sessions.pop(sid, None)

    def all_session_ids(self) -> Iterable[str]:
        with self._lock:
            return list(self._sessions.keys())


# Module-level singleton. The sidecar process is single-process so this
# is safe; the lock above handles per-session concurrency.
registry = AudioSessionRegistry()
