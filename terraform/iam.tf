# ════════════════════════════════════════════════════════════════════════════
# Lambda Dispatcher — IAM
# ════════════════════════════════════════════════════════════════════════════

resource "aws_iam_role" "lambda_dispatcher" {
  name = "vidtoreels-lambda-dispatcher"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "lambda_dispatcher" {
  name        = "vidtoreels-lambda-dispatcher"
  description = "Permissions for the VidToReels job dispatcher Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      # SQS — read, delete, snooze messages
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"]
        Resource = aws_sqs_queue.jobs.arn
      },
      # EC2 — start workers + describe running count
      {
        Effect   = "Allow"
        Action   = ["ec2:RunInstances", "ec2:DescribeInstances", "ec2:CreateTags", "ec2:DescribeInstanceStatus"]
        Resource = "*"
      },
      # IAM — pass the EC2 worker role (required when launching EC2 with an instance profile)
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = aws_iam_role.ec2_worker.arn
      },
      # SSM — read MongoDB URI and other secrets
      {
        Effect   = "Allow"
        Action   = "ssm:GetParameter"
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/vidtoreels/*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dispatcher" {
  role       = aws_iam_role.lambda_dispatcher.name
  policy_arn = aws_iam_policy.lambda_dispatcher.arn
}

# ════════════════════════════════════════════════════════════════════════════
# Lambda Recovery — IAM
# ════════════════════════════════════════════════════════════════════════════

resource "aws_iam_role" "lambda_recovery" {
  name = "vidtoreels-lambda-recovery"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "lambda_recovery" {
  name        = "vidtoreels-lambda-recovery"
  description = "Permissions for the VidToReels recovery Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect   = "Allow"
        Action   = ["ec2:DescribeInstances"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.jobs.arn
      },
      {
        Effect   = "Allow"
        Action   = "ssm:GetParameter"
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/vidtoreels/*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_recovery" {
  role       = aws_iam_role.lambda_recovery.name
  policy_arn = aws_iam_policy.lambda_recovery.arn
}

# ════════════════════════════════════════════════════════════════════════════
# Lambda Scheduler — IAM
# ════════════════════════════════════════════════════════════════════════════

resource "aws_iam_role" "lambda_scheduler" {
  name = "vidtoreels-lambda-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "lambda_scheduler" {
  name        = "vidtoreels-lambda-scheduler"
  description = "Permissions for the VidToReels scheduler Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      # SSM — read secrets (MongoDB URI, YouTube client ID/secret)
      {
        Effect   = "Allow"
        Action   = "ssm:GetParameter"
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/vidtoreels/*"
      },
      # S3 — download video files for YouTube upload, generate pre-signed URLs for Instagram
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "arn:aws:s3:::${var.s3_bucket}/*"
      },
      # SQS — enqueue jobs for automation video generation
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.jobs.arn
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_scheduler" {
  role       = aws_iam_role.lambda_scheduler.name
  policy_arn = aws_iam_policy.lambda_scheduler.arn
}

# ════════════════════════════════════════════════════════════════════════════
# EC2 Worker — IAM
# ════════════════════════════════════════════════════════════════════════════

resource "aws_iam_role" "ec2_worker" {
  name = "vidtoreels-ec2-worker"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "ec2_worker" {
  name        = "vidtoreels-ec2-worker"
  description = "Permissions for VidToReels EC2 processing workers"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3 — read source uploads, write processed clips
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::${var.s3_bucket}/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::${var.s3_bucket}"
      },
      # SSM — read all vidtoreels secrets
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/vidtoreels/*"
      },
      # CloudWatch Logs — worker logs
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_worker" {
  role       = aws_iam_role.ec2_worker.name
  policy_arn = aws_iam_policy.ec2_worker.arn
}

resource "aws_iam_instance_profile" "ec2_worker" {
  name = "vidtoreels-ec2-worker"
  role = aws_iam_role.ec2_worker.name
  tags = local.common_tags
}
