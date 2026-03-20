"""
Scheduler Lambda — single Lambda, two modes triggered by EventBridge:
  - Processor (XX:30): generates videos for automation runs due within 5 hours
  - Publisher (XX:00): publishes scheduled videos that are past their posting time
"""

import os
import json
import logging
import tempfile
from datetime import datetime, timezone, timedelta

import boto3
import requests
from pymongo import MongoClient
from bson import ObjectId

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_ssm = boto3.client("ssm", region_name=os.environ["AWS_REGION_NAME"])
_s3 = boto3.client("s3", region_name=os.environ["AWS_REGION_NAME"])
_sqs = boto3.client("sqs", region_name=os.environ["AWS_REGION_NAME"])

_mongo_client = None

S3_BUCKET = os.environ.get("S3_BUCKET", "vidtoreel-bucket")
JOB_QUEUE_URL = os.environ.get("JOB_QUEUE_URL", "")
BATCH_SIZE = 5


def _get_ssm(name):
    return _ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


def _get_db():
    global _mongo_client
    if _mongo_client is None:
        uri = _get_ssm(os.environ["MONGODB_URI_SSM_PATH"])
        _mongo_client = MongoClient(uri, maxPoolSize=5, serverSelectionTimeoutMS=5000)
    return _mongo_client[os.environ["MONGODB_DB_NAME"]]


def _get_queue_url():
    global JOB_QUEUE_URL
    if not JOB_QUEUE_URL:
        JOB_QUEUE_URL = _get_ssm("/vidtoreels/JOB_QUEUE_URL")
    return JOB_QUEUE_URL


# ── YouTube/Instagram publishing helpers ─────────────────────────────────────

def _get_youtube_credentials():
    client_id = _get_ssm(os.environ.get("YOUTUBE_CLIENT_ID_SSM", "/vidtoreels/YOUTUBE_CLIENT_ID"))
    client_secret = _get_ssm(os.environ.get("YOUTUBE_CLIENT_SECRET_SSM", "/vidtoreels/YOUTUBE_CLIENT_SECRET"))
    return client_id, client_secret


def _refresh_youtube_token(refresh_token, client_id, client_secret):
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": client_id, "client_secret": client_secret,
        "refresh_token": refresh_token, "grant_type": "refresh_token",
    }, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _publish_youtube(user, pub, s3_key):
    channel = None
    for ch in (user.get("connected_channels") or []):
        if ch["id"] == pub["channel_id"] and ch["platform"] == "youtube":
            channel = ch
            break
    if not channel and user.get("youtube_refresh_token"):
        channel = {"refresh_token": user["youtube_refresh_token"]}
    if not channel or not channel.get("refresh_token"):
        raise RuntimeError(f"No YouTube refresh token for channel {pub['channel_id']}")

    client_id, client_secret = _get_youtube_credentials()
    access_token = _refresh_youtube_token(channel["refresh_token"], client_id, client_secret)

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        _s3.download_fileobj(S3_BUCKET, s3_key, tmp)
        tmp_path = tmp.name

    try:
        file_size = os.path.getsize(tmp_path)
        title = pub.get("title") or "Untitled Video"
        description = pub.get("description") or ""
        tags = pub.get("tags") or []
        visibility = pub.get("visibility") or "public"

        metadata = {
            "snippet": {"title": title[:100], "description": description[:5000], "tags": tags[:15], "categoryId": "22"},
            "status": {"privacyStatus": visibility, "selfDeclaredMadeForKids": False},
        }
        init_r = requests.post(
            "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json; charset=UTF-8",
                     "X-Upload-Content-Length": str(file_size), "X-Upload-Content-Type": "video/mp4"},
            data=json.dumps(metadata), timeout=30,
        )
        init_r.raise_for_status()
        upload_url = init_r.headers["Location"]

        with open(tmp_path, "rb") as f:
            upload_r = requests.put(upload_url, headers={"Content-Type": "video/mp4", "Content-Length": str(file_size)}, data=f, timeout=300)
            upload_r.raise_for_status()

        video_id = upload_r.json()["id"]
        return {"platform_id": video_id, "url": f"https://youtube.com/watch?v={video_id}"}
    finally:
        os.unlink(tmp_path)


def _refresh_instagram_token(access_token):
    r = requests.get("https://graph.instagram.com/refresh_access_token",
                     params={"grant_type": "ig_refresh_token", "access_token": access_token}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _publish_instagram(user, pub, s3_key):
    import time
    channel = None
    for ch in (user.get("connected_channels") or []):
        if ch["id"] == pub["channel_id"] and ch["platform"] == "instagram":
            channel = ch
            break
    if not channel and user.get("instagram_access_token"):
        channel = {"access_token": user["instagram_access_token"],
                   "platform_account_id": user.get("instagram_account", {}).get("ig_user_id", "")}
    if not channel or not channel.get("access_token"):
        raise RuntimeError(f"No Instagram token for channel {pub['channel_id']}")

    fresh_token = _refresh_instagram_token(channel["access_token"])
    db = _get_db()
    db.users.update_one(
        {"_id": user["_id"], "connected_channels.id": pub["channel_id"]},
        {"$set": {"connected_channels.$.access_token": fresh_token, "connected_channels.$.token_updated_at": datetime.now(timezone.utc)}},
    )

    ig_user_id = channel.get("platform_account_id", "")
    caption = pub.get("description") or pub.get("title") or ""
    video_url = _s3.generate_presigned_url("get_object", Params={"Bucket": S3_BUCKET, "Key": s3_key}, ExpiresIn=600)

    r = requests.post(f"https://graph.instagram.com/v21.0/{ig_user_id}/media",
                      data={"media_type": "REELS", "video_url": video_url, "caption": caption[:2200], "access_token": fresh_token}, timeout=30)
    r.raise_for_status()
    container_id = r.json()["id"]

    for _ in range(20):
        time.sleep(5)
        sr = requests.get(f"https://graph.instagram.com/v21.0/{container_id}", params={"fields": "status_code", "access_token": fresh_token}, timeout=15)
        if sr.json().get("status_code") == "FINISHED": break
        if sr.json().get("status_code") == "ERROR": raise RuntimeError(f"IG processing failed")
    else:
        raise RuntimeError("IG processing timed out")

    pr = requests.post(f"https://graph.instagram.com/v21.0/{ig_user_id}/media_publish",
                       data={"creation_id": container_id, "access_token": fresh_token}, timeout=30)
    pr.raise_for_status()
    media_id = pr.json()["id"]
    ig_username = channel.get("account_name", "")
    return {"platform_id": media_id, "url": f"https://www.instagram.com/{ig_username}/"}


def _fail_publish(db, pub_id, error_msg):
    db.scheduled_publishes.update_one({"_id": pub_id}, {"$set": {
        "status": "failed", "error_message": str(error_msg)[:500], "updated_at": datetime.now(timezone.utc),
    }})
    logger.error(f"Publish {pub_id} failed: {error_msg}")


# ── Processor Mode ───────────────────────────────────────────────────────────

def _run_processor():
    """Runs at XX:30. Generates videos for automation runs due within 5 hours."""
    db = _get_db()
    now = datetime.now(timezone.utc)
    window = now + timedelta(hours=5)
    processed = 0

    # 1. Find pending automation runs within window
    pending = list(db.automation_runs.find({
        "status": "pending",
        "scheduled_post_at": {"$lte": window},
    }).limit(BATCH_SIZE))

    logger.info(f"Processor: {len(pending)} pending runs within 5hr window")

    for run in pending:
        automation = db.automations.find_one({"_id": run["automation_id"], "is_active": True})
        if not automation:
            db.automation_runs.update_one({"_id": run["_id"]}, {"$set": {
                "status": "failed", "error_message": "Automation disabled or deleted", "updated_at": now
            }})
            continue

        # Create faceless job
        job_doc = {
            "user_id": run["user_id"],
            "status": "queued",
            "source_type": "faceless",
            "clips_requested": 1,
            "output_ratio": "9:16",
            "faceless_topic": run["topic"],
            "faceless_script_type": automation.get("script_type", "story"),
            "faceless_style": automation.get("style", "creepy-comic"),
            "faceless_voice": automation.get("voice", "andrew"),
            "faceless_duration": automation.get("duration", 30),
            "faceless_music": automation.get("music", "none"),
            "faceless_text_style": "bold-stroke",
            "automation_id": automation["_id"],
            "automation_run_id": run["_id"],
            "progress": 0,
            "progress_message": "Queued by automation",
            "retry_count": 0,
            "created_at": now,
        }
        result = db.jobs.insert_one(job_doc)
        job_id = str(result.inserted_id)

        # Enqueue to SQS
        queue_url = _get_queue_url()
        _sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps({"job_id": job_id}))

        db.automation_runs.update_one({"_id": run["_id"]}, {"$set": {
            "status": "generating", "job_id": result.inserted_id, "updated_at": now,
        }})
        processed += 1
        logger.info(f"Processor: created job {job_id} for automation run {run['_id']}")

    # 2. Check generating runs — if job completed, create scheduled_publish + advance
    generating = list(db.automation_runs.find({"status": "generating"}).limit(10))
    advanced = 0

    for run in generating:
        job = db.jobs.find_one({"_id": run.get("job_id")})
        if not job:
            continue

        if job["status"] == "completed":
            automation = db.automations.find_one({"_id": run["automation_id"]})
            if not automation:
                continue

            # Create scheduled_publish entries at exact posting time
            clips = job.get("output_clips") or []
            metadata = job.get("output_clip_metadata") or [{}]
            for i, clip_key in enumerate(clips):
                meta = metadata[i] if i < len(metadata) else {}
                for plat in automation.get("platforms", []):
                    db.scheduled_publishes.insert_one({
                        "user_id": run["user_id"],
                        "job_id": run["job_id"],
                        "clip_index": i,
                        "platform": plat["platform"],
                        "channel_id": plat["channel_id"],
                        "title": meta.get("yt_title"),
                        "description": meta.get("yt_description"),
                        "tags": meta.get("yt_tags"),
                        "visibility": automation.get("visibility", "public"),
                        "scheduled_at": run["scheduled_post_at"],
                        "status": "scheduled",
                        "created_at": now,
                        "updated_at": now,
                    })

            db.automation_runs.update_one({"_id": run["_id"]}, {"$set": {"status": "ready", "updated_at": now}})

            # Advance: create next day's run
            topics = automation.get("topics", [])
            next_idx = (automation.get("topic_index", 0) + 1) % len(topics) if topics else 0
            next_post = run["scheduled_post_at"] + timedelta(days=1)

            db.automations.update_one({"_id": automation["_id"]}, {"$set": {
                "topic_index": next_idx,
                "total_runs": automation.get("total_runs", 0) + 1,
                "updated_at": now,
            }})
            db.automation_runs.insert_one({
                "automation_id": automation["_id"],
                "user_id": run["user_id"],
                "scheduled_post_at": next_post,
                "topic": topics[next_idx] if topics else "Interesting facts",
                "status": "pending",
                "created_at": now,
                "updated_at": now,
            })
            advanced += 1

        elif job["status"] == "failed":
            # Still create next day's run so automation continues
            automation = db.automations.find_one({"_id": run["automation_id"]})
            db.automation_runs.update_one({"_id": run["_id"]}, {"$set": {
                "status": "failed", "error_message": job.get("error_message", "Job failed"), "updated_at": now,
            }})
            if automation:
                topics = automation.get("topics", [])
                next_idx = (automation.get("topic_index", 0) + 1) % len(topics) if topics else 0
                next_post = run["scheduled_post_at"] + timedelta(days=1)
                db.automations.update_one({"_id": automation["_id"]}, {"$set": {"topic_index": next_idx, "updated_at": now}})
                db.automation_runs.insert_one({
                    "automation_id": automation["_id"], "user_id": run["user_id"],
                    "scheduled_post_at": next_post,
                    "topic": topics[next_idx] if topics else "Interesting facts",
                    "status": "pending", "created_at": now, "updated_at": now,
                })

    logger.info(f"Processor done: queued={processed}, advanced={advanced}")
    return {"queued": processed, "advanced": advanced}


# ── Publisher Mode ───────────────────────────────────────────────────────────

def _run_publisher():
    """Runs at XX:00. Publishes videos past their scheduled time."""
    db = _get_db()
    now = datetime.now(timezone.utc)
    published = 0

    # 1. Publish due scheduled_publishes
    due = list(db.scheduled_publishes.find({
        "status": "scheduled",
        "scheduled_at": {"$lte": now},
    }).limit(10))

    logger.info(f"Publisher: {len(due)} due publishes")

    for pub in due:
        result = db.scheduled_publishes.update_one(
            {"_id": pub["_id"], "status": "scheduled"},
            {"$set": {"status": "publishing", "updated_at": now}}
        )
        if result.modified_count == 0:
            continue

        try:
            job = db.jobs.find_one({"_id": pub["job_id"]})
            user = db.users.find_one({"_id": pub["user_id"]})
            if not job or not user:
                _fail_publish(db, pub["_id"], "Job or user not found")
                continue
            if job.get("status") != "completed":
                _fail_publish(db, pub["_id"], f"Job not completed (status: {job.get('status')})")
                continue

            clips = job.get("output_clips") or []
            if pub["clip_index"] >= len(clips):
                _fail_publish(db, pub["_id"], "Clip index out of range")
                continue
            s3_key = clips[pub["clip_index"]]

            if pub["platform"] == "youtube":
                result_data = _publish_youtube(user, pub, s3_key)
            elif pub["platform"] == "instagram":
                result_data = _publish_instagram(user, pub, s3_key)
            else:
                _fail_publish(db, pub["_id"], f"Unknown platform: {pub['platform']}")
                continue

            db.scheduled_publishes.update_one({"_id": pub["_id"]}, {"$set": {
                "status": "published", "published_url": result_data["url"],
                "platform_id": result_data["platform_id"], "published_at": now, "updated_at": now,
            }})

            # Update linked automation run
            db.automation_runs.update_one(
                {"job_id": pub["job_id"], "status": "ready"},
                {"$set": {"status": "published", "updated_at": now}}
            )
            published += 1

        except Exception as e:
            _fail_publish(db, pub["_id"], str(e))

    # 2. Process auto_publish_config on newly completed jobs (manual auto-post)
    auto_jobs = list(db.jobs.find({
        "status": "completed",
        "auto_publish_config": {"$exists": True},
        "auto_publish_processed": {"$ne": True},
    }).limit(BATCH_SIZE))

    for job in auto_jobs:
        config = job.get("auto_publish_config", {})
        clips = job.get("output_clips") or []
        metadata = job.get("output_clip_metadata") or [{}]
        for i in range(len(clips)):
            meta = metadata[i] if i < len(metadata) else {}
            for plat in config.get("platforms", []):
                db.scheduled_publishes.insert_one({
                    "user_id": job["user_id"], "job_id": job["_id"], "clip_index": i,
                    "platform": plat["platform"], "channel_id": plat["channel_id"],
                    "title": meta.get("yt_title"), "description": meta.get("yt_description"),
                    "tags": meta.get("yt_tags"),
                    "visibility": config.get("visibility", "public"),
                    "scheduled_at": now, "status": "scheduled", "created_at": now, "updated_at": now,
                })
        db.jobs.update_one({"_id": job["_id"]}, {"$set": {"auto_publish_processed": True}})

    logger.info(f"Publisher done: published={published}, auto_queued={len(auto_jobs)}")
    return {"published": published, "auto_queued": len(auto_jobs)}


# ── Entry point ──────────────────────────────────────────────────────────────

def handler(event, context):
    mode = event.get("mode", "publisher")
    logger.info(f"Scheduler invoked in mode: {mode}")

    if mode == "processor":
        return _run_processor()
    else:
        return _run_publisher()
