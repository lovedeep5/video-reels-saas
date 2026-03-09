from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from auth import get_current_user
from config import PLANS
from database import Clip, Job, User, get_db

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class UsageOut(BaseModel):
    videos_used: int
    videos_limit: int          # -1 = unlimited
    clips_per_video: int
    plan: str


class ClipOut(BaseModel):
    id: int
    clip_index: int
    start_time: float
    end_time: float
    duration: float
    importance_score: float
    transcript_excerpt: Optional[str]
    file_ready: bool
    s3_key: Optional[str]


class JobOut(BaseModel):
    id: int
    status: str
    progress: int
    progress_message: str
    source_type: str
    source_url: Optional[str]
    source_filename: Optional[str]
    video_title: Optional[str]
    video_duration: Optional[float]
    clips_requested: int
    output_ratio: str
    error_message: Optional[str]
    created_at: str
    completed_at: Optional[str]
    clips: List[ClipOut]


def _clip_to_out(c: Clip) -> ClipOut:
    return ClipOut(
        id=c.id,
        clip_index=c.clip_index,
        start_time=c.start_time,
        end_time=c.end_time,
        duration=c.duration,
        importance_score=c.importance_score,
        transcript_excerpt=c.transcript_excerpt,
        file_ready=bool(c.file_path or c.s3_key),
        s3_key=c.s3_key,
    )


def _job_to_out(job: Job) -> JobOut:
    return JobOut(
        id=job.id,
        status=job.status,
        progress=job.progress,
        progress_message=job.progress_message,
        source_type=job.source_type,
        source_url=job.source_url,
        source_filename=job.source_filename,
        video_title=job.video_title,
        video_duration=job.video_duration,
        clips_requested=job.clips_requested,
        output_ratio=job.output_ratio or "9:16",
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        clips=[_clip_to_out(c) for c in job.clips],
    )


@router.get("", response_model=List[JobOut])
def list_jobs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    jobs = (
        db.query(Job)
        .filter(Job.user_id == current_user.id)
        .order_by(Job.created_at.desc())
        .limit(50)
        .all()
    )
    return [_job_to_out(j) for j in jobs]


# NOTE: /usage must be defined BEFORE /{job_id} so FastAPI doesn't try to
# parse the literal string "usage" as an integer job_id.
@router.get("/usage", response_model=UsageOut)
def get_usage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return this month's video usage against the user's plan limits."""
    plan = PLANS.get(current_user.plan, PLANS["free"])
    start_of_month = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    BILLABLE_STATUSES = ("downloading", "processing", "done", "failed")
    used = (
        db.query(Job)
        .filter(
            Job.user_id == current_user.id,
            Job.created_at >= start_of_month,
            Job.status.in_(BILLABLE_STATUSES),
        )
        .count()
    )
    return UsageOut(
        videos_used=used,
        videos_limit=plan["videos_per_month"],
        clips_per_video=plan["clips_per_video"],
        plan=current_user.plan,
    )


@router.delete("/{job_id}")
def delete_failed_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a failed job and all associated files. Only failed jobs can be deleted."""
    import shutil
    from config import settings

    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "failed":
        raise HTTPException(status_code=400, detail="Only failed jobs can be deleted.")

    # Delete rendered clips folder
    out_dir = settings.OUTPUT_DIR / str(job_id)
    if out_dir.exists():
        shutil.rmtree(out_dir, ignore_errors=True)

    # Delete source video (try all common extensions)
    for ext in ("mp4", "mkv", "webm", "avi", "mov"):
        src = settings.TEMP_DIR / f"source_{job_id}.{ext}"
        if src.exists():
            src.unlink(missing_ok=True)

    # Delete DB record (clips cascade automatically)
    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_out(job)


@router.get("/{job_id}/clips/{clip_id}/download")
def download_clip(
    job_id: int,
    clip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    clip = db.query(Clip).filter(Clip.id == clip_id, Clip.job_id == job_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    if not clip.file_path and not clip.s3_key:
        raise HTTPException(status_code=400, detail="Clip not yet rendered")

    filename = f"reel_{job_id}_clip{clip.clip_index + 1}.mp4"

    if clip.s3_key:
        from pipeline.s3 import stream_clip
        body, content_length = stream_clip(clip.s3_key)
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        if content_length:
            headers["Content-Length"] = str(content_length)
        return StreamingResponse(body, media_type="video/mp4", headers=headers)

    return FileResponse(clip.file_path, media_type="video/mp4", filename=filename)
