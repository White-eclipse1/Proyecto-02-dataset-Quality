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
  aws_region  = var.aws_region

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

# Structural parity with prod (OPS-08) — validate-only here. DEV's actual
# object storage is MinIO (see pipeline/.dvc/config), not S3; these never
# get applied in this environment.
module "dvc_cache" {
  source = "../../modules/storage"

  bucket_name        = "dvc-cache-${data.aws_caller_identity.current.account_id}"
  enable_versioning  = true
  enable_object_lock = false

  tags = {
    Environment = "dev"
  }
}

module "dataset_releases" {
  source = "../../modules/storage"

  bucket_name        = "dataset-releases-${data.aws_caller_identity.current.account_id}"
  enable_versioning  = true
  enable_object_lock = true

  tags = {
    Environment = "dev"
  }
}
