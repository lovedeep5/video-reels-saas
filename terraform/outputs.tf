output "sqs_queue_url" {
  description = "Main job queue URL — add this to Vercel env vars as SQS_JOB_QUEUE_URL"
  value       = aws_sqs_queue.jobs.url
}

output "sqs_queue_arn" {
  description = "Main job queue ARN"
  value       = aws_sqs_queue.jobs.arn
}

output "sqs_dlq_url" {
  description = "Dead letter queue URL — monitor this for permanently failed jobs"
  value       = aws_sqs_queue.jobs_dlq.url
}

output "dispatcher_lambda_arn" {
  description = "Dispatcher Lambda ARN"
  value       = aws_lambda_function.dispatcher.arn
}

output "recovery_lambda_arn" {
  description = "Recovery Lambda ARN"
  value       = aws_lambda_function.recovery.arn
}

output "ec2_security_group_id" {
  description = "Security group ID for EC2 workers"
  value       = aws_security_group.ec2_worker.id
}

output "ec2_instance_profile_name" {
  description = "IAM instance profile name — used in dispatcher Lambda env var"
  value       = aws_iam_instance_profile.ec2_worker.name
}

output "worker_ami_used" {
  description = "AMI ID being used for EC2 workers"
  value       = local.worker_ami
}

output "ssm_parameter_paths" {
  description = "All SSM parameter paths created"
  value = {
    mongodb_uri              = aws_ssm_parameter.mongodb_uri.name
    openrouter_api_key       = aws_ssm_parameter.openrouter_api_key.name
    clerk_secret_key         = aws_ssm_parameter.clerk_secret_key.name
    clerk_jwks_url           = aws_ssm_parameter.clerk_jwks_url.name
    job_queue_url            = aws_ssm_parameter.job_queue_url.name
    s3_bucket                = aws_ssm_parameter.s3_bucket.name
    razorpay_key_id          = aws_ssm_parameter.razorpay_key_id.name
  }
}
