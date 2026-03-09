"""
Recovery Lambda — triggered by EventBridge every 30 minutes.
Finds jobs stuck in a processing state with no live EC2,
then re-queues them (up to MAX_RETRIES times) or marks them failed.
"""

import json
import os
import logging
from datetime import datetime, timezone, timedelta

import boto3
from pymongo import MongoClient
from bson import ObjectId

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_ec2  = boto3.client("ec2", region_name=os.environ["AWS_REGION_NAME"])
_sqs  = boto3.client("sqs", region_name=os.environ["AWS_REGION_NAME"])
_ssm  = boto3.client("ssm", region_name=os.environ["AWS_REGION_NAME"])

_mongo_client = None

PROCESSING_STATUSES = ["starting", "downloading", "processing", "rendering"]
QUEUED_STATUS = "queued"


def _get_db():
    global _mongo_client
    if _mongo_client is None:
        uri = _ssm.get_parameter(
            Name=os.environ["MONGODB_URI_SSM_PATH"],
            WithDecryption=True,
        )["Parameter"]["Value"]
        _mongo_client = MongoClient(uri, maxPoolSize=5, serverSelectionTimeoutMS=5000)
    return _mongo_client[os.environ["MONGODB_DB_NAME"]]


def _is_ec2_alive(instance_id: str) -> bool:
    """Returns True if the EC2 instance is still pending or running."""
    if not instance_id or instance_id == "pending":
        return False
    try:
        resp = _ec2.describe_instances(
            InstanceIds=[instance_id],
            Filters=[{"Name": "instance-state-name", "Values": ["pending", "running"]}],
        )
        return any(resp["Reservations"])
    except Exception:
        return False


def handler(event, context):
    stale_minutes = int(os.environ.get("STALE_MINUTES", "35"))
    max_retries   = int(os.environ.get("MAX_RETRIES", "3"))
    cutoff        = datetime.now(timezone.utc) - timedelta(minutes=stale_minutes)

    db = _get_db()

    stale_jobs = list(db.jobs.find({
        "$or": [
            {"status": {"$in": PROCESSING_STATUSES}, "started_at": {"$lt": cutoff}},
            {"status": QUEUED_STATUS, "created_at": {"$lt": cutoff}},
        ]
    }))

    logger.info("Found %d stale jobs (older than %d min)", len(stale_jobs), stale_minutes)

    requeued  = 0
    failed    = 0

    for job in stale_jobs:
        job_id      = str(job["_id"])
        instance_id = job.get("ec2_instance_id")
        retry_count = job.get("retry_count", 0)

        # Skip if EC2 is still running (job is legitimately in progress)
        if _is_ec2_alive(instance_id):
            logger.info("Job %s: EC2 %s still alive, skipping", job_id, instance_id)
            continue

        logger.info(
            "Job %s: no live EC2 (was %s), retry_count=%d",
            job_id, instance_id, retry_count,
        )

        if retry_count >= max_retries:
            db.jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {
                    "status":       "failed",
                    "error":        f"Job failed after {max_retries} attempts. Please resubmit.",
                    "completed_at": datetime.now(timezone.utc),
                }},
            )
            logger.warning("Job %s permanently failed after %d retries", job_id, max_retries)
            failed += 1
        else:
            _sqs.send_message(
                QueueUrl    = os.environ["JOB_QUEUE_URL"],
                MessageBody = json.dumps({"job_id": job_id}),
            )
            db.jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {
                    "status":          "queued",
                    "retry_count":     retry_count + 1,
                    "ec2_instance_id": None,
                }},
            )
            logger.info("Re-queued job %s (attempt %d)", job_id, retry_count + 1)
            requeued += 1

    logger.info("Recovery done — requeued: %d, failed: %d", requeued, failed)
    return {"requeued": requeued, "failed": failed}
