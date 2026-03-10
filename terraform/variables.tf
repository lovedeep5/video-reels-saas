variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name (prod, staging)"
  type        = string
  default     = "prod"
}

variable "s3_bucket" {
  description = "Existing S3 bucket for clips and Lambda zips"
  type        = string
  default     = "vidtoreel-bucket"
}

variable "worker_ami_id" {
  description = "Pre-baked worker AMI ID. Leave empty to use latest Ubuntu 22.04 (for first deploy)."
  type        = string
  default     = ""
}

variable "worker_subnet_id" {
  description = "Subnet ID for EC2 workers. Must have internet access (public subnet or private + NAT)."
  type        = string
}

variable "worker_instance_type" {
  description = "EC2 instance type for video processing workers"
  type        = string
  default     = "t3.medium"
}

variable "max_concurrent_jobs" {
  description = "Maximum number of EC2 workers running simultaneously"
  type        = number
  default     = 10
}

variable "stale_job_minutes" {
  description = "Minutes after which a stuck job is considered crashed and re-queued"
  type        = number
  default     = 35
}

variable "max_job_retries" {
  description = "Maximum retry attempts before permanently failing a job"
  type        = number
  default     = 3
}

# ── Secrets (provide via terraform.tfvars — never commit that file) ──────────

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string"
  type        = string
  sensitive   = true
}

variable "repo_url" {
  description = "GitHub repo URL for EC2 workers to clone (e.g. https://github.com/org/repo.git)"
  type        = string
  default     = "https://github.com/YOUR_ORG/video-reels-saas.git"
}

variable "mongodb_db_name" {
  description = "MongoDB database name"
  type        = string
  default     = "vidtoreels"
}

variable "openrouter_api_key" {
  description = "OpenRouter API key for LLM clip scoring"
  type        = string
  sensitive   = true
}

variable "clerk_secret_key" {
  description = "Clerk secret key"
  type        = string
  sensitive   = true
}

variable "clerk_jwks_url" {
  description = "Clerk JWKS URL for JWT verification"
  type        = string
}

variable "clerk_authorized_parties" {
  description = "Comma-separated list of authorized Clerk parties (frontend URLs)"
  type        = string
  default     = "https://vidtoreels.com,http://localhost:3000"
}

variable "app_secret_key" {
  description = "App secret key for internal signing"
  type        = string
  sensitive   = true
}

variable "razorpay_key_id" {
  description = "Razorpay key ID"
  type        = string
  sensitive   = true
}

variable "razorpay_key_secret" {
  description = "Razorpay key secret"
  type        = string
  sensitive   = true
}

variable "razorpay_webhook_secret" {
  description = "Razorpay webhook signing secret"
  type        = string
  sensitive   = true
}

