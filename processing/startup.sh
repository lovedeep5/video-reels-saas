#!/bin/bash
# EC2 UserData bootstrap script — generated inline by Lambda dispatcher.
# This file is kept as reference; the actual UserData is built by handler.py.
# JOB_ID and AWS_DEFAULT_REGION are injected as env vars by the dispatcher.

exec > >(tee /var/log/vidtoreels-job.log) 2>&1

export JOB_ID="${JOB_ID:-}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
REPO=/opt/vidtoreels

echo "[worker] $(date) starting job ${JOB_ID}"

# ── Write failure-reporter before anything else ───────────────────────────────
# Lets the cleanup trap mark the job failed even if setup steps crash.
cat > /tmp/mark_failed.py << 'MARK_EOF'
import os, sys
from datetime import datetime, timezone
try:
    from pymongo import MongoClient
    from bson import ObjectId
    uri    = os.environ.get("MONGODB_URI", "")
    dbname = os.environ.get("MONGODB_DB_NAME", "vidtoreels")
    job_id = os.environ.get("JOB_ID", "")
    if uri and job_id:
        db = MongoClient(uri, serverSelectionTimeoutMS=5000)[dbname]
        r = db.jobs.update_one(
            {"_id": ObjectId(job_id), "status": {"$nin": ["completed", "failed"]}},
            {"$set": {"status": "failed",
                      "error_message": "Worker exited unexpectedly",
                      "completed_at": datetime.now(timezone.utc)}}
        )
        print(f"[cleanup] job {job_id} marked failed (matched={r.matched_count})")
except Exception as e:
    print(f"[cleanup] MongoDB update failed: {e}", file=sys.stderr)
MARK_EOF

# ── Cleanup trap: ALWAYS shut down; mark failed on non-zero exit ──────────────
_cleanup() {
    local code=$?
    echo "[worker] EXIT code=$code at $(date)"
    if [ "$code" -ne 0 ] && [ -n "${MONGODB_URI:-}" ]; then
        python3 /tmp/mark_failed.py 2>&1 || true
    fi
    echo "[worker] shutdown -h now"
    shutdown -h now
}
trap _cleanup EXIT

set -euo pipefail

# ── 1. System dependencies ────────────────────────────────────────────────────
command -v ffmpeg >/dev/null || {
    apt-get update -qq
    apt-get install -y -qq git python3-pip python3-venv ffmpeg curl unzip
}

# ── 2. AWS CLI ────────────────────────────────────────────────────────────────
command -v aws >/dev/null || {
    curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
}

# ── 3. Fetch secrets from SSM early (trap needs MONGODB_URI) ─────────────────
get_ssm() { aws ssm get-parameter --name "/vidtoreels/$1" --with-decryption --query "Parameter.Value" --output text --region "${AWS_DEFAULT_REGION}"; }
export MONGODB_URI=$(get_ssm MONGODB_URI)
export MONGODB_DB_NAME=$(get_ssm MONGODB_DB_NAME)
export S3_BUCKET=$(get_ssm S3_BUCKET)
export OPENROUTER_API_KEY=$(get_ssm OPENROUTER_API_KEY)

# ── 4. Install pymongo early (trap needs it) ──────────────────────────────────
pip3 install --quiet pymongo

# ── 5. Clone / update repo ────────────────────────────────────────────────────
REPO_URL="https://github.com/YOUR_ORG/video-reels-saas.git"  # set via REPO_URL env var in dispatcher
if [ -d "$REPO/.git" ]; then
    git -C "$REPO" pull --ff-only || true
else
    git clone --depth=1 "$REPO_URL" "$REPO"
fi

# ── 6. Full Python environment ────────────────────────────────────────────────
[ -d "$REPO/.venv" ] || python3 -m venv "$REPO/.venv"
source "$REPO/.venv/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -r "$REPO/backend/requirements.txt"
pip install --quiet pymongo boto3

# ── 7. Run the job ────────────────────────────────────────────────────────────
echo "[worker] running pipeline for job ${JOB_ID}"
cd "$REPO"
python processing/run_job.py

echo "[worker] $(date) job ${JOB_ID} completed successfully"
