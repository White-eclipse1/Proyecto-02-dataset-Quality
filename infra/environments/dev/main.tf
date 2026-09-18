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

# Applied for real (see infra/README.md). DEV's actual DVC remote is still
# MinIO (see pipeline/.dvc/config) — wiring DVC itself to this bucket is
# OPS-07's job, not this ticket's. `dev`/`prod` currently share one AWS
# account, so the environment must be part of the bucket name — otherwise
# both environments compute the same global S3 name and the second `apply`
# collides with the first (caught in OPS-08 PR review).
module "dvc_cache" {
  source = "../../modules/storage"

  bucket_name        = "dvc-cache-dev-${data.aws_caller_identity.current.account_id}"
  enable_versioning  = true
  enable_object_lock = false

  tags = {
    Environment = "dev"
  }
}

module "dataset_releases" {
  source = "../../modules/storage"

  bucket_name        = "dataset-releases-dev-${data.aws_caller_identity.current.account_id}"
  enable_versioning  = true
  enable_object_lock = true

  tags = {
    Environment = "dev"
  }
}
