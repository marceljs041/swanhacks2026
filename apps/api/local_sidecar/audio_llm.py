"""Gemma 4 E4B multimodal (audio) wrapper for the local sidecar.

This is the bridge that actually sends WAV chunks to the model. The
companion :mod:`local_sidecar.llm` module loads the GGUF text-only
``Gemma 3 4B IT`` via ``llama-cpp-python``; that path can't ingest
audio. As of llama.cpp PR #21421 audio works in ``libmtmd`` but the
HTTP server (and therefore ``llama-cpp-python.create_chat_completion``)
doesn't route ``input_audio`` blocks for Gemma 4 (see issue #21868,
"closed: not planned"). The reliable Python path is HuggingFace
``transformers`` + ``AutoModelForMultimodalLM`` with the
``google/gemma-4-E4B-it`` weights.

Behaviour:
  * If ``transformers`` / ``torch`` / ``librosa`` are importable AND a
    Gemma 4 checkpoint can be loaded, calls go to the real model.
  * Otherwise the sidecar surfaces a deterministic "stub" response so
    the rest of the chunked-upload pipeline (frontend recorder, session
    bookkeeping, note creation) can be exercised without GPU. The
    sidecar reports ``backend: "stub"`` in that case so the renderer
    can show an honest toast.

The model is loaded lazily on the first finalize call — warming it
eagerly at sidecar startup would block ``/health`` for several minutes
on first launch (the gated weights are ~16 GB at f16 / ~5 GB at 4-bit).
"""

from __future__ import annotations

import json
import os
import re
import threading
from typing import Any

# Default to the official Google checkpoint. Users can swap to a local
# directory or a quantized fork via the env var.
_MODEL_ID_ENV = "STUDYNEST_GEMMA4_AUDIO_MODEL"
_DEFAULT_MODEL_ID = "google/gemma-4-E4B-it"

_lock = threading.Lock()
_model: Any = None
_processor: Any = None
_torch: Any = None
_load_error: str | None = None


def _truthy(v: str | None) -> bool:
    return (v or "").strip().lower() in {"1", "true", "yes", "on"}


def force_stub() -> bool:
    """Set ``STUDYNEST_GEMMA4_AUDIO_STUB=1`` to skip the heavy load and
    always return placeholder notes. Useful for UI demos and tests."""
    return _truthy(os.environ.get("STUDYNEST_GEMMA4_AUDIO_STUB"))


def _load() -> tuple[Any, Any, Any] | None:
    """Attempt to import transformers / torch / librosa and load Gemma 4.
    Returns ``(model, processor, torch)`` on success, ``None`` if the
    stub backend should be used. Caches on success and on failure."""
    global _model, _processor, _torch, _load_error

    if force_stub():
        _load_error = "STUDYNEST_GEMMA4_AUDIO_STUB=1"
        return None
    if _model is not None and _processor is not None and _torch is not None:
        return _model, _processor, _torch
    if _load_error is not None:
        return None

    with _lock:
        if _model is not None and _processor is not None and _torch is not None:
            return _model, _processor, _torch
        if _load_error is not None:
            return None
        try:
            import torch  # type: ignore
            from transformers import (  # type: ignore
                AutoModelForMultimodalLM,
                AutoProcessor,
            )
        except Exception as e:  # pragma: no cover — env-specific
            _load_error = f"transformers/torch unavailable: {e}"
            return None

        model_id = os.environ.get(_MODEL_ID_ENV, _DEFAULT_MODEL_ID)

        # Pick the best dtype/device combo we can. CUDA → bfloat16 (or
        # 4-bit if bitsandbytes is around). MPS → float16. Else CPU
        # float32 (slow, but the 30-second cap keeps it tolerable for
        # short recordings on demo laptops).
        try:
            if torch.cuda.is_available():
                kwargs: dict[str, Any] = {
                    "device_map": {"": "cuda:0"},
                    "torch_dtype": torch.bfloat16,
                }
                # Optional: 4-bit quantisation when the GPU is small.
                if _truthy(os.environ.get("STUDYNEST_GEMMA4_AUDIO_4BIT")):
                    try:
                        from transformers import (  # type: ignore
                            BitsAndBytesConfig,
                        )

                        kwargs["quantization_config"] = BitsAndBytesConfig(
                            load_in_4bit=True,
                            bnb_4bit_compute_dtype=torch.bfloat16,
                            bnb_4bit_use_double_quant=True,
                            bnb_4bit_quant_type="nf4",
                            # Per the community workaround that got Gemma
                            # 4 audio running on 8 GB cards — the audio
                            # tower must stay in fp.
                            llm_int8_skip_modules=[
                                "model.audio_tower",
                                "model.embed_audio",
                                "model.embed_vision",
                                "lm_head",
                                "model.language_model.embed_tokens",
                            ],
                        )
                        kwargs.pop("torch_dtype", None)
                    except Exception:
                        pass
            elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
                kwargs = {"device_map": {"": "mps"}, "torch_dtype": torch.float16}
            else:
                kwargs = {"device_map": {"": "cpu"}, "torch_dtype": torch.float32}

            processor = AutoProcessor.from_pretrained(model_id)
            model = AutoModelForMultimodalLM.from_pretrained(model_id, **kwargs)
            model.eval()
            _model, _processor, _torch = model, processor, torch
            _load_error = None
            return _model, _processor, _torch
        except Exception as e:  # pragma: no cover — env-specific
            _load_error = f"failed to load {model_id}: {e}"
            return None


def status() -> dict[str, Any]:
    """Cheap status snapshot for ``/health``. Doesn't trigger a load."""
    if force_stub():
        return {"audio_backend": "stub", "audio_loaded": False, "audio_error": "stub forced"}
    if _model is not None:
        return {"audio_backend": "gemma4", "audio_loaded": True, "audio_error": None}
    return {"audio_backend": "gemma4", "audio_loaded": False, "audio_error": _load_error}


def backend_name() -> str:
    """``"gemma4"`` if the model is loaded (or loadable on next call) and
    ``"stub"`` if we've already failed and are returning placeholders.

    Called by the session-create endpoint so the UI can warn the user up
    front when the heavy backend isn't going to materialise."""
    if force_stub():
        return "stub"
    if _model is not None:
        return "gemma4"
    if _load_error is not None:
        return "stub"
    # Optimistic: we haven't tried yet, assume the load will succeed.
    return "gemma4"


# ----------------------------- Inference -----------------------------


def _decode_wav_to_array(raw: bytes) -> tuple[Any, int]:
    """Decode a renderer-supplied 16 kHz mono PCM WAV blob into the
    ``(np.ndarray[float32], sample_rate)`` tuple the processor wants.

    Falls back to ``librosa.load`` for non-WAV uploads (mp3/m4a/flac)
    so the "Upload audio file" UI works for any common format."""
    import io

    try:
        import soundfile as sf  # type: ignore

        data, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=False)
        if hasattr(data, "ndim") and data.ndim > 1:
            data = data.mean(axis=1)
        return data, int(sr)
    except Exception:
        pass

    import librosa  # type: ignore

    arr, sr = librosa.load(io.BytesIO(raw), sr=16000, mono=True)
    return arr, int(sr)


def _strip_fences(text: str) -> str:
    text = (text or "").strip()
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


def generate_notes(
    *,
    chunks: list[bytes],
    intro_text: str,
    finalize_text: str,
    max_new_tokens: int = 768,
) -> dict[str, Any] | None:
    """Run Gemma 4 E4B on all chunks at once. Returns ``None`` if the
    model isn't available — caller should fall back to the stub.

    Audio is fed as a single multimodal user turn:

        [
          {role:"user", content:[
            {type:"text", text:intro},
            {type:"audio", audio:chunk_0},
            {type:"audio", audio:chunk_1},
            ...
            {type:"audio", audio:chunk_N},
            {type:"text", text:finalize},
          ]}
        ]

    This matches the pattern shown in the Gemma 4 model card and is the
    only shape that's been confirmed to work end-to-end with the
    transformers integration today.
    """
    loaded = _load()
    if loaded is None:
        return None
    model, processor, torch = loaded

    audio_arrays: list[Any] = []
    for raw in chunks:
        arr, _sr = _decode_wav_to_array(raw)
        audio_arrays.append(arr)

    content: list[dict[str, Any]] = [{"type": "text", "text": intro_text}]
    for arr in audio_arrays:
        content.append({"type": "audio", "audio": arr})
    content.append({"type": "text", "text": finalize_text})

    messages = [
        {"role": "system", "content": [{"type": "text", "text": _system_text()}]},
        {"role": "user", "content": content},
    ]

    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    )
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.3,
            do_sample=False,
        )

    # Strip the prompt prefix so we only decode the model's reply.
    input_len = inputs["input_ids"].shape[1]
    new_tokens = outputs[0, input_len:]
    text = processor.batch_decode(
        [new_tokens], skip_special_tokens=True, clean_up_tokenization_spaces=False
    )[0]
    try:
        return _extract_json(text)
    except Exception:
        # Retry once with a stricter "JSON only" reminder appended.
        retry_finalize = finalize_text + "\n\nReminder: respond with VALID JSON only."
        retry_content = list(content[:-1]) + [{"type": "text", "text": retry_finalize}]
        messages[1]["content"] = retry_content
        inputs = processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        )
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.inference_mode():
            outputs = model.generate(
                **inputs, max_new_tokens=max_new_tokens, temperature=0.2, do_sample=False
            )
        new_tokens = outputs[0, inputs["input_ids"].shape[1] :]
        text = processor.batch_decode(
            [new_tokens], skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]
        return _extract_json(text)


def _system_text() -> str:
    # Imported lazily so this module stays loadable even before the
    # Python package is installed in the sidecar venv.
    from app.prompts import AUDIO_NOTES_SYSTEM

    return AUDIO_NOTES_SYSTEM
