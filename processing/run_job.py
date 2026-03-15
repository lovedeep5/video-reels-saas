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

WHISPER_MODEL   = os.environ.get("WHISPER_MODEL", "tiny")
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
    is_admin = bool(user.get("is_admin", False)) if user else False

    # Set env vars so pipeline modules can find their config
    os.environ["AWS_ACCESS_KEY_ID"]     = os.environ.get("AWS_ACCESS_KEY_ID", "")
    os.environ["AWS_SECRET_ACCESS_KEY"] = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    os.environ["AWS_REGION"]            = AWS_REGION
    os.environ["S3_BUCKET"]             = S3_BUCKET
    os.environ["OPENROUTER_API_KEY"]    = OPENROUTER_API_KEY

    log(f"user={job.get('user_id')} plan={plan_key} source_type={job.get('source_type','url')} clips_requested={job.get('clips_requested')} url={(job.get('source_url') or '')[:80]}")

    try:
        if job.get("source_type") == "faceless":
            _faceless_pipeline(job)
        else:
            _pipeline(job, plan)
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


def _faceless_pipeline(job: dict):
    """Generate a faceless video from scratch using AI (script + images + TTS + assembly)."""
    from pipeline.faceless.script_gen import generate_script
    from pipeline.faceless.tts_engine import generate_segment_audios
    from pipeline.faceless.image_gen import generate_segment_images
    from pipeline.faceless.assembler import assemble_video
    import shutil

    topic = job.get("faceless_topic", "An amazing fact about the world")
    style = job.get("faceless_style", "ghibli")
    voice = job.get("faceless_voice", "andrew")
    duration = job.get("faceless_duration", 30)

    work_dir = TEMP_DIR / JOB_ID
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    # 1. Generate script
    update_job(status="processing", progress=5, progress_message="AI writing script...")
    script = generate_script(topic=topic, duration_seconds=duration, style=style)
    video_title = script.get("title", topic[:50])
    jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {
        "video_title": video_title,
        "video_duration": duration,
    }})

    # 2. Generate TTS audio
    update_job(progress=20, progress_message="Generating narration audio...")
    audio_dir = str(work_dir / "audio")
    audio_paths = generate_segment_audios(script["segments"], audio_dir, voice_name=voice)
    log(f"[faceless] TTS done — {len(audio_paths)} audio files")

    # 3. Generate AI images
    update_job(progress=35, progress_message="Generating AI images...")
    image_dir = str(work_dir / "images")
    image_paths = generate_segment_images(script["segments"], image_dir)
    log(f"[faceless] Images done — {len(image_paths)} images")

    # 4. Assemble video
    update_job(status="rendering", progress=70, progress_message="Assembling video...")
    output_path = str(work_dir / "faceless_output.mp4")
    assemble_video(
        image_paths=image_paths,
        audio_paths=audio_paths,
        segments=script["segments"],
        output_path=output_path,
        title=video_title,
    )
    log(f"[faceless] Video assembled: {output_path}")

    # 5. Upload to S3
    update_job(progress=85, progress_message="Uploading to cloud...")
    s3_key = f"users/{job['user_id']}/jobs/{JOB_ID}/clip_1.mp4"
    if not upload_to_s3(output_path, s3_key):
        fail_job("Failed to upload faceless video to S3")
        return

    # 6. Generate YouTube metadata from the script
    full_transcript = " ".join(seg["text"] for seg in script["segments"])
    yt_title = None
    yt_description = None
    yt_tags = []
    if OPENROUTER_API_KEY:
        update_job(progress=92, progress_message="Generating YouTube metadata...")
        try:
            from pipeline.llm_scorer import generate_clip_metadata
            meta = generate_clip_metadata(
                transcript=full_transcript,
                video_title=video_title,
                clip_index=0,
                api_key=OPENROUTER_API_KEY,
            )
            yt_title = meta.get("yt_title") or None
            yt_description = meta.get("yt_description") or None
            yt_tags = meta.get("yt_tags") or []
            log(f"[faceless] YT metadata: title={yt_title[:60] if yt_title else 'none'}")
        except Exception as e:
            log(f"[faceless] YT metadata generation failed (non-fatal): {e}")

    # 7. Cleanup
    try:
        shutil.rmtree(work_dir)
    except Exception:
        pass

    # 8. Complete
    jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {
        "status": "completed",
        "progress": 100,
        "progress_message": "Faceless video ready",
        "output_clips": [s3_key],
        "output_clip_metadata": [{
            "clip_index": 0,
            "s3_key": s3_key,
            "start_time": 0,
            "end_time": float(duration),
            "duration": float(duration),
            "importance_score": 1.0,
            "transcript_excerpt": full_transcript[:500] if full_transcript else None,
            "yt_title": yt_title,
            "yt_description": yt_description,
            "yt_tags": yt_tags,
        }],
        "completed_at": datetime.now(timezone.utc),
    }})
    log(f"====== Faceless job {JOB_ID} completed ======")


def _pipeline(job: dict, plan: dict):
    from pipeline.downloader import download_video, get_video_info, BotDetectionError
    from pipeline.llm_scorer import select_clips_with_llm
    from pipeline.processor import check_ffmpeg, render_clip
    from pipeline.scorer import compute_audio_energy, select_best_clips
    from pipeline.tracker import get_crop_params
    from pipeline.transcriber import transcribe

    # ── 0. FFmpeg check ───────────────────────────────────────────────────────
    if not check_ffmpeg():
        fail_job("FFmpeg not found on this instance")
        return

    # ── 1. Download video (try without cookies first, fallback to user cookies) ─
    update_job(status="downloading", progress=5, progress_message="Downloading video...")
    info = None
    try:
        info = download_video(job["source_url"], TEMP_DIR, JOB_ID, cookie_file=None)
        log("[downloader] Downloaded without cookies")
    except BotDetectionError as e:
        log(f"[downloader] Bot detection without cookies: {e}")
        # Lazy-fetch user cookies only when needed
        update_job(progress=8, progress_message="YouTube blocked — retrying with your cookies...")
        admin_retry_user_id = job.get("admin_retry_user_id")
        user_cookie_path = _fetch_user_cookies(str(job["user_id"]))
        if user_cookie_path:
            try:
                info = download_video(job["source_url"], TEMP_DIR, JOB_ID, cookie_file=user_cookie_path)
                log("[downloader] Downloaded with user cookies")
            except BotDetectionError as e2:
                log(f"[downloader] Bot detection with user cookies: {e2}")
                if admin_retry_user_id:
                    update_job(progress=10, progress_message="Retrying with admin cookies...")
                    admin_cookie_path = _fetch_user_cookies(admin_retry_user_id)
                    if admin_cookie_path:
                        try:
                            info = download_video(job["source_url"], TEMP_DIR, JOB_ID, cookie_file=admin_cookie_path)
                            log("[downloader] Downloaded with admin cookies")
                        except BotDetectionError as e3:
                            jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {"error_type": "cookie_required"}})
                            fail_job(f"YouTube blocked even with admin cookies. ({e3})")
                            return
                        except Exception as e3:
                            fail_job(f"Download failed with admin cookies: {e3}")
                            return
                    else:
                        jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {"error_type": "cookie_required"}})
                        fail_job("YouTube blocked this download. No admin cookies available either.")
                        return
                else:
                    jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {"error_type": "cookie_required"}})
                    fail_job(f"YouTube blocked the download even with your cookies. Try re-syncing your cookies via the Chrome extension. ({e2})")
                    return
            except Exception as e2:
                fail_job(f"Download failed after cookie retry: {e2}")
                return
        elif admin_retry_user_id:
            # No user cookies — try admin cookies directly
            update_job(progress=10, progress_message="Retrying with admin cookies...")
            admin_cookie_path = _fetch_user_cookies(admin_retry_user_id)
            if admin_cookie_path:
                try:
                    info = download_video(job["source_url"], TEMP_DIR, JOB_ID, cookie_file=admin_cookie_path)
                    log("[downloader] Downloaded with admin cookies")
                except BotDetectionError as e3:
                    jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {"error_type": "cookie_required"}})
                    fail_job(f"YouTube blocked even with admin cookies. ({e3})")
                    return
                except Exception as e3:
                    fail_job(f"Download failed with admin cookies: {e3}")
                    return
            else:
                jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {"error_type": "cookie_required"}})
                fail_job("YouTube blocked this download. No admin cookies available either.")
                return
        else:
            # No cookies available — mobile user or never synced
            jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {"error_type": "cookie_required"}})
            fail_job("YouTube blocked this download. Sync your YouTube cookies using the Chrome extension on a desktop browser, then retry.")
            return
    except Exception as e:
        fail_job(f"Download failed: {e}")
        return

    source_path = info["path"]
    video_title    = info["title"]
    video_duration = info["duration"]
    jobs.update_one({"_id": ObjectId(JOB_ID)}, {"$set": {
        "video_title": video_title,
        "video_duration": video_duration,
    }})

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
    if max_dur and video_duration > max_dur and not is_admin:
        fail_job(f"Video duration ({int(video_duration)}s) exceeds plan limit ({max_dur}s)")
        return

    # ── 3. Transcribe ─────────────────────────────────────────────────────────
    include_captions = job.get("include_captions", False)
    update_job(status="processing", progress=20, progress_message="Transcribing audio...")
    # task="translate" forces English output for any source language (Hindi, etc.)
    segments = transcribe(source_path, WHISPER_MODEL, str(TEMP_DIR), task="translate" if include_captions else "transcribe")
    log(f"[pipeline] transcription done — {len(segments)} segments")

    # ── 4. LLM clip selection ─────────────────────────────────────────────────
    from pipeline.llm_scorer import generate_clip_metadata
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

    # ── 4b. Generate YouTube metadata for each clip ───────────────────────────
    if OPENROUTER_API_KEY:
        update_job(progress=45, progress_message="Generating YouTube metadata...")
        for idx, cand in enumerate(candidates):
            transcript_text = cand.get("transcript", "")
            meta = generate_clip_metadata(
                transcript=transcript_text,
                video_title=video_title,
                clip_index=idx,
                api_key=OPENROUTER_API_KEY,
            )
            cand["yt_title"] = meta["yt_title"]
            cand["yt_description"] = meta["yt_description"]
            cand["yt_tags"] = meta["yt_tags"]
            log(f"[pipeline] clip {idx} metadata: title={meta['yt_title'][:50]}")

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

        # Generate ASS subtitle file for this clip if captions requested
        subtitle_path = None
        if include_captions and segments:
            from pipeline.transcriber import generate_ass
            ass_content = generate_ass(segments, cand["start"], cand["end"], out_w, out_h)
            subtitle_path = str(out_dir / f"sub_{idx + 1}.ass")
            Path(subtitle_path).write_text(ass_content, encoding="utf-8")

        success = render_clip(
            source_path=source_path,
            output_path=out_path,
            start_time=cand["start"],
            duration=cand["end"] - cand["start"],
            crop_params=crop_params,
            subtitle_path=subtitle_path,
        )

        if subtitle_path:
            Path(subtitle_path).unlink(missing_ok=True)

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
