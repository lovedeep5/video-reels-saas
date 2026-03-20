# All secrets stored as SecureString (KMS-encrypted).
# Values come from TF_VAR_* env vars in CI — never committed to git.
# prevent_destroy = true on all params: deleting them would break the running app.

resource "aws_ssm_parameter" "mongodb_uri" {
  name        = "/vidtoreels/MONGODB_URI"
  description = "MongoDB Atlas connection string"
  type        = "SecureString"
  value       = var.mongodb_uri
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "openrouter_api_key" {
  name        = "/vidtoreels/OPENROUTER_API_KEY"
  description = "OpenRouter API key for LLM clip scoring"
  type        = "SecureString"
  value       = var.openrouter_api_key
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "clerk_secret_key" {
  name        = "/vidtoreels/CLERK_SECRET_KEY"
  description = "Clerk secret key"
  type        = "SecureString"
  value       = var.clerk_secret_key
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "clerk_jwks_url" {
  name        = "/vidtoreels/CLERK_JWKS_URL"
  description = "Clerk JWKS URL for JWT verification"
  type        = "String"
  value       = var.clerk_jwks_url
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "clerk_authorized_parties" {
  name        = "/vidtoreels/CLERK_AUTHORIZED_PARTIES"
  description = "Comma-separated authorized Clerk parties"
  type        = "String"
  value       = var.clerk_authorized_parties
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "app_secret_key" {
  name        = "/vidtoreels/SECRET_KEY"
  description = "App secret key"
  type        = "SecureString"
  value       = var.app_secret_key
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "s3_bucket" {
  name        = "/vidtoreels/S3_BUCKET"
  description = "S3 bucket name for clips and uploads"
  type        = "String"
  value       = var.s3_bucket
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "job_queue_url" {
  name        = "/vidtoreels/JOB_QUEUE_URL"
  description = "SQS job queue URL"
  type        = "String"
  value       = aws_sqs_queue.jobs.url
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "mongodb_db_name" {
  name        = "/vidtoreels/MONGODB_DB_NAME"
  description = "MongoDB database name"
  type        = "String"
  value       = var.mongodb_db_name
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "razorpay_key_id" {
  name        = "/vidtoreels/RAZORPAY_KEY_ID"
  description = "Razorpay key ID"
  type        = "SecureString"
  value       = var.razorpay_key_id
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "razorpay_key_secret" {
  name        = "/vidtoreels/RAZORPAY_KEY_SECRET"
  description = "Razorpay key secret"
  type        = "SecureString"
  value       = var.razorpay_key_secret
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "razorpay_webhook_secret" {
  name        = "/vidtoreels/RAZORPAY_WEBHOOK_SECRET"
  description = "Razorpay webhook signing secret"
  type        = "SecureString"
  value       = var.razorpay_webhook_secret
  tags        = local.common_tags
  lifecycle { prevent_destroy = true }
}

resource "aws_ssm_parameter" "youtube_client_id" {
  name        = "/vidtoreels/YOUTUBE_CLIENT_ID"
  description = "Google OAuth Client ID for YouTube publishing"
  type        = "SecureString"
  value       = "placeholder"
  tags        = local.common_tags
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [value]
  }
}

resource "aws_ssm_parameter" "youtube_client_secret" {
  name        = "/vidtoreels/YOUTUBE_CLIENT_SECRET"
  description = "Google OAuth Client Secret for YouTube publishing"
  type        = "SecureString"
  value       = "placeholder"
  tags        = local.common_tags
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [value]
  }
}

resource "aws_ssm_parameter" "youtube_cookies" {
  name        = "/vidtoreels/YOUTUBE_COOKIES"
  description = "Netscape-format YouTube cookies for yt-dlp (upload manually via AWS console)"
  type        = "SecureString"
  value       = "placeholder"
  tags        = local.common_tags
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [value]  # never overwrite — admin updates this manually
  }
}
