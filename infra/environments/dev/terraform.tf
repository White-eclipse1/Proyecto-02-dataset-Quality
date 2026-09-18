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
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "dataset-quality-pipeline"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}
