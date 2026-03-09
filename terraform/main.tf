terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # State stored in existing S3 bucket — never loses infra state
  backend "s3" {
    bucket = "vidtoreel-bucket"
    key    = "terraform/state.tfstate"
    region = "ap-south-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Default VPC data sources ────────────────────────────────────────────────
data "aws_vpc" "default" {
  default = true
}

# Latest Ubuntu 22.04 LTS — used as fallback if no custom AMI provided
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  # Use custom baked AMI if provided, otherwise fall back to Ubuntu 22.04
  worker_ami = var.worker_ami_id != "" ? var.worker_ami_id : data.aws_ami.ubuntu.id

  common_tags = {
    Project     = "vidtoreels"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
