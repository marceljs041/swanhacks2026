from datetime import datetime, timedelta, timezone
from secrets import randbelow
from threading import RLock

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.schemas import PairConfirmRequest, PairConfirmResponse, PairStartResponse

router = APIRouter(prefix="/devices", tags=["devices"])

# In-memory pairing table (good enough for the demo). Each code maps to a
# user_id and originating device. Confirming consumes the code.
_PAIRINGS: dict[str, dict] = {}
_LOCK = RLock()


def _make_code() -> str:
    return f"{randbelow(1_000_000):06d}"


@router.post("/pair/start", response_model=PairStartResponse)
def post_pair_start() -> PairStartResponse:
    user_id = get_settings().demo_user_id
    code = _make_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    with _LOCK:
        _PAIRINGS[code] = {
            "user_id": user_id,
            "device_id": None,
            "expires_at": expires.isoformat(),
        }
    return PairStartResponse(code=code, user_id=user_id, expires_at=expires.isoformat())


@router.post("/pair/confirm", response_model=PairConfirmResponse)
def post_pair_confirm(req: PairConfirmRequest) -> PairConfirmResponse:
    with _LOCK:
        info = _PAIRINGS.pop(req.code, None)
    if not info:
        raise HTTPException(status_code=404, detail="invalid_or_expired_code")
    if info["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=410, detail="code_expired")
    return PairConfirmResponse(user_id=info["user_id"], paired_device_id=req.device_id)
