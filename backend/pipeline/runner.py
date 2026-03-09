"""
Pipeline runner — orchestrates the full video → reels processing pipeline.
Runs in a background thread; updates Job status in DB throughout.
"""
import threading
import traceback
from datetime import datetime, timezone
from pathlib import Path

from config import settings, parse_ratio
from database import Clip, Job, SessionLocal
from pipeline.downloader import download_video, get_video_info
from pipeline.llm_scorer import select_clips_with_llm
from pipeline.processor import check_ffmpeg, render_clip
from pipeline.s3 import s3_enabled, upload_clip
from pipeline.scorer import compute_audio_energy, select_best_clips
from pipeline.tracker import get_crop_params
from pipeline.transcriber import transcribe

_executor_lock = threading.Semaphore(2)  # max 2 concurrent jobs


def submit_job(job_id: int):
    """Launch pipeline in a daemon thread."""
    t = threading.Thread(target=_run_safe, args=(job_id,), daemon=True)
    t.start()


def _run_safe(job_id: int):
    with _executor_lock:
        try:
            _run_pipeline(job_id)
        except Exception as e:
            _fail(job_id, f"Unexpected error: {e}\n{traceback.format_exc()}")


def _run_pipeline(job_id: int):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return

        # ── 0. Check FFmpeg ───────────────────────────────────────────────────
        if not check_ffmpeg():
            _fail(job_id, "FFmpeg not found. Please install FFmpeg and add to PATH.")
            return

        # ── 1. Download / locate source video ────────────────────────────────
        _update(db, job, status="downloading", progress=5, msg="Downloading video...")

        if job.source_type == "url":
            try:
                print(f"[runner] job_id={job_id} source_url={job.source_url}")
                info = download_video(job.source_url, settings.TEMP_DIR, job_id)
                source_path = info["path"]
                job.video_title = info["title"]
                job.video_duration = info["duration"]
                job.source_path = source_path
            except Exception as e:
                _fail(job_id, f"Download failed: {e}")
                return
        else:
            source_path = job.source_path
            if not source_path or not Path(source_path).exists():
                _fail(job_id, "Uploaded file not found")
                return

        # Get video dimensions via ffprobe
        try:
            vinfo = get_video_info(source_path)
            if not job.video_duration or job.video_duration == 0:
                job.video_duration = vinfo["duration"]
            src_w = vinfo["width"]
            src_h = vinfo["height"]
        except Exception as e:
            print(f"[runner] ffprobe warning: {e}")
            src_w, src_h = 1920, 1080

        db.commit()
        duration = job.video_duration or 0

        # ── 2. Check plan duration limit ──────────────────────────────────────
        from config import PLANS
        plan = PLANS.get(job.user.plan if job.user else "free", PLANS["free"])
        max_dur = plan["max_duration_seconds"]
        if max_dur and duration > max_dur:
            _fail(job_id, f"Video duration ({int(duration)}s) exceeds plan limit ({max_dur}s). Upgrade your plan.")
            return

        # ── 3a. Transcribe audio ──────────────────────────────────────────────
        _update(db, job, status="processing", progress=20, msg="Transcribing audio...")
        segments = transcribe(source_path, settings.WHISPER_MODEL, str(settings.TEMP_DIR))
        print(f"[runner] Transcription: {len(segments)} segments")

        # ── 3b. LLM clip selection ────────────────────────────────────────────
        candidates = []
        if segments:
            _update(db, job, progress=38, msg="AI selecting best moments...")
            candidates = select_clips_with_llm(
                segments=segments,
                duration=duration,
                n_clips=job.clips_requested,
                video_title=job.video_title,
                clip_duration=35.0,
            )
            if candidates:
                print(f"[runner] LLM selected clips:")
                for c in candidates:
                    print(f"  {c['start']}s - {c['end']}s | {c['transcript'][:80]}")

        # ── 3c. Fallback: audio energy scoring ────────────────────────────────
        if not candidates:
            print("[runner] Falling back to audio energy scoring")
            _update(db, job, progress=38, msg="Analyzing audio energy...")
            energy = compute_audio_energy(source_path, str(settings.TEMP_DIR))
            candidates = select_best_clips(
                duration=duration,
                segments=segments,
                energy=energy,
                n_clips=job.clips_requested,
                clip_duration=35.0,
                min_clip=28.0,
                max_clip=42.0,
                stride=3.0,
            )

        if not candidates:
            _fail(job_id, "Could not identify suitable clip segments in this video")
            return

        # ── 4. Create Clip DB records ─────────────────────────────────────────
        out_dir = settings.OUTPUT_DIR / str(job_id)
        out_dir.mkdir(parents=True, exist_ok=True)

        clips_in_db = []
        for i, cand in enumerate(candidates):
            clip = Clip(
                job_id=job_id,
                clip_index=i,
                start_time=cand["start"],
                end_time=cand["end"],
                duration=cand["end"] - cand["start"],
                importance_score=round(cand["score"], 4),
            )
            db.add(clip)
            clips_in_db.append((clip, cand))
        db.commit()
        for c, _ in clips_in_db:
            db.refresh(c)

        # ── 5. Render each clip ───────────────────────────────────────────────
        out_w, out_h = parse_ratio(job.output_ratio or "9:16")
        total = len(clips_in_db)
        for idx, (clip, cand) in enumerate(clips_in_db):
            pct = 50 + int(45 * idx / total)
            _update(db, job, progress=pct, msg=f"Rendering clip {idx + 1}/{total}...")

            crop_params = get_crop_params(
                source_path,
                cand["start"], cand["end"],
                src_w, src_h,
                out_w=out_w, out_h=out_h,
            )

            out_path = str(out_dir / f"clip_{idx + 1}.mp4")
            success = render_clip(
                source_path=source_path,
                output_path=out_path,
                start_time=cand["start"],
                duration=cand["end"] - cand["start"],
                crop_params=crop_params,
            )

            if success and Path(out_path).exists():
                clip.file_size = Path(out_path).stat().st_size
                if s3_enabled():
                    s3_key = f"users/{job.user_id}/jobs/{job_id}/clip_{idx + 1}.mp4"
                    if upload_clip(out_path, s3_key):
                        clip.s3_key = s3_key
                        try:
                            Path(out_path).unlink(missing_ok=True)
                        except Exception:
                            pass
                    else:
                        clip.file_path = out_path  # keep local as fallback
                else:
                    clip.file_path = out_path
                db.commit()
            else:
                print(f"[runner] Clip {idx + 1} render failed")

        # ── 6. Clean up temp source file ─────────────────────────────────────
        if job.source_type == "url" and job.source_path:
            try:
                Path(job.source_path).unlink(missing_ok=True)
                print(f"[runner] Deleted temp source: {job.source_path}")
            except Exception as e:
                print(f"[runner] Could not delete temp source: {e}")

        # ── 7. Done ───────────────────────────────────────────────────────────
        rendered = sum(1 for c, _ in clips_in_db if c.file_path or c.s3_key)
        if rendered == 0:
            _fail(job_id, "All clips failed to render. Check FFmpeg installation.")
            return

        job.status = "done"
        job.progress = 100
        job.progress_message = f"{rendered}/{total} clips ready"
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        _fail(job_id, f"Pipeline error: {e}\n{traceback.format_exc()}")
    finally:
        db.close()


def _update(db, job: Job, status: str = None, progress: int = None, msg: str = None):
    if status:
        job.status = status
    if progress is not None:
        job.progress = progress
    if msg:
        job.progress_message = msg
    db.commit()


def _fail(job_id: int, message: str):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.progress_message = "Failed"
            job.error_message = message[:1000]
            db.commit()
    finally:
        db.close()
