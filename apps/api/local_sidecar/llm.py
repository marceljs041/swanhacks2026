"""Text JSON routes delegate here; inference uses Gemma 4 E4B via :mod:`audio_llm`.

One ``transformers`` load serves summarization, quizzes, and audio notes. Offline:
set ``STUDYNEST_GEMMA4_MODEL_PATH`` to a local HF snapshot directory.
"""

from __future__ import annotations

from typing import Any

from local_sidecar import audio_llm


def status() -> dict[str, Any]:
    return audio_llm.text_stack_status()


def warm() -> None:
    audio_llm.warm_model()


def generate_json(system: str, user: str, max_tokens: int = 1024) -> dict[str, Any]:
    return audio_llm.generate_json_text(system, user, max_tokens=max_tokens)
