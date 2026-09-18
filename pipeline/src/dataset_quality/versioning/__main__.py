"""CLI for the DVC `release` stage: assemble the dataset version record.

Deliberately minimal for OPS-04: a single current-version entry with no diff history
(`diff_from_previous=None`) and PROD marked "pending" — semantic versioning (v1.0.0 flow)
and the DEV/PROD content-hash comparison are OPS-07's job, not this ticket's. Reuses
APP-06's `VersionsReport` model (copilot/contracts.py) instead of duplicating it, since
that model's own docstring already anticipates Tier 5 (this stage) reconciling against it.

Does NOT write to contracts/versions.json — that's the established mock file Hannah's
frontend/Copilot already read from `main`; switching it from mock to pipeline-produced is
a cross-team call for OPS-07/08, not something to do unilaterally here.
"""

from __future__ import annotations

import json
from argparse import ArgumentParser
from datetime import UTC, datetime
from pathlib import Path

from dataset_quality.analyzers.m3 import source_sha256
from dataset_quality.copilot.contracts import (
    DatasetVersionEntry,
    EnvironmentStatus,
    VersionEnvironments,
    VersionsReport,
)


def main() -> None:
    parser = ArgumentParser(description="Assemble the dataset version record.")
    parser.add_argument("--coco", type=Path, required=True, help="Canonicalized COCO JSON")
    parser.add_argument("--quality-report", type=Path, required=True)
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    quality_report = json.loads(args.quality_report.read_text(encoding="utf-8"))
    now = datetime.now(UTC)

    entry = DatasetVersionEntry(
        version=args.dataset_version,
        released_at=now,
        content_hash=source_sha256(args.coco),
        quality_status=quality_report["overall_status"],
        environments=VersionEnvironments(
            dev=EnvironmentStatus(provider="minio", status="available", synced_at=now),
            prod=EnvironmentStatus(provider="s3", status="pending", synced_at=None),
        ),
        diff_from_previous=None,
    )
    report = VersionsReport(current_version=args.dataset_version, versions=[entry])

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report.model_dump_json(indent=2), encoding="utf-8")
    print(report.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
