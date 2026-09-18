data "aws_caller_identity" "current" {}

# --- Applied for real (see infra/README.md) ---

module "github_oidc" {
  source = "../../modules/github-oidc"

  role_name        = "github-actions-dataset-quality-dev"
  allowed_branches = ["main"]

  tags = {
    Environment = "dev"
  }
}

# --- Validate-only below: not applied yet, no AWS spend until OPS-08 needs it running ---

module "network" {
  source = "../../modules/network"

  environment = "dev"
  vpc_cidr    = var.vpc_cidr

  tags = {
    Environment = "dev"
  }
}

module "compute" {
  source = "../../modules/compute"

  environment = "dev"

  tags = {
    Environment = "dev"
  }
}

module "data" {
  source = "../../modules/data"

  environment         = "dev"
  vpc_id              = module.network.vpc_id
  vpc_cidr            = module.network.vpc_cidr
  private_subnet_ids  = module.network.private_subnet_ids
  multi_az            = false
  instance_class      = "db.t4g.micro"
  skip_final_snapshot = true

  tags = {
    Environment = "dev"
  }
}

# Placeholder only, to keep this module genuinely validated end-to-end.
# OPS-08 replaces this with the real dvc-cache / dataset-releases buckets.
module "storage_example" {
  source = "../../modules/storage"

  bucket_name       = "dataset-quality-dev-placeholder-${data.aws_caller_identity.current.account_id}"
  enable_versioning = false

  tags = {
    Environment = "dev"
    Purpose     = "placeholder-do-not-use"
  }
}
