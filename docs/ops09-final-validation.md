# OPS-09 — Final infrastructure, DVC, CI and security validation

Evidence for [issue #48](https://github.com/White-eclipse1/Proyecto-02-dataset-Quality/issues/48), run against the release-candidate commit on `main`: **`459ae56`** (`docs(ops07): correct the DEV evidence transcript after the CRLF dvc.lock fix`). `git status` clean, local `main` matches `origin/main` exactly at this commit.

## Required commands

| Command | Result |
| --- | --- |
| `ruff check .` | `All checks passed!` |
| `ruff format --check .` | `50 files already formatted` |
| `pytest` | `105 passed` |
| `dvc dag` | Full 7-node graph renders (`coco-dataset.json.dvc → ingest → validate → analyze → quality_gate → split → release`), no cycles |
| `dvc repro` (1st, after `dvc pull -r dev`) | All 6 stages `didn't change, skipping` — `Data and pipelines are up to date.` |
| `dvc repro` (2nd) | Identical — all 6 stages skipped, `Data and pipelines are up to date.` |
| `dvc status` | `Data and pipelines are up to date.` |
| `dvc status -r dev` | `Cache and remote 'dev' are in sync.` |
| `terraform fmt -check -recursive infra/` | Exit 0, no output (clean) |
| `terraform init -backend=false && terraform validate` (`environments/dev`) | `Success! The configuration is valid.` |
| `terraform init -backend=false && terraform validate` (`environments/prod`) | `Success! The configuration is valid.` |
| GitHub Actions CI on this commit | **Pipeline CI: success** ([run 35410069256](https://github.com/White-eclipse1/Proyecto-02-dataset-Quality/actions/runs/35410069256)) |

All commands run inside the `pipeline` Compose profile (real MinIO + the real 311-image annotated dataset, not seed data) or via the official `hashicorp/terraform:1.9.8` image — same mechanism as `.github/workflows/pipeline-ci.yml` / `terraform.yml`, not a hand-rolled substitute.

`dvc repro` run twice with no rerun either time is the direct evidence for Section 6's own acceptance test — see [pipeline/README.md](../pipeline/README.md#prod-remote-and-hash-consistency-ops-07) for the full transcript and how a real bug in this exact check (stale CRLF hashes for two `release`-stage deps) was caught and fixed before this commit.

## Security checks (full `git log --all` history, not just `HEAD`)

| Check | Command | Result |
| --- | --- | --- |
| Real `.env` files tracked | `git ls-files \| grep -E '(^\|/)\.env(\..+)?$' \| grep -v '\.example$'` | Empty — only `.env.example`/`.env.production.example` are tracked, never a real `.env` |
| `.tfstate` tracked | `git ls-files \| grep -E '\.tfstate'` | Empty |
| Data files tracked (`.jpg`/`.png`/`.parquet`) | `git ls-files \| grep -E '\.(jpg\|png\|parquet)$'` | Empty |
| AWS access/secret keys | `git log --all -S 'AKIA'` | 3 commits match — all reviewed, all false positives (see below) |
| LLM API keys (Anthropic/OpenAI-shaped) | `git log --all -p \| grep -inE "sk-ant-...\|sk-...\|ANTHROPIC_API_KEY=...sk-\|OPENAI_API_KEY=...sk-"` | Empty |
| MinIO / MariaDB credentials | `git log --all -p` for `MINIO_ROOT_PASSWORD`/`MINIO_SECRET_KEY`/`MARIADB_ROOT_PASSWORD`/`DB_PASSWORD` values | Only local-dev placeholders ever appear (`minioadmin`, `password`, `minio_secure_password`, `app_secure_password`) — no value distinct from what `.env.example` already documents publicly |

### The 3 `AKIA` matches — reviewed individually, none is a real key

- `11d312b` (*Add Terraform CI: fmt/validate/credential-grep...*) — adds `terraform.yml`'s own check, which greps *for* the literal string `AKIA` to block real keys. The match is the detector, not a leak.
- `1936ab1` (*Revert "Merge pull request #1..."*) and `9311394` (*feat: import project 1 portal...*) — both contain the same line, a documented audit command in a notes/README file: `` git log --all -p | grep -inE "AKIA[0-9A-Z]{16}|..." ``. It's someone's own security-audit recipe, later reverted with the rest of that import — not a credential.

No static AWS credential (`aws_secret_access_key`, `aws-access-key-id`, a literal `AKIA…` key) was found anywhere in history — consistent with `terraform.yml`'s own CI gate, which fails the build on exactly this pattern.

## Acceptance criteria (issue #48)

- [x] Ruff passes.
- [x] Formatting passes.
- [x] Pytest passes.
- [x] DVC pipeline passes.
- [x] Second DVC reproduction is idempotent.
- [x] Terraform validates.
- [x] CI is green.
- [x] No secrets found in repository history.
- [x] No prohibited files tracked.

All checks green on `459ae56`. Release candidate technically approved — pending human review before OPS-10 (issue #49) proceeds, which also needs APP-10/DQ-09/DQ-10 closed independently of this ticket.
