#!/usr/bin/env bash
# Usage:  bash logs.sh <job_id>
# Shows CloudWatch logs for an EC2 worker job.
# Falls back to listing recent log streams if no job_id given.

set -euo pipefail

JOB_ID="${1:-}"
GROUP="/vidtoreels/ec2-workers"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID env var}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY env var}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"

run_aws() {
  docker run --rm \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    -e AWS_DEFAULT_REGION \
    amazon/aws-cli "$@"
}

if [ -z "$JOB_ID" ]; then
  echo "Recent log streams in $GROUP:"
  run_aws logs describe-log-streams \
    --log-group-name "$GROUP" \
    --order-by LastEventTime \
    --descending \
    --max-items 10 \
    --query "logStreams[*].{Stream:logStreamName,Last:lastEventTime}" \
    --output table
  echo ""
  echo "Usage: bash logs.sh <job_id>"
  exit 0
fi

STREAM="job-${JOB_ID}"
echo "Fetching logs for $STREAM ..."
run_aws logs get-log-events \
  --log-group-name "$GROUP" \
  --log-stream-name "$STREAM" \
  --start-from-head \
  --query "events[*].message" \
  --output text 2>&1 || echo "No logs found for job $JOB_ID (may still be running or log not yet written)"
