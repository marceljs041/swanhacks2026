#!/usr/bin/env bash
# Create .venv when "python3.12 -m venv" fails on ensurepip (Homebrew + macOS).
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON312:-$("$(command -v brew)" --prefix python@3.12 2>/dev/null)/bin/python3.12}"
if [[ ! -x "$PY" ]]; then
  echo "Set PYTHON312 to your python3.12 binary, e.g. /opt/homebrew/opt/python@3.12/bin/python3.12" >&2
  exit 1
fi

# Homebrew Python's pyexpat can resolve /usr/lib/libexpat.1.dylib (too old) before Homebrew's,
# causing: Symbol not found: _XML_SetAllocTrackerActivationThreshold
if [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
  HB="$(brew --prefix)"
  EXPAT_LIB=""
  if brew --prefix expat >/dev/null 2>&1; then
    EXPAT_LIB="$(brew --prefix expat)/lib"
  fi
  if [[ -n "${EXPAT_LIB}" ]]; then
    export DYLD_LIBRARY_PATH="${EXPAT_LIB}:${HB}/lib:${DYLD_LIBRARY_PATH:-}"
  else
    export DYLD_LIBRARY_PATH="${HB}/lib:${DYLD_LIBRARY_PATH:-}"
  fi
fi

echo "Using: $PY ($("$PY" --version))"
if ! "$PY" -c "from xml.parsers import expat" 2>/dev/null; then
  echo "ERROR: pyexpat/xml failed even with DYLD_LIBRARY_PATH. Try:" >&2
  echo "  brew install expat && brew reinstall python@3.12" >&2
  echo "Or use Python from https://www.python.org/downloads/macos/ (not Homebrew)." >&2
  exit 1
fi

rm -rf .venv
"$PY" -m venv .venv --without-pip
curl -sS https://bootstrap.pypa.io/get-pip.py | .venv/bin/python3.12
.venv/bin/python3.12 -m pip install --upgrade pip setuptools wheel
echo "Done. Run: source .venv/bin/activate && pip install -e \".[local-ai,cloud-ai]\""
echo "Tip: if pip breaks later in this shell, export the same DYLD_LIBRARY_PATH (see README)."
