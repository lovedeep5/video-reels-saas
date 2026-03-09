"""
Dispatcher Lambda — triggered by SQS.
Checks running EC2 count, starts a Spot EC2 worker for the job.
SQS message is auto-deleted on success; kept on failure (batchItemFailures).
"""

import json
import os
import base64
import logging
from datetime import datetime, timezone

import boto3
from pymongo import MongoClient
from bson import ObjectId

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Boto3 clients — reused across warm Lambda invocations
_ec2  = boto3.client("ec2",  region_name=os.environ["AWS_REGION_NAME"])
_sqs  = boto3.client("sqs",  region_name=os.environ["AWS_REGION_NAME"])
_ssm  = boto3.client("ssm",  region_name=os.environ["AWS_REGION_NAME"])

_mongo_client = None


def _get_db():
    global _mongo_client
    if _mongo_client is None:
        uri = _ssm.get_parameter(
            Name=os.environ["MONGODB_URI_SSM_PATH"],
            WithDecryption=True,
        )["Parameter"]["Value"]
        _mongo_client = MongoClient(uri, maxPoolSize=5, serverSelectionTimeoutMS=5000)
    return _mongo_client[os.environ["MONGODB_DB_NAME"]]


def _count_running_workers():
    resp = _ec2.describe_instances(
        Filters=[
            {"Name": "tag:Purpose",        "Values": ["vidtoreels-job"]},
            {"Name": "instance-state-name", "Values": ["pending", "running"]},
        ]
    )
    return sum(len(r["Instances"]) for r in resp["Reservations"])


def _build_userdata(job_id: str) -> str:
    region   = os.environ["AWS_REGION_NAME"]
    repo_url = os.environ.get("REPO_URL", "")

    # Raw string — no f-string brace escaping needed for Python dict literals
    cleanup_py = r"""
import os, sys, json, time
from datetime import datetime, timezone

LOG_FILE  = "/var/log/vidtoreels-job.log"
JOB_ID    = os.environ.get("JOB_ID", "")
REGION    = os.environ.get("AWS_DEFAULT_REGION", "ap-south-1")
STEP      = os.environ.get("CURRENT_STEP", "unknown")
EXIT_CODE = int(os.environ.get("EXIT_CODE", "1"))

# Read last 150 lines of the worker log
log_tail = ""
try:
    with open(LOG_FILE) as f:
        lines = f.readlines()
    log_tail = "".join(lines[-150:])
except Exception:
    pass

# ── Push full log to CloudWatch ───────────────────────────────────────────────
def push_cloudwatch(log_text):
    try:
        import boto3
        cw     = boto3.client("logs", region_name=REGION)
        group  = "/vidtoreels/ec2-workers"
        stream = f"job-{JOB_ID}"
        try:
            cw.create_log_group(logGroupName=group)
        except Exception:
            pass
        try:
            cw.create_log_stream(logGroupName=group, logStreamName=stream)
        except Exception:
            pass
        events = []
        ts = int(time.time() * 1000)
        for i, line in enumerate(log_text.splitlines()):
            events.append({"timestamp": ts + i, "message": line})
        if events:
            cw.put_log_events(logGroupName=group, logStreamName=stream, logEvents=events)
        print(f"[cleanup] pushed {len(events)} lines to CloudWatch {group}/{stream}")
    except Exception as e:
        print(f"[cleanup] CloudWatch push failed: {e}", file=sys.stderr)

if log_tail:
    push_cloudwatch(log_tail)

# ── Mark job failed in MongoDB (only if not already terminal) ─────────────────
if EXIT_CODE != 0 and JOB_ID:
    try:
        from pymongo import MongoClient
        from bson import ObjectId
        uri    = os.environ.get("MONGODB_URI", "")
        dbname = os.environ.get("MONGODB_DB_NAME", "vidtoreels")
        if uri:
            db  = MongoClient(uri, serverSelectionTimeoutMS=5000)[dbname]
            msg = f"Failed at step [{STEP}]"
            if log_tail:
                # last 10 lines as context in the error message
                last_lines = "\n".join(log_tail.splitlines()[-10:])
                msg += f"\n\nLast log lines:\n{last_lines}"
            r = db.jobs.update_one(
                {"_id": ObjectId(JOB_ID), "status": {"$nin": ["completed", "failed"]}},
                {"$set": {"status": "failed",
                          "error_message": msg[:4000],
                          "completed_at": datetime.now(timezone.utc)}}
            )
            print(f"[cleanup] job {JOB_ID} marked failed at step={STEP} (matched={r.matched_count})")
    except Exception as e:
        print(f"[cleanup] MongoDB update failed: {e}", file=sys.stderr)
""".strip()

    script = f"""#!/bin/bash
exec > >(tee /var/log/vidtoreels-job.log) 2>&1

export JOB_ID="{job_id}"
export AWS_DEFAULT_REGION="{region}"
export CURRENT_STEP="init"
REPO=/opt/vidtoreels

echo "[worker] $(date) ====== starting job {job_id} ======"

# ── Write cleanup script before anything else ─────────────────────────────────
cat > /tmp/worker_cleanup.py << 'CLEANUP_EOF'
{cleanup_py}
CLEANUP_EOF

# ── Cleanup trap: always runs on exit ─────────────────────────────────────────
_cleanup() {{
    export EXIT_CODE=$?
    echo "[worker] $(date) EXIT code=$EXIT_CODE step=$CURRENT_STEP"
    python3 /tmp/worker_cleanup.py 2>&1 || true
    echo "[worker] shutdown -h now"
    shutdown -h now
}}
trap _cleanup EXIT

set -euo pipefail

# ── 1. System dependencies ────────────────────────────────────────────────────
export CURRENT_STEP="install-system-deps"
echo "[worker] step: $CURRENT_STEP"
command -v ffmpeg >/dev/null || {{
    apt-get update -qq
    apt-get install -y -qq git python3-pip python3-venv ffmpeg curl unzip
}}
echo "[worker] ffmpeg: $(ffmpeg -version 2>&1 | head -1)"

# ── 2. AWS CLI ────────────────────────────────────────────────────────────────
export CURRENT_STEP="install-aws-cli"
echo "[worker] step: $CURRENT_STEP"
command -v aws >/dev/null || {{
    curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
}}
echo "[worker] aws: $(aws --version 2>&1)"

# ── 3. Fetch secrets from SSM (MONGODB_URI needed by cleanup script) ──────────
export CURRENT_STEP="fetch-ssm-secrets"
echo "[worker] step: $CURRENT_STEP"
get_ssm() {{ aws ssm get-parameter --name "/vidtoreels/$1" --with-decryption --query "Parameter.Value" --output text --region {region}; }}
export MONGODB_URI=$(get_ssm MONGODB_URI)
export MONGODB_DB_NAME=$(get_ssm MONGODB_DB_NAME)
export S3_BUCKET=$(get_ssm S3_BUCKET)
export OPENROUTER_API_KEY=$(get_ssm OPENROUTER_API_KEY)
echo "[worker] secrets fetched ok"

# ── 4. Install pymongo early (cleanup script needs it) ────────────────────────
export CURRENT_STEP="install-pymongo"
echo "[worker] step: $CURRENT_STEP"
pip3 install --quiet pymongo boto3

# ── 5. Clone / update repo ────────────────────────────────────────────────────
export CURRENT_STEP="git-clone"
echo "[worker] step: $CURRENT_STEP — {repo_url}"
if [ -d "$REPO/.git" ]; then
    git -C "$REPO" pull --ff-only || true
else
    git clone --depth=1 "{repo_url}" "$REPO"
fi
echo "[worker] repo ready at $REPO"

# ── 6. Full Python environment ────────────────────────────────────────────────
export CURRENT_STEP="pip-install-deps"
echo "[worker] step: $CURRENT_STEP"
[ -d "$REPO/.venv" ] || python3 -m venv "$REPO/.venv"
source "$REPO/.venv/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -r "$REPO/backend/requirements.txt"
pip install --quiet pymongo boto3
echo "[worker] python deps installed"

# ── 7. bgutil PO token server (YouTube bot-detection bypass) ──────────────────
export CURRENT_STEP="start-bgutil"
echo "[worker] step: $CURRENT_STEP"
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs
echo "[worker] node: $(node --version)"
# Clone bgutil server and start it (provides YouTube PO tokens to yt-dlp)
git clone --depth=1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /tmp/bgutil 2>/dev/null || true
if [ -d /tmp/bgutil/server ]; then
    cd /tmp/bgutil/server && npm install --quiet >/dev/null 2>&1 && node index.js &
    sleep 5 && cd -
    echo "[worker] bgutil PO token server started on :4416"
else
    echo "[worker] bgutil server dir not found - falling back to player_client"
fi
# Install yt-dlp bgutil plugin into venv (auto-used when server is running)
pip install --quiet bgutil-ytdlp-pot-provider
echo "[worker] bgutil plugin installed"

# ── 9. Run the job ────────────────────────────────────────────────────────────
export CURRENT_STEP="run-pipeline"
echo "[worker] step: $CURRENT_STEP"
cd "$REPO"
python processing/run_job.py

export CURRENT_STEP="done"
echo "[worker] $(date) ====== job {job_id} completed successfully ======"
"""
    return base64.b64encode(script.encode()).decode()


def handler(event, context):
    batch_failures = []

    for record in event["Records"]:
        message_id     = record["messageId"]
        receipt_handle = record["receiptHandle"]

        # --- Parse message ---
        try:
            body   = json.loads(record["body"])
            job_id = body["job_id"]
        except (json.JSONDecodeError, KeyError) as exc:
            logger.error("Invalid SQS message format: %s", exc)
            continue  # let it go to DLQ naturally

        logger.info("Processing job %s", job_id)

        # --- Concurrency check ---
        running = _count_running_workers()
        max_jobs = int(os.environ.get("MAX_CONCURRENT_JOBS", "10"))

        if running >= max_jobs:
            logger.info("At capacity (%d/%d). Snoozing message for 5 min.", running, max_jobs)
            _sqs.change_message_visibility(
                QueueUrl=os.environ["JOB_QUEUE_URL"],
                ReceiptHandle=receipt_handle,
                VisibilityTimeout=300,  # retry in 5 min
            )
            batch_failures.append({"itemIdentifier": message_id})
            continue

        # --- Start EC2 worker ---
        try:
            db = _get_db()
            db.jobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {"status": "starting", "started_at": datetime.now(timezone.utc)}},
            )

            resp = _ec2.run_instances(
                ImageId      = os.environ["EC2_AMI_ID"],
                InstanceType = os.environ.get("EC2_INSTANCE_TYPE", "t3.small"),
                MinCount=1, MaxCount=1,
                InstanceMarketOptions={
                    "MarketType": "spot",
                    "SpotOptions": {
                        "SpotInstanceType":             "one-time",
                        "InstanceInterruptionBehavior": "terminate",
                    },
                },
                UserData             = _build_userdata(job_id),
                IamInstanceProfile   = {"Name": os.environ["EC2_IAM_INSTANCE_PROFILE"]},
                SecurityGroupIds     = [os.environ["EC2_SECURITY_GROUP_ID"]],
                SubnetId             = os.environ["EC2_SUBNET_ID"],
                InstanceInitiatedShutdownBehavior = "terminate",
                TagSpecifications=[{
                    "ResourceType": "instance",
                    "Tags": [
                        {"Key": "Purpose", "Value": "vidtoreels-job"},
                        {"Key": "job_id",  "Value": job_id},
                        {"Key": "Name",    "Value": f"vidtoreels-worker-{job_id}"},
                    ],
                }],
            )

            instance_id = resp["Instances"][0]["InstanceId"]
            db.jobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {"ec2_instance_id": instance_id}},
            )
            logger.info("Started EC2 %s for job %s", instance_id, job_id)

        except Exception as exc:
            logger.error("Failed to start EC2 for job %s: %s", job_id, exc)
            try:
                db = _get_db()
                db.jobs.update_one(
                    {"_id": ObjectId(job_id)},
                    {"$set": {"status": "failed", "error": f"Failed to start worker: {exc}"}},
                )
            except Exception:
                pass
            # message will be auto-deleted; job is marked failed in DB

    return {"batchItemFailures": batch_failures}
