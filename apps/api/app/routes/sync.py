from fastapi import APIRouter

from app.schemas import (
    SyncPullRequest,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.services.sync_service import pull as pull_svc
from app.services.sync_service import push as push_svc

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/push", response_model=SyncPushResponse)
def post_push(req: SyncPushRequest) -> SyncPushResponse:
    return push_svc(req)


@router.post("/pull", response_model=SyncPullResponse)
def post_pull(req: SyncPullRequest) -> SyncPullResponse:
    return pull_svc(req)
