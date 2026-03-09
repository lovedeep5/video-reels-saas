import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from database import init_db
from routers import auth, billing, jobs, keys, videos


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _apply_migrations()
    _cancel_orphaned_jobs()
    yield


def _apply_migrations():
    """Add columns introduced after the initial schema without dropping data."""
    import sqlite3
    from config import BASE_DIR
    db_path = str(BASE_DIR / "storage" / "app.db")
    conn = sqlite3.connect(db_path)
    try:
        existing = {row[1] for row in conn.execute("PRAGMA table_info(api_keys)")}
        if "expires_at" not in existing:
            conn.execute("ALTER TABLE api_keys ADD COLUMN expires_at DATETIME")
            conn.commit()
            print("[migration] Added expires_at to api_keys")

        job_cols = {row[1] for row in conn.execute("PRAGMA table_info(jobs)")}
        if "output_ratio" not in job_cols:
            conn.execute("ALTER TABLE jobs ADD COLUMN output_ratio VARCHAR DEFAULT '9:16' NOT NULL")
            conn.commit()
            print("[migration] Added output_ratio to jobs")

        clip_cols = {row[1] for row in conn.execute("PRAGMA table_info(clips)")}
        if "s3_key" not in clip_cols:
            conn.execute("ALTER TABLE clips ADD COLUMN s3_key VARCHAR")
            conn.commit()
            print("[migration] Added s3_key to clips")

        user_cols = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
        if "clerk_id" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN clerk_id VARCHAR")
            conn.commit()
            print("[migration] Added clerk_id to users")

        # Ensure the unique index on clerk_id exists (may be missing if column was
        # added via migration rather than created fresh from the ORM schema).
        existing_indexes = {row[1] for row in conn.execute("SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='users'")}
        if "ix_users_clerk_id" not in existing_indexes:
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_clerk_id ON users (clerk_id) WHERE clerk_id IS NOT NULL")
            conn.commit()
            print("[migration] Created unique index on users.clerk_id")
    finally:
        conn.close()


def _cancel_orphaned_jobs():
    """
    On startup, any job still in an in-progress state was interrupted by a
    previous server shutdown. Mark them failed so they don't hang forever.
    """
    from database import Job, SessionLocal
    STUCK_STATUSES = ("pending", "downloading", "processing")
    db = SessionLocal()
    try:
        stuck = db.query(Job).filter(Job.status.in_(STUCK_STATUSES)).all()
        if stuck:
            for job in stuck:
                job.status = "failed"
                job.error_message = "Server was restarted while this job was running. Please resubmit."
                job.progress_message = "Interrupted by server restart"
            db.commit()
            print(f"[startup] Marked {len(stuck)} interrupted job(s) as failed.")
    finally:
        db.close()


app = FastAPI(
    title="VidToReels API",
    description="AI-powered video-to-reels SaaS platform — vidtoreels.com",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(videos.router)
app.include_router(jobs.router)
app.include_router(billing.router)
app.include_router(keys.router)


@app.get("/api/auth/debug-token")
def debug_token(request: Request):
    """
    Temporary debug endpoint — call this from the frontend to see exactly
    what token arrives and why it is accepted or rejected.
    Remove before going to production.
    """
    import jwt as pyjwt
    from config import settings
    from auth import _get_authorized_parties

    auth_header = request.headers.get("Authorization", "")
    result: dict = {
        "header_present": bool(auth_header),
        "starts_with_bearer": auth_header.startswith("Bearer "),
        "authorized_parties_config": list(_get_authorized_parties()),
        "jwks_url": settings.CLERK_JWKS_URL,
    }

    if not auth_header.startswith("Bearer "):
        result["error"] = "No Bearer token in Authorization header"
        return result

    token = auth_header[7:]
    result["token_prefix"] = token[:20] + "..."

    # Decode header + claims WITHOUT verifying signature
    try:
        unverified_header = pyjwt.get_unverified_header(token)
        unverified_claims = pyjwt.decode(token, options={"verify_signature": False})
        result["unverified_header"] = unverified_header
        result["unverified_claims"] = {
            k: v for k, v in unverified_claims.items()
            if k in ("sub", "sid", "iss", "azp", "exp", "iat", "nbf")
        }
        import time
        result["server_time"] = int(time.time())
        result["token_expired"] = unverified_claims.get("exp", 0) < time.time()
        azp = unverified_claims.get("azp")
        allowed = _get_authorized_parties()
        result["azp_value"] = azp
        result["azp_allowed"] = (not azp) or (not allowed) or (azp in allowed)
    except Exception as e:
        result["decode_error"] = str(e)
        return result

    # Try full verification
    try:
        from auth import _verify_clerk_token
        _verify_clerk_token(token)
        result["verification"] = "SUCCESS"
    except Exception as e:
        result["verification"] = "FAILED"
        result["verification_error"] = f"{type(e).__name__}: {e}"

    return result


@app.get("/api/health")
def health():
    import shutil
    import subprocess
    checks = {}

    # ── Backend ───────────────────────────────────────────────────────────────
    checks["backend"] = {"ok": True, "detail": "running"}

    # ── Database ──────────────────────────────────────────────────────────────
    try:
        from database import SessionLocal, User
        db = SessionLocal()
        db.query(User).limit(1).all()
        db.close()
        checks["database"] = {"ok": True, "detail": "sqlite reachable"}
    except Exception as e:
        checks["database"] = {"ok": False, "detail": str(e)}

    # ── FFmpeg ────────────────────────────────────────────────────────────────
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        ver = r.stdout.decode().splitlines()[0] if r.returncode == 0 else None
        checks["ffmpeg"] = {"ok": r.returncode == 0, "detail": ver or "not found"}
    except Exception as e:
        checks["ffmpeg"] = {"ok": False, "detail": str(e)}

    # ── FFprobe ───────────────────────────────────────────────────────────────
    try:
        r = subprocess.run(["ffprobe", "-version"], capture_output=True, timeout=5)
        ver = r.stdout.decode().splitlines()[0] if r.returncode == 0 else None
        checks["ffprobe"] = {"ok": r.returncode == 0, "detail": ver or "not found"}
    except Exception as e:
        checks["ffprobe"] = {"ok": False, "detail": str(e)}

    # ── S3 ────────────────────────────────────────────────────────────────────
    try:
        from config import settings
        from pipeline.s3 import s3_enabled
        if not s3_enabled():
            checks["s3"] = {"ok": False, "detail": "not configured (S3_BUCKET or AWS keys missing)"}
        else:
            import boto3
            s3 = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
            )
            s3.head_bucket(Bucket=settings.S3_BUCKET)
            checks["s3"] = {"ok": True, "detail": f"bucket '{settings.S3_BUCKET}' accessible"}
    except Exception as e:
        checks["s3"] = {"ok": False, "detail": str(e)}

    # ── yt-dlp ────────────────────────────────────────────────────────────────
    try:
        import yt_dlp
        checks["yt_dlp"] = {"ok": True, "detail": f"v{yt_dlp.version.__version__}"}
    except Exception as e:
        checks["yt_dlp"] = {"ok": False, "detail": str(e)}

    # ── Whisper ───────────────────────────────────────────────────────────────
    try:
        import faster_whisper
        checks["whisper"] = {"ok": True, "detail": f"faster-whisper available"}
    except Exception as e:
        checks["whisper"] = {"ok": False, "detail": str(e)}

    # ── OpenCV ────────────────────────────────────────────────────────────────
    try:
        import cv2
        checks["opencv"] = {"ok": True, "detail": f"v{cv2.__version__}"}
    except Exception as e:
        checks["opencv"] = {"ok": False, "detail": str(e)}

    # ── Storage dirs & disk space ─────────────────────────────────────────────
    try:
        from config import settings as cfg
        dirs = {
            "uploads": cfg.UPLOAD_DIR,
            "output": cfg.OUTPUT_DIR,
            "temp": cfg.TEMP_DIR,
        }
        dir_status = {}
        for name, path in dirs.items():
            writable = path.exists() and os.access(path, os.W_OK)
            dir_status[name] = "ok" if writable else "missing or not writable"
        usage = shutil.disk_usage(cfg.OUTPUT_DIR)
        free_gb = round(usage.free / 1024 ** 3, 1)
        checks["storage"] = {
            "ok": all(v == "ok" for v in dir_status.values()),
            "detail": f"{free_gb} GB free",
            "dirs": dir_status,
        }
    except Exception as e:
        checks["storage"] = {"ok": False, "detail": str(e)}

    overall = all(v["ok"] for v in checks.values())
    return {"status": "ok" if overall else "degraded", "checks": checks}
