# Infrastructure (OPS-05 foundation, completed in OPS-08)

Terraform for the dataset-quality pipeline's AWS infrastructure. Laid out as reusable modules under `modules/`, composed per environment under `environments/{dev,prod}`.

## Modules

| Module | What it is | Status |
|---|---|---|
| `network` | VPC across 2 AZs, public + private subnets, IGW, route tables, S3 VPC Gateway Endpoint (added in OPS-08, attached to the private route table — no NAT gateway needed for S3 traffic). | Validate-only |
| `compute` | ECS Fargate cluster + task execution IAM role. No task definitions yet — those need an actual container image, which comes with OPS-08. | Validate-only |
| `data` | RDS MariaDB in the private subnets. Master credentials are managed natively by RDS's Secrets Manager integration (`manage_master_user_password = true`) rather than a hand-rolled secret. | Validate-only |
| `storage` | Generic private S3 bucket module (name/versioning/Object Lock as inputs — Object Lock added in OPS-08, opt-in and off by default). Instantiated for the real `dvc-cache` (versioned only) and `dataset-releases` (versioned + Object Lock — a working cache can't be WORM, a published release should be) buckets, plus `infra/bootstrap`'s state bucket. | Validate-only in `environments/`, applied for real via `infra/bootstrap` |
| `github-oidc` | GitHub Actions → AWS trust via OIDC: an `aws_iam_openid_connect_provider` plus an `aws_iam_role` whose trust policy only accepts tokens whose `sub` claim matches this exact repo on an allowed branch. No static AWS keys anywhere. The role starts with **zero** attached permissions (`managed_policy_arns = []`) — `sts:GetCallerIdentity` needs none, and later tickets (OPS-06/07/08) add permissions incrementally as they're actually needed, instead of granting broad access upfront. | **Applied for real in dev** |

## What's actually deployed vs. what's just validated

Three things have been applied for real, by Diego, in **AWS CloudShell** (already authenticated in-browser — no local access keys were ever created): `module.github_oidc` in `environments/dev` (OPS-05), and `infra/bootstrap`'s state bucket + DynamoDB lock table (OPS-08), after which `environments/dev`'s and `environments/prod`'s state were migrated onto that S3 backend. IAM/S3/DynamoDB are all free or effectively free at this scale, so this gives genuine evidence things work, without spending anything on RDS/ECS before OPS-08's own scope (dvc-cache/dataset-releases/S3-endpoint/backend) needed them.

Everything else (`network`, `compute`, `data`, and the `dvc_cache`/`dataset_releases` bucket calls in both environments) is validate-only: `terraform fmt`, `terraform init -backend=false`, and `terraform validate` all pass, but nothing has been `apply`'d. `prod` otherwise hasn't been touched — it assumes a separate AWS account, which is why it has its own `github-oidc` provider/role rather than sharing dev's (a single AWS account can only have one GitHub OIDC provider per URL; two independent accounts each need their own). Its state currently lives in the *same* bootstrap bucket as dev only because this project has one AWS account total right now — a real multi-account rollout would give prod its own backend entirely.

## `infra/bootstrap/`

A separate, tiny root — not an environment — that exists to solve one bootstrapping problem: Terraform can't store its own state in an S3 bucket that Terraform itself hasn't created yet. It creates just the state bucket (versioned — Terraform's own state-recovery mechanism) and a DynamoDB table for locking, and deliberately keeps **local** state itself, since this is the one piece of infrastructure that can't depend on the remote backend it's creating. `environments/dev` and `environments/prod` each have a `backend "s3" {}` block pointing at these resources (account ID hardcoded — backend blocks can't use variables or data sources, so this can't be `${data.aws_caller_identity...}` the way bucket names elsewhere are).

## One-time setup for whoever picks this up next

1. **Bootstrap the state backend, then migrate both environments onto it** (already done for account `685538571046` / `us-east-1`):
   ```bash
   # In AWS CloudShell, already authenticated:
   git clone <repo> && cd Proyecto-02-dataset-Quality/infra/bootstrap
   terraform init
   terraform apply

   cd ../environments/dev
   terraform init -migrate-state
   cd ../../environments/prod
   terraform init -migrate-state
   ```
   `dev`'s migration prompts an interactive confirmation (`Do you want to copy existing state to the new backend?`) because it already has real state from the `github_oidc` bootstrap in OPS-05 — answer `yes`. `prod` has never been applied, so its migration just moves an effectively-empty state file; still worth doing, for consistency and to prove the backend config is genuinely correct for both.

2. **Bootstrap the dev OIDC role** (already done for account `685538571046` / `us-east-1`, kept here for reference or for re-running against a different account):
   ```bash
   # In AWS CloudShell, already authenticated:
   git clone <repo> && cd Proyecto-02-dataset-Quality/infra/environments/dev
   terraform init
   terraform apply -target=module.github_oidc
   terraform output -raw github_oidc_role_arn   # (add this output if not already present)
   ```
3. **Add the resulting role ARN as a GitHub Actions repository variable** named `AWS_ROLE_ARN`: repo Settings → Secrets and variables → Actions → Variables tab → New repository variable. It's an ARN, not a secret, so a variable (not a secret) is the right place for it.
4. Manually run the **`aws-oidc-check`** workflow (Actions tab → Terraform → Run workflow) and confirm the `aws sts get-caller-identity` step succeeds — that's the end-to-end proof the trust policy is correctly scoped.
5. When a future ticket needs the role to actually do something (push to S3, deploy ECS, etc.), extend `managed_policy_arns` on the `github_oidc` module call rather than widening the trust policy — keep permissions additive and specific to what's actually used.
