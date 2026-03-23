# ── Security Group ───────────────────────────────────────────────────────────
resource "aws_security_group" "ec2_worker" {
  name        = "vidtoreels-ec2-worker"
  description = "VidToReels EC2 processing workers - outbound only"
  vpc_id      = data.aws_vpc.default.id

  # No inbound rules — workers pull work from queue, never receive connections

  # Outbound: internet access for YouTube downloads, S3, MongoDB Atlas, SSM
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound (YouTube, S3, MongoDB Atlas, SSM)"
  }

  tags = merge(local.common_tags, { Name = "vidtoreels-ec2-worker" })
}

# ── Launch Template ──────────────────────────────────────────────────────────
# Used by the dispatcher Lambda when calling RunInstances.
# The dispatcher reads these values from its env vars.
# This template documents the intended config but is not directly used by RunInstances
# (RunInstances args are built inline in the Lambda).

resource "aws_launch_template" "worker" {
  name        = "vidtoreels-worker"
  description = "Template for VidToReels Spot EC2 processing workers"
  image_id    = local.worker_ami

  instance_type = var.worker_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_worker.name
  }

  instance_initiated_shutdown_behavior = "terminate"

  instance_market_options {
    market_type = "spot"
    spot_options {
      spot_instance_type             = "one-time"
      instance_interruption_behavior = "terminate"
    }
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.ec2_worker.id]
    subnet_id                   = var.worker_subnet_id
    delete_on_termination       = true
  }

  # Root volume — 30 GB GP3 for OS + venv + temp video downloads
  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = 30
      volume_type           = "gp3"
      delete_on_termination = true
    }
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 enforced — userdata uses token-based metadata requests
    http_put_response_hop_limit = 1
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.common_tags, {
      Name    = "vidtoreels-worker"
      Purpose = "vidtoreels-job"
    })
  }

  tags = local.common_tags
}
