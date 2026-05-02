"""Lazy llama-cpp-python wrapper. Loads Gemma 3 4B Instruct from a GGUF
file pointed to by STUDYNEST_GEMMA_MODEL_PATH.

The sidecar calls :func:`warm` on startup so ``/health`` reports
``loaded: true`` once the weights are in memory. Inference still goes
through the same loaded instance.

If llama-cpp-python isn't installed or the model file is missing, the
sidecar falls back to deterministic templates so the desktop UI still
works for the demo.
"""

from __future__ import annotations

import json
import os
import re
import threading
from typing import Any

_llm_lock = threading.Lock()
_llm: Any = None
_llm_status: dict[str, Any] = {
    "loaded": False,
    "model": None,
    "context_size": 0,
    "error": None,
}


def _model_path() -> str:
    return os.environ.get(
        "STUDYNEST_GEMMA_MODEL_PATH",
        "./app-data/models/gemma-3-4b-it-q4_k_m.gguf",
    )


def _ctx_size() -> int:
    return int(os.environ.get("STUDYNEST_GEMMA_CTX_SIZE", "8192"))


def _threads() -> int:
    return int(os.environ.get("STUDYNEST_GEMMA_THREADS", "4"))


def status() -> dict[str, Any]:
    return dict(_llm_status)


def warm() -> None:
    """Eagerly load the GGUF so ``status()`` and ``/health`` reflect reality."""
    _load()


def _load() -> Any:
    global _llm
    if _llm is not None:
        return _llm
    with _llm_lock:
        if _llm is not None:
            return _llm
        try:
            from llama_cpp import Llama  # type: ignore
        except ImportError as e:
            _llm_status["error"] = f"llama-cpp-python not installed: {e}"
            return None
        path = _model_path()
        if not os.path.exists(path):
            _llm_status["error"] = f"model not found at {path}"
            return None
        try:
            _llm = Llama(
                model_path=path,
                n_ctx=_ctx_size(),
                n_threads=_threads(),
                n_gpu_layers=-1,
                verbose=False,
            )
            _llm_status.update(
                {
                    "loaded": True,
                    "model": os.path.basename(path),
                    "context_size": _ctx_size(),
                    "error": None,
                }
            )
        except Exception as e:  # pragma: no cover
            _llm_status["error"] = f"failed to load model: {e}"
            _llm = None
        return _llm


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = _strip_fences(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not m:
            raise
        return json.loads(m.group(0))


def generate_json(system: str, user: str, max_tokens: int = 1024) -> dict[str, Any]:
    """Generate a JSON response. Retries once on parse failure with a
    stricter "JSON only" reminder appended."""

    llm = _load()
    if llm is None:
        raise RuntimeError(_llm_status.get("error") or "llm_not_available")

    def call(prompt_user: str) -> str:
        out = llm.create_chat_completion(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt_user},
            ],
            max_tokens=max_tokens,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        return out["choices"][0]["message"]["content"]

    raw = call(user)
    try:
        return _extract_json(raw)
    except Exception:
        retry_user = user + "\n\nReminder: respond with VALID JSON only. No prose."
        raw = call(retry_user)
        return _extract_json(raw)
