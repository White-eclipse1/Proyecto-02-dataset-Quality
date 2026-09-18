terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Remote backend (S3 + DynamoDB locking) is OPS-08's job — local state for now.
  # In a real rollout, prod is its own separate AWS account (hence its own
  # github-oidc provider/role below, not a duplicate of dev's) — the state
  # for this environment lives in that account's backend once configured.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "dataset-quality-pipeline"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}
