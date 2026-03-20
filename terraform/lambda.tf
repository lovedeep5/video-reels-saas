# ── EC2 worker log group (workers stream logs here via AWS CLI) ──────────────
resource "aws_cloudwatch_log_group" "ec2_workers" {
  name              = "/vidtoreels/ec2-workers"
  retention_in_days = 14
  tags              = local.common_tags
}

# ── Lambda packages ───────────────────────────────────────────────────────────
# Built by deploy.sh (Docker python:3.11-slim) before terraform runs.
# archive_file zips the pre-built build/ directory for upload.

data "archive_file" "dispatcher" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/dispatcher/build"
  output_path = "${path.module}/../lambdas/dispatcher/dispatcher.zip"
}

data "archive_file" "recovery" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/recovery/build"
  output_path = "${path.module}/../lambdas/recovery/recovery.zip"
}

data "archive_file" "scheduler" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/scheduler/build"
  output_path = "${path.module}/../lambdas/scheduler/scheduler.zip"
}

# ── CloudWatch Log Groups ────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "dispatcher" {
  name              = "/aws/lambda/vidtoreels-dispatcher"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "recovery" {
  name              = "/aws/lambda/vidtoreels-recovery"
  retention_in_days = 30
  tags              = local.common_tags
}

# ── Dispatcher Lambda ────────────────────────────────────────────────────────
resource "aws_lambda_function" "dispatcher" {
  function_name    = "vidtoreels-dispatcher"
  description      = "Reads from SQS and starts an EC2 Spot worker per job"
  filename         = data.archive_file.dispatcher.output_path
  source_code_hash = data.archive_file.dispatcher.output_base64sha256
  handler          = "handler.handler"
  runtime          = "python3.11"
  role             = aws_iam_role.lambda_dispatcher.arn
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      AWS_REGION_NAME          = var.aws_region
      MONGODB_URI_SSM_PATH     = aws_ssm_parameter.mongodb_uri.name
      MONGODB_DB_NAME          = var.mongodb_db_name
      JOB_QUEUE_URL            = aws_sqs_queue.jobs.url
      EC2_AMI_ID               = local.worker_ami
      EC2_INSTANCE_TYPE        = var.worker_instance_type
      EC2_IAM_INSTANCE_PROFILE = aws_iam_instance_profile.ec2_worker.name
      EC2_SECURITY_GROUP_ID    = aws_security_group.ec2_worker.id
      EC2_SUBNET_ID            = var.worker_subnet_id
      MAX_CONCURRENT_JOBS      = tostring(var.max_concurrent_jobs)
      REPO_URL                 = var.repo_url
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.dispatcher,
    aws_iam_role_policy_attachment.lambda_dispatcher,
  ]

  tags = local.common_tags
}

# SQS → Dispatcher trigger
resource "aws_lambda_event_source_mapping" "sqs_to_dispatcher" {
  event_source_arn                   = aws_sqs_queue.jobs.arn
  function_name                      = aws_lambda_function.dispatcher.arn
  batch_size                         = 1   # one job at a time
  maximum_batching_window_in_seconds = 0
  function_response_types            = ["ReportBatchItemFailures"]
}

# ── Recovery Lambda ──────────────────────────────────────────────────────────
resource "aws_lambda_function" "recovery" {
  function_name    = "vidtoreels-recovery"
  description      = "Cron: re-queues crashed jobs every 30 minutes"
  filename         = data.archive_file.recovery.output_path
  source_code_hash = data.archive_file.recovery.output_base64sha256
  handler          = "handler.handler"
  runtime          = "python3.11"
  role             = aws_iam_role.lambda_recovery.arn
  timeout          = 120
  memory_size      = 256

  environment {
    variables = {
      AWS_REGION_NAME      = var.aws_region
      MONGODB_URI_SSM_PATH = aws_ssm_parameter.mongodb_uri.name
      MONGODB_DB_NAME      = var.mongodb_db_name
      JOB_QUEUE_URL        = aws_sqs_queue.jobs.url
      STALE_MINUTES        = tostring(var.stale_job_minutes)
      MAX_RETRIES          = tostring(var.max_job_retries)
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.recovery,
    aws_iam_role_policy_attachment.lambda_recovery,
  ]

  tags = local.common_tags
}

# EventBridge → Recovery (every 30 min)
resource "aws_cloudwatch_event_rule" "recovery_schedule" {
  name                = "vidtoreels-recovery-schedule"
  description         = "Triggers the recovery Lambda every 30 minutes"
  schedule_expression = "rate(30 minutes)"
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "recovery" {
  rule      = aws_cloudwatch_event_rule.recovery_schedule.name
  target_id = "vidtoreels-recovery"
  arn       = aws_lambda_function.recovery.arn
}

resource "aws_lambda_permission" "recovery_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.recovery.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.recovery_schedule.arn
}

# ── Scheduler Lambda (single Lambda, two triggers) ────────────────────────
resource "aws_cloudwatch_log_group" "scheduler" {
  name              = "/aws/lambda/vidtoreels-scheduler"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function" "scheduler" {
  function_name    = "vidtoreels-scheduler"
  description      = "Hourly: processor (XX:30) generates videos, publisher (XX:00) publishes them"
  filename         = data.archive_file.scheduler.output_path
  source_code_hash = data.archive_file.scheduler.output_base64sha256
  handler          = "handler.handler"
  runtime          = "python3.11"
  role             = aws_iam_role.lambda_scheduler.arn
  timeout          = 300
  memory_size      = 512

  environment {
    variables = {
      AWS_REGION_NAME           = var.aws_region
      MONGODB_URI_SSM_PATH      = aws_ssm_parameter.mongodb_uri.name
      MONGODB_DB_NAME           = var.mongodb_db_name
      S3_BUCKET                 = var.s3_bucket
      JOB_QUEUE_URL             = aws_sqs_queue.jobs.url
      YOUTUBE_CLIENT_ID_SSM     = "/vidtoreels/YOUTUBE_CLIENT_ID"
      YOUTUBE_CLIENT_SECRET_SSM = "/vidtoreels/YOUTUBE_CLIENT_SECRET"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.scheduler,
    aws_iam_role_policy_attachment.lambda_scheduler,
  ]

  tags = local.common_tags
}

# Publisher: runs at XX:00 every hour
resource "aws_cloudwatch_event_rule" "publisher_schedule" {
  name                = "vidtoreels-publisher-schedule"
  description         = "Triggers publisher mode every hour at :00"
  schedule_expression = "cron(0 * * * ? *)"
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "publisher" {
  rule      = aws_cloudwatch_event_rule.publisher_schedule.name
  target_id = "vidtoreels-publisher"
  arn       = aws_lambda_function.scheduler.arn
  input     = jsonencode({ mode = "publisher" })
}

resource "aws_lambda_permission" "publisher_eventbridge" {
  statement_id  = "AllowPublisherFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.publisher_schedule.arn
}

# Processor: runs at XX:30 every hour
resource "aws_cloudwatch_event_rule" "processor_schedule" {
  name                = "vidtoreels-processor-schedule"
  description         = "Triggers processor mode every hour at :30"
  schedule_expression = "cron(30 * * * ? *)"
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "processor" {
  rule      = aws_cloudwatch_event_rule.processor_schedule.name
  target_id = "vidtoreels-processor"
  arn       = aws_lambda_function.scheduler.arn
  input     = jsonencode({ mode = "processor" })
}

resource "aws_lambda_permission" "processor_eventbridge" {
  statement_id  = "AllowProcessorFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.processor_schedule.arn
}
