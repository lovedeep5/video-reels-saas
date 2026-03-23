# ── Dead Letter Queue ────────────────────────────────────────────────────────
resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "vidtoreels-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days — time to investigate failures
  tags                      = local.common_tags
}

# ── Main Job Queue ───────────────────────────────────────────────────────────
resource "aws_sqs_queue" "jobs" {
  name = "vidtoreels-jobs"

  # Must be >= max expected job duration so message doesn't reappear mid-processing
  visibility_timeout_seconds = 3600 # 1 hour

  message_retention_seconds = 604800 # 7 days

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = var.max_job_retries
  })

  tags = local.common_tags
}

# Allow Lambda to consume from the queue (required for event source mapping)
resource "aws_sqs_queue_policy" "jobs" {
  queue_url = aws_sqs_queue.jobs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
      Resource  = aws_sqs_queue.jobs.arn
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = [
            aws_iam_role.lambda_dispatcher.arn,
            aws_iam_role.lambda_recovery.arn,
            aws_iam_role.lambda_scheduler.arn,
          ]
        }
      }
    }]
  })
}
