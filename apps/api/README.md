# @studynest/api

Two Python apps in one package:

1. **Cloud API** (`app/`) — FastAPI service that handles sync push/pull, attachment upload signing, device pairing, and cloud AI fallback. Backed by Supabase.
2. **Local AI sidecar** (`local_sidecar/`) — FastAPI service spawned by the Electron desktop app. Loads **Gemma 4 E4B** via `transformers` (same weights for text JSON routes and audio notes) and exposes `/local-ai/*` on `127.0.0.1:8765`.

## Setup

**Python:** This package needs **Python 3.10 or newer** (the code uses modern typing syntax). macOS `/usr/bin/python3` is often **3.9.x**, which is too old — install a newer interpreter first (recommended: **3.11 or 3.12**).

```bash
# Example: Homebrew (Apple Silicon — adjust path if Intel)
brew install python@3.12
/opt/homebrew/opt/python@3.12/bin/python3.12 --version

# Remove an old venv that was created with 3.9, then recreate:
rm -rf .venv
/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel

# Cloud API only:
pip install -e .

# Cloud API + cloud AI fallback:
pip install -e ".[cloud-ai]"

# Local AI sidecar (ships with Electron):
pip install -e ".[local-ai]"

# Everything + dev tools:
pip install -e ".[local-ai,cloud-ai,dev]"
```

### If `python -m venv .venv` fails on `ensurepip`

Homebrew’s Python sometimes errors during the bundled pip install step. From `apps/api`:

```bash
chmod +x scripts/bootstrap-venv.sh   # once
./scripts/bootstrap-venv.sh
source .venv/bin/activate
pip install -e ".[local-ai,cloud-ai]"
```

Or manually: `python3.12 -m venv .venv --without-pip` then
`curl -sS https://bootstrap.pypa.io/get-pip.py | .venv/bin/python3.12`.

### If get-pip / pip fails with `pyexpat` / `libexpat` / `_XML_SetAllocTrackerActivationThreshold`

Homebrew’s `pyexpat` can load **Apple’s older `/usr/lib/libexpat.1.dylib` first**, so symbols don’t match. **Prefer loading Homebrew’s libs first:**

```bash
brew install expat   # ensures $(brew --prefix expat)/lib exists
export DYLD_LIBRARY_PATH="$(brew --prefix expat)/lib:$(brew --prefix)/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
```

Then run `./scripts/bootstrap-venv.sh` again (the script sets this automatically on macOS).

After `source .venv/bin/activate`, if `pip` still hits the same error in new terminals, export `DYLD_LIBRARY_PATH` the same way before using Python.

Then realign builds (often fixes the root cause so `DYLD_*` isn’t needed forever):

```bash
brew update
brew reinstall expat
brew reinstall python@3.12
```

**Fallback:** install Python from [python.org](https://www.python.org/downloads/macos/) and use its `python3.12` to create `.venv`, or use `uv` (`brew install uv && uv python install 3.12`).

### Running

```bash
# Cloud API
uvicorn app.main:app --reload --port 8000

# Local sidecar (typically launched by Electron, but can be run manually)
python -m local_sidecar.main
```

### Environment

See `../../.env.example` at the repo root.

## PyTorch / CUDA

Install `torch` for your platform (CPU wheel by default; follow [PyTorch](https://pytorch.org)
for CUDA). The sidecar uses the same runtime for summaries and audio.

## Model download

Place a Hugging Face snapshot of **google/gemma-4-E4B-it** at `STUDYNEST_GEMMA4_MODEL_PATH`
(a directory containing `config.json`). The Electron app's `scripts/fetch-model.ts`
runs `snapshot_download` into `app-data/models/gemma-4-e4b-it/` (gated — set `HF_TOKEN`).
