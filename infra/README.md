# Infrastructure (OPS-05 foundation)

Terraform for the dataset-quality pipeline's AWS infrastructure. Laid out as reusable modules under `modules/`, composed per environment under `environments/{dev,prod}`.

## Modules

| Module | What it is | Status |
|---|---|---|
| `network` | VPC across 2 AZs, public + private subnets, IGW, route tables. No NAT gateway — nothing needs outbound internet yet; OPS-08 reaches AWS services from the private subnets via a VPC S3 Gateway Endpoint instead. | Validate-only |
| `compute` | ECS Fargate cluster + task execution IAM role. No task definitions yet — those need an actual container image, which comes with OPS-08. | Validate-only |
| `data` | RDS MariaDB in the private subnets. Master credentials are managed natively by RDS's Secrets Manager integration (`manage_master_user_password = true`) rather than a hand-rolled secret. | Validate-only |
| `storage` | Generic private S3 bucket module (name/versioning as inputs). Deliberately doesn't know about `dvc-cache` or `dataset-releases` — those specific buckets, their immutability config, and the VPC Gateway Endpoint are OPS-08's job. Each environment wires it to one placeholder bucket just so the module is genuinely exercised by `terraform validate`, clearly tagged `Purpose = placeholder-do-not-use`. | Validate-only |
| `github-oidc` | GitHub Actions → AWS trust via OIDC: an `aws_iam_openid_connect_provider` plus an `aws_iam_role` whose trust policy only accepts tokens whose `sub` claim matches this exact repo on an allowed branch. No static AWS keys anywhere. The role starts with **zero** attached permissions (`managed_policy_arns = []`) — `sts:GetCallerIdentity` needs none, and later tickets (OPS-06/07/08) add permissions incrementally as they're actually needed, instead of granting broad access upfront. | **Applied for real in dev** |

## What's actually deployed vs. what's just validated

Only `module.github_oidc` in `environments/dev` has been applied for real, by Diego, in **AWS CloudShell** (already authenticated in-browser — no local access keys were ever created). IAM resources are free, so this gives genuine evidence the OIDC trust works, without spending anything on RDS/ECS before OPS-08 actually needs them running.

Everything else (`network`, `compute`, `data`, `storage` in both environments) is validate-only: `terraform fmt`, `terraform init -backend=false`, and `terraform validate` all pass, but nothing has been `apply`'d. `prod` hasn't been touched at all — it assumes a separate AWS account, which is why it has its own `github-oidc` provider/role rather than sharing dev's (a single AWS account can only have one GitHub OIDC provider per URL; two independent accounts each need their own).

## One-time setup for whoever picks this up next

1. **Bootstrap the dev OIDC role** (already done for account `685538571046` / `us-east-1`, kept here for reference or for re-running against a different account):
   ```bash
   # In AWS CloudShell, already authenticated:
   git clone <repo> && cd Proyecto-02-dataset-Quality/infra/environments/dev
   terraform init
   terraform apply -target=module.github_oidc
   terraform output -raw github_oidc_role_arn   # (add this output if not already present)
   ```
2. **Add the resulting role ARN as a GitHub Actions repository variable** named `AWS_ROLE_ARN`: repo Settings → Secrets and variables → Actions → Variables tab → New repository variable. It's an ARN, not a secret, so a variable (not a secret) is the right place for it.
3. Manually run the **`aws-oidc-check`** workflow (Actions tab → Terraform → Run workflow) and confirm the `aws sts get-caller-identity` step succeeds — that's the end-to-end proof the trust policy is correctly scoped.
4. When OPS-08 needs the role to actually do something (push to S3, deploy ECS, etc.), extend `managed_policy_arns` on the `github_oidc` module call rather than widening the trust policy — keep permissions additive and specific to what's actually used.
