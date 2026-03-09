import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from config import PLANS, settings
from database import Job, User, get_db
from pipeline.runner import submit_job

router = APIRouter(prefix="/api/videos", tags=["videos"])

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


def _check_plan_limits(user: User, db: Session):
    """Raise 403 if user has hit their monthly video limit.

    Only counts jobs that actually consumed resources (not failed/pending ones
    that never started) so a failed download doesn't eat a slot.
    """
    plan = PLANS.get(user.plan, PLANS["free"])
    limit = plan["videos_per_month"]
    if limit == -1:
        return  # unlimited

    from datetime import datetime, timezone
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Count jobs that have progressed past the queued state
    BILLABLE_STATUSES = ("downloading", "processing", "done", "failed")
    count = (
        db.query(Job)
        .filter(
            Job.user_id == user.id,
            Job.created_at >= start_of_month,
            Job.status.in_(BILLABLE_STATUSES),
        )
        .count()
    )
    if count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Monthly video limit reached ({count}/{limit}). Upgrade your plan to process more videos.",
        )


class SubmitURLRequest(BaseModel):
    url: str
    clips_requested: int = 5
    output_ratio: str = "9:16"


class JobCreatedResponse(BaseModel):
    job_id: int
    message: str


@router.post("/submit-url", response_model=JobCreatedResponse)
def submit_url(
    data: SubmitURLRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_plan_limits(current_user, db)

    plan = PLANS.get(current_user.plan, PLANS["free"])
    clips = min(data.clips_requested, plan["clips_per_video"])

    job = Job(
        user_id=current_user.id,
        source_type="url",
        source_url=data.url,
        clips_requested=clips,
        output_ratio=data.output_ratio,
        status="pending",
        progress=0,
        progress_message="Queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    submit_job(job.id)
    return JobCreatedResponse(job_id=job.id, message="Job created and queued")


@router.post("/upload", response_model=JobCreatedResponse)
async def upload_video(
    file: UploadFile = File(...),
    clips_requested: int = Form(5),
    output_ratio: str = Form("9:16"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_plan_limits(current_user, db)

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    plan = PLANS.get(current_user.plan, PLANS["free"])
    clips = min(clips_requested, plan["clips_per_video"])

    uid = uuid.uuid4().hex
    save_path = settings.UPLOAD_DIR / f"{uid}{ext}"

    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    job = Job(
        user_id=current_user.id,
        source_type="upload",
        source_filename=file.filename,
        source_path=str(save_path),
        clips_requested=clips,
        output_ratio=output_ratio,
        status="pending",
        progress=0,
        progress_message="Queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    submit_job(job.id)
    return JobCreatedResponse(job_id=job.id, message="Upload received and queued")
