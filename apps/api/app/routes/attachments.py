from fastapi import APIRouter

from app.schemas import UploadUrlRequest, UploadUrlResponse
from app.services.supabase_service import get_supabase

router = APIRouter(prefix="/attachments", tags=["attachments"])

BUCKET = "attachments"


@router.post("/upload-url", response_model=UploadUrlResponse)
def post_upload_url(req: UploadUrlRequest) -> UploadUrlResponse:
    sb = get_supabase()
    path = f"{req.note_id}/{req.attachment_id}_{req.file_name}"
    info = sb.signed_upload_url(BUCKET, path, req.mime_type)
    return UploadUrlResponse(**info)
