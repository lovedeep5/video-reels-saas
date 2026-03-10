"""
EC2 worker entry point.

Reads JOB_ID from env (set by Lambda dispatcher via EC2 UserData).
Runs the full pipeline, updates MongoDB, uploads clips to S3.
Shuts down the EC2 instance when done (startup.sh handles the actual shutdown).

Usage:
    JOB_ID=<mongo_object_id> python run_job.py
"""
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

# Add backend/ to path so we can reuse existing pipeline modules
REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from bson import ObjectId
from pymongo import MongoClient

# ── Config from environment (pulled from SSM by startup.sh) ──────────────────

MONGODB_URI     = os.environ["MONGODB_URI"]
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "vidtoreels")
S3_BUCKET       = os.environ["S3_BUCKET"]
AWS_REGION      = os.environ.get("AWS_REGION", "ap-south-1")
JOB_ID          = os.environ["JOB_ID"]

WHISPER_MODEL   = os.environ.get("WHISPER_MODEL", "base")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

TEMP_DIR   = Path("/tmp/vidtoreels")
OUTPUT_DIR = Path("/tmp/vidtoreels/output")
TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PLANS = {
    "free":     {"clips_per_video": 3,  "videos_per_month": 2,   "max_duration_seconds": 0},
    "pro":      {"clips_per_video": 10, "videos_per_month": 20,  "max_duration_seconds": 3600},
    "business": {"clips_per_video": 20, "videos_per_month": -1,  "max_duration_seconds": 10800},
}

# ── MongoDB helpers ───────────────────────────────────────────────────────────

_client = MongoClient(MONGODB_URI)
_db     = _client[MONGODB_DB_NAME]
jobs    = _db["jobs"]
users   = _db["users"]


def log(msg: str):
    """Timestamped print so CloudWatch shows clear progress."""
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)


def update_job(**fields):
    fields["updated_at"] = datetime.now(timezone.utc)
    jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": fields})
    log(f"[job] {fields}")


def fail_job(message: str):
    update_job(
        status="failed",
        progress=0,
        progress_message="Failed",
        error_message=message[:2000],
        completed_at=datetime.now(timezone.utc),
    )
    log(f"[FAIL] {message}")


# ── S3 upload ─────────────────────────────────────────────────────────────────

def upload_to_s3(local_path: str, s3_key: str) -> bool:
    import boto3
    try:
        s3 = boto3.client("s3", region_name=AWS_REGION)
        s3.upload_file(local_path, S3_BUCKET, s3_key, ExtraArgs={"ContentType": "video/mp4"})
        print(f"[s3] Uploaded → s3://{S3_BUCKET}/{s3_key}")
        return True
    except Exception as e:
        print(f"[s3] Upload failed: {e}", file=sys.stderr)
        return False


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run():
    log(f"====== run_job.py starting for job {JOB_ID} ======")
    job = jobs.find_one({"_id": ObjectId(JOB_ID)})
    if not job:
        log(f"[ERROR] Job {JOB_ID} not found in MongoDB")
        sys.exit(1)

    # Get user plan limits
    user = users.find_one({"_id": job["user_id"]})
    plan_key = user.get("plan", "free") if user else "free"
    plan = PLANS.get(plan_key, PLANS["free"])

    # Set env vars so pipeline modules can find their config
    os.environ["AWS_ACCESS_KEY_ID"]     = os.environ.get("AWS_ACCESS_KEY_ID", "")
    os.environ["AWS_SECRET_ACCESS_KEY"] = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    os.environ["AWS_REGION"]            = AWS_REGION
    os.environ["S3_BUCKET"]             = S3_BUCKET
    os.environ["OPENROUTER_API_KEY"]    = OPENROUTER_API_KEY

    log(f"user={job.get('user_id')} plan={plan_key} clips_requested={job.get('clips_requested')} url={job.get('source_url','')[:80]}")

    # Download user-specific cookies from S3 (if they exist)
    user_cookie_path = _fetch_user_cookies(str(job["user_id"]))

    try:
        _pipeline(job, plan, user_cookie_path)
    except Exception as e:
        fail_job(f"Unexpected error: {e}\n{traceback.format_exc()}")
        sys.exit(1)


def _fetch_user_cookies(user_id: str) -> str | None:
    """Download user-specific cookies from S3. Returns local path or None."""
    import boto3
    local_path = f"/tmp/youtube_cookies_user_{user_id}.txt"
    try:
        s3 = boto3.client("s3", region_name=AWS_REGION)
        s3.download_file(S3_BUCKET, f"users/{user_id}/youtube_cookies.txt", local_path)
        size = os.path.getsize(local_path)
        if size > 100:
            log(f"[cookies] User cookies loaded ({size} bytes) for user {user_id}")
            return local_path
        log(f"[cookies] User cookie file too small ({size} bytes), ignoring")
        return None
    except Exception as e:
        log(f"[cookies] No user cookies in S3 for user {user_id}: {e}")
        return None


def _pipeline(job: dict, plan: dict, user_cookie_path: str | None = None):
    from pipeline.downloader import download_video, get_video_info
    from pipeline.llm_scorer import select_clips_with_llm
    from pipeline.processor import check_ffmpeg, render_clip
    from pipeline.scorer import compute_audio_energy, select_best_clips
    from pipeline.tracker import get_crop_params
    from pipeline.transcriber import transcribe

    # ── 0. FFmpeg check ───────────────────────────────────────────────────────
    if not check_ffmpeg():
        fail_job("FFmpeg not found on this instance")
        return

    # ── 1. Download video ─────────────────────────────────────────────────────
    update_job(status="downloading", progress=5, progress_message="Downloading video...")
    try:
        info = download_video(job["source_url"], TEMP_DIR, JOB_ID, cookie_file=user_cookie_path)
        source_path = info["path"]
        video_title    = info["title"]
        video_duration = info["duration"]
        jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {
            "video_title": video_title,
            "video_duration": video_duration,
        }})
    except Exception as e:
        fail_job(f"Download failed: {e}")
        return

    # Get actual dimensions
    try:
        vinfo = get_video_info(source_path)
        src_w = vinfo["width"]
        src_h = vinfo["height"]
        if not video_duration:
            video_duration = vinfo["duration"]
    except Exception:
        src_w, src_h = 1920, 1080

    # ── 2. Plan duration check ────────────────────────────────────────────────
    max_dur = plan.get("max_duration_seconds", 0)
    if max_dur and video_duration > max_dur:
        fail_job(f"Video duration ({int(video_duration)}s) exceeds plan limit ({max_dur}s)")
        return

    # ── 3. Transcribe ─────────────────────────────────────────────────────────
    update_job(status="processing", progress=20, progress_message="Transcribing audio...")
    segments = transcribe(source_path, WHISPER_MODEL, str(TEMP_DIR))
    log(f"[pipeline] transcription done — {len(segments)} segments")

    # ── 4. LLM clip selection ─────────────────────────────────────────────────
    n_clips = job.get("clips_requested", plan["clips_per_video"])
    candidates = []
    if segments:
        update_job(progress=38, progress_message="AI selecting best moments...")
        candidates = select_clips_with_llm(
            segments=segments,
            duration=video_duration,
            n_clips=n_clips,
            video_title=video_title,
            clip_duration=35.0,
        )

    # Fallback: audio energy scoring
    if not candidates:
        log("[pipeline] LLM returned no candidates — falling back to audio energy scoring")
        update_job(progress=38, progress_message="Analyzing audio energy...")
        energy = compute_audio_energy(source_path, str(TEMP_DIR))
        candidates = select_best_clips(
            duration=video_duration,
            segments=segments,
            energy=energy,
            n_clips=n_clips,
            clip_duration=35.0,
            min_clip=28.0,
            max_clip=42.0,
            stride=3.0,
        )

    if not candidates:
        fail_job("Could not identify suitable clip segments in this video")
        return

    # ── 5. Render clips ───────────────────────────────────────────────────────
    out_dir = OUTPUT_DIR / JOB_ID
    out_dir.mkdir(parents=True, exist_ok=True)

    # Determine output dimensions from ratio
    ratio = job.get("output_ratio", "9:16")
    RATIO_MAP = {
        "9:16": (1080, 1920), "1:1": (1080, 1080),
        "4:5": (1080, 1350),  "16:9": (1920, 1080),
    }
    out_w, out_h = RATIO_MAP.get(ratio, (1080, 1920))

    output_clips = []
    output_clip_metadata = []
    total = len(candidates)

    for idx, cand in enumerate(candidates):
        pct = 50 + int(45 * idx / total)
        update_job(progress=pct, progress_message=f"Rendering clip {idx + 1}/{total}...")

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
            s3_key = f"users/{job['user_id']}/jobs/{JOB_ID}/clip_{idx + 1}.mp4"
            if upload_to_s3(out_path, s3_key):
                output_clips.append(s3_key)
                output_clip_metadata.append({
                    "clip_index": idx,
                    "s3_key": s3_key,
                    "start_time": round(float(cand["start"]), 1),
                    "end_time": round(float(cand["end"]), 1),
                    "duration": round(float(cand["end"]) - float(cand["start"]), 1),
                    "importance_score": round(float(cand.get("score", 0)), 3),
                    "transcript_excerpt": cand.get("transcript") or None,
                    "yt_title": cand.get("yt_title") or None,
                    "yt_description": cand.get("yt_description") or None,
                    "yt_tags": cand.get("yt_tags") or [],
                })
                Path(out_path).unlink(missing_ok=True)
            else:
                log(f"[pipeline] S3 upload failed for clip {idx + 1}, skipping")
        else:
            log(f"[pipeline] Render failed for clip {idx + 1}")

    # ── 6. Cleanup source file ────────────────────────────────────────────────
    try:
        Path(source_path).unlink(missing_ok=True)
    except Exception:
        pass

    # ── 7. Finish ─────────────────────────────────────────────────────────────
    if not output_clips:
        fail_job("All clips failed to render or upload")
        return

    jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {
        "status": "completed",
        "progress": 100,
        "progress_message": f"{len(output_clips)}/{total} clips ready",
        "output_clips": output_clips,
        "output_clip_metadata": output_clip_metadata,
        "completed_at": datetime.now(timezone.utc),
    }})
    log(f"====== Job {JOB_ID} completed — {len(output_clips)}/{total} clips uploaded to S3 ======")


if __name__ == "__main__":
    run()
