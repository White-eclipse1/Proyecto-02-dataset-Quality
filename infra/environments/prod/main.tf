data "aws_caller_identity" "current" {}

# Everything in this environment is validate-only for now — no real PROD
# AWS account/apply exists yet. Diego's real apply so far is dev's
# github-oidc module only (see infra/README.md).

module "github_oidc" {
  source = "../../modules/github-oidc"

  role_name        = "github-actions-dataset-quality-prod"
  allowed_branches = ["main"]

  tags = {
    Environment = "prod"
  }
}

module "network" {
  source = "../../modules/network"

  environment = "prod"
  vpc_cidr    = var.vpc_cidr

  tags = {
    Environment = "prod"
  }
}

module "compute" {
  source = "../../modules/compute"

  environment = "prod"

  tags = {
    Environment = "prod"
  }
}

module "data" {
  source = "../../modules/data"

  environment         = "prod"
  vpc_id              = module.network.vpc_id
  vpc_cidr            = module.network.vpc_cidr
  private_subnet_ids  = module.network.private_subnet_ids
  multi_az            = true
  instance_class      = "db.t4g.small"
  skip_final_snapshot = false

  tags = {
    Environment = "prod"
  }
}

# Placeholder only, to keep this module genuinely validated end-to-end.
# OPS-08 replaces this with the real dvc-cache / dataset-releases buckets.
module "storage_example" {
  source = "../../modules/storage"

  bucket_name       = "dataset-quality-prod-placeholder-${data.aws_caller_identity.current.account_id}"
  enable_versioning = true

  tags = {
    Environment = "prod"
    Purpose     = "placeholder-do-not-use"
  }
}
