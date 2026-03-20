"""
Scheduler Lambda — triggered by EventBridge every 5 minutes.
Finds scheduled publishes that are due and publishes them to YouTube/Instagram.
Also processes auto-publish configs on newly completed jobs.
"""

import os
import json
import logging
import tempfile
from datetime import datetime, timezone

import boto3
import requests
from pymongo import MongoClient
from bson import ObjectId

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_ssm = boto3.client("ssm", region_name=os.environ["AWS_REGION_NAME"])
_s3 = boto3.client("s3", region_name=os.environ["AWS_REGION_NAME"])

_mongo_client = None

S3_BUCKET = os.environ.get("S3_BUCKET", "vidtoreel-bucket")
BATCH_SIZE = 10  # max publishes per invocation


def _get_ssm(name):
    return _ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


def _get_db():
    global _mongo_client
    if _mongo_client is None:
        uri = _get_ssm(os.environ["MONGODB_URI_SSM_PATH"])
        _mongo_client = MongoClient(uri, maxPoolSize=5, serverSelectionTimeoutMS=5000)
    return _mongo_client[os.environ["MONGODB_DB_NAME"]]


def _get_youtube_credentials():
    client_id = _get_ssm(os.environ.get("YOUTUBE_CLIENT_ID_SSM", "/vidtoreels/YOUTUBE_CLIENT_ID"))
    client_secret = _get_ssm(os.environ.get("YOUTUBE_CLIENT_SECRET_SSM", "/vidtoreels/YOUTUBE_CLIENT_SECRET"))
    return client_id, client_secret


def _refresh_youtube_token(refresh_token, client_id, client_secret):
    """Exchange refresh token for a fresh access token."""
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _publish_youtube(user, pub, s3_key):
    """Download video from S3, upload to YouTube via resumable upload."""
    # Find the channel's refresh token
    channel = None
    for ch in (user.get("connected_channels") or []):
        if ch["id"] == pub["channel_id"] and ch["platform"] == "youtube":
            channel = ch
            break

    # Fallback: legacy YouTube channel
    if not channel and user.get("youtube_refresh_token") and user.get("youtube_channel"):
        channel = {
            "refresh_token": user["youtube_refresh_token"],
            "account_name": user["youtube_channel"].get("channel_title", ""),
        }

    if not channel or not channel.get("refresh_token"):
        raise RuntimeError(f"No YouTube refresh token for channel {pub['channel_id']}")

    client_id, client_secret = _get_youtube_credentials()
    access_token = _refresh_youtube_token(channel["refresh_token"], client_id, client_secret)

    # Download video from S3 to temp file
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        _s3.download_fileobj(S3_BUCKET, s3_key, tmp)
        tmp_path = tmp.name

    try:
        file_size = os.path.getsize(tmp_path)

        # Get metadata from the publish doc or generate defaults
        title = pub.get("title") or "Untitled Video"
        description = pub.get("description") or ""
        tags = pub.get("tags") or []
        visibility = pub.get("visibility") or "public"

        # YouTube resumable upload — step 1: initiate
        metadata = {
            "snippet": {
                "title": title[:100],
                "description": description[:5000],
                "tags": tags[:15],
                "categoryId": "22",
            },
            "status": {
                "privacyStatus": visibility,
                "selfDeclaredMadeForKids": False,
            },
        }

        init_r = requests.post(
            "https://www.googleapis.com/upload/youtube/v3/videos"
            "?uploadType=resumable&part=snippet,status",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Length": str(file_size),
                "X-Upload-Content-Type": "video/mp4",
            },
            data=json.dumps(metadata),
            timeout=30,
        )
        init_r.raise_for_status()
        upload_url = init_r.headers["Location"]

        # Step 2: upload the file
        with open(tmp_path, "rb") as f:
            upload_r = requests.put(
                upload_url,
                headers={
                    "Content-Type": "video/mp4",
                    "Content-Length": str(file_size),
                },
                data=f,
                timeout=300,
            )
            upload_r.raise_for_status()

        yt_data = upload_r.json()
        video_id = yt_data["id"]
        logger.info(f"YouTube upload success: {video_id}")

        return {
            "platform_id": video_id,
            "url": f"https://youtube.com/watch?v={video_id}",
        }
    finally:
        os.unlink(tmp_path)


def _refresh_instagram_token(access_token):
    """Refresh Instagram long-lived token."""
    r = requests.get(
        "https://graph.instagram.com/refresh_access_token",
        params={
            "grant_type": "ig_refresh_token",
            "access_token": access_token,
        },
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _publish_instagram(user, pub, s3_key):
    """Publish video as Instagram Reel via Graph API."""
    import time

    channel = None
    for ch in (user.get("connected_channels") or []):
        if ch["id"] == pub["channel_id"] and ch["platform"] == "instagram":
            channel = ch
            break

    if not channel and user.get("instagram_access_token") and user.get("instagram_account"):
        channel = {
            "access_token": user["instagram_access_token"],
            "platform_account_id": user["instagram_account"]["ig_user_id"],
            "account_name": user["instagram_account"].get("username", ""),
        }

    if not channel or not channel.get("access_token"):
        raise RuntimeError(f"No Instagram token for channel {pub['channel_id']}")

    # Refresh token
    fresh_token = _refresh_instagram_token(channel["access_token"])

    # Update token in DB
    db = _get_db()
    db.users.update_one(
        {"_id": user["_id"], "connected_channels.id": pub["channel_id"]},
        {"$set": {
            "connected_channels.$.access_token": fresh_token,
            "connected_channels.$.token_updated_at": datetime.now(timezone.utc),
        }},
    )

    ig_user_id = channel.get("platform_account_id", "")
    caption = pub.get("description") or pub.get("title") or ""

    # Generate pre-signed S3 URL (10 min)
    video_url = _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": s3_key},
        ExpiresIn=600,
    )

    # Step 1: Create media container
    r = requests.post(
        f"https://graph.instagram.com/v21.0/{ig_user_id}/media",
        data={
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption[:2200],
            "access_token": fresh_token,
        },
        timeout=30,
    )
    r.raise_for_status()
    container_id = r.json()["id"]

    # Step 2: Poll for processing
    for _ in range(20):
        time.sleep(5)
        status_r = requests.get(
            f"https://graph.instagram.com/v21.0/{container_id}",
            params={"fields": "status_code", "access_token": fresh_token},
            timeout=15,
        )
        status_data = status_r.json()
        if status_data.get("status_code") == "FINISHED":
            break
        if status_data.get("status_code") == "ERROR":
            raise RuntimeError(f"Instagram processing failed: {status_data}")
    else:
        raise RuntimeError("Instagram processing timed out after 100s")

    # Step 3: Publish
    pub_r = requests.post(
        f"https://graph.instagram.com/v21.0/{ig_user_id}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": fresh_token,
        },
        timeout=30,
    )
    pub_r.raise_for_status()
    media_id = pub_r.json()["id"]

    ig_username = channel.get("account_name", "")
    logger.info(f"Instagram publish success: {media_id}")

    return {
        "platform_id": media_id,
        "url": f"https://www.instagram.com/{ig_username}/",
    }


def _fail_publish(db, pub_id, error_msg):
    """Mark a scheduled publish as failed."""
    db.scheduled_publishes.update_one(
        {"_id": pub_id},
        {"$set": {
            "status": "failed",
            "error_message": str(error_msg)[:500],
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    logger.error(f"Publish {pub_id} failed: {error_msg}")


def handler(event, context):
    db = _get_db()
    now = datetime.now(timezone.utc)
    published_count = 0
    auto_queued_count = 0

    # ── 1. Process due scheduled publishes ────────────────────────────────
    due = list(db.scheduled_publishes.find(
        {"status": "scheduled", "scheduled_at": {"$lte": now}},
    ).limit(BATCH_SIZE))

    logger.info(f"Found {len(due)} due scheduled publishes")

    for pub in due:
        # Atomically claim this publish
        result = db.scheduled_publishes.update_one(
            {"_id": pub["_id"], "status": "scheduled"},
            {"$set": {"status": "publishing", "updated_at": now}},
        )
        if result.modified_count == 0:
            continue  # already claimed by another invocation

        try:
            job = db.jobs.find_one({"_id": pub["job_id"]})
            user = db.users.find_one({"_id": pub["user_id"]})

            if not job or not user:
                _fail_publish(db, pub["_id"], "Job or user not found")
                continue

            if job.get("status") != "completed":
                _fail_publish(db, pub["_id"], f"Job status is {job.get('status')}, not completed")
                continue

            clips = job.get("output_clips") or []
            if pub["clip_index"] >= len(clips):
                _fail_publish(db, pub["_id"], f"clip_index {pub['clip_index']} out of range (max {len(clips)-1})")
                continue

            s3_key = clips[pub["clip_index"]]

            if pub["platform"] == "youtube":
                result_data = _publish_youtube(user, pub, s3_key)
            elif pub["platform"] == "instagram":
                result_data = _publish_instagram(user, pub, s3_key)
            else:
                _fail_publish(db, pub["_id"], f"Unknown platform: {pub['platform']}")
                continue

            db.scheduled_publishes.update_one(
                {"_id": pub["_id"]},
                {"$set": {
                    "status": "published",
                    "published_url": result_data["url"],
                    "platform_id": result_data["platform_id"],
                    "published_at": now,
                    "updated_at": now,
                }},
            )
            published_count += 1
            logger.info(f"Published {pub['_id']} to {pub['platform']}: {result_data['url']}")

        except Exception as e:
            _fail_publish(db, pub["_id"], str(e))

    # ── 2. Process auto-publish configs on completed jobs ─────────────────
    auto_jobs = list(db.jobs.find({
        "status": "completed",
        "auto_publish_config": {"$exists": True},
        "auto_publish_processed": {"$ne": True},
    }).limit(BATCH_SIZE))

    for job in auto_jobs:
        config = job.get("auto_publish_config", {})
        platforms = config.get("platforms", [])
        clips = job.get("output_clips") or []

        for i in range(len(clips)):
            for plat in platforms:
                db.scheduled_publishes.insert_one({
                    "user_id": job["user_id"],
                    "job_id": job["_id"],
                    "clip_index": i,
                    "platform": plat["platform"],
                    "channel_id": plat["channel_id"],
                    "visibility": config.get("visibility", "public"),
                    "scheduled_at": now,  # publish immediately
                    "status": "scheduled",
                    "created_at": now,
                    "updated_at": now,
                })
                auto_queued_count += 1

        db.jobs.update_one(
            {"_id": job["_id"]},
            {"$set": {"auto_publish_processed": True}},
        )
        logger.info(f"Auto-publish queued for job {job['_id']}: {len(platforms)} platforms x {len(clips)} clips")

    logger.info(f"Scheduler done: published={published_count}, auto_queued={auto_queued_count}")
    return {
        "published": published_count,
        "auto_queued": auto_queued_count,
    }
