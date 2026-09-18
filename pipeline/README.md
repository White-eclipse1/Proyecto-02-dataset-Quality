# pipeline/

Python 3.12 DVC pipeline: `ingest → validate → analyze → quality_gate → split → release`. See `dvc.yaml` for the full stage graph and `docs/` (repo root) for the Data Quality baseline audits.

## Dataset release & versioning (OPS-07)

The `release` stage (`src/dataset_quality/versioning/__main__.py`) stamps each pipeline run as a dataset version and writes the full version timeline to `data/interim/versions.json` (`VersionsReport`, `copilot/contracts.py`). It reads and appends to a git-tracked ledger, `pipeline/data/version_history.json`, which is what makes a real diff against the *previous* release possible without re-reading old dataset files. That ledger is deliberately **not** a DVC dependency or output — it's a side effect the script appends to on every run, not a reproducibility input; wiring it into `dvc.yaml` would make `release` perpetually "dirty" against its own last write and break `dvc repro`'s rerun-avoidance for everything downstream of it.

### Versioning rules

- The dataset version (`params.yaml`'s `dataset_version`) must be `v<MAJOR>.<MINOR>.<PATCH>` — no prerelease suffixes.
- The **first** release in the ledger must be exactly `v1.0.0`.
- Every later release must be **strictly greater** (tuple comparison of MAJOR.MINOR.PATCH) than the last one recorded — the stage raises and refuses to run otherwise, rather than silently overwriting history.

### Reading a `VersionDiff` — sign convention

Each release after the first carries a `diff_from_previous` (`VersionDiff` in `copilot/contracts.py`) comparing it to the release immediately before it. **These numbers are signed deltas, not absolute counts** — read them like a bank statement, not a summary:

| Field | Meaning |
|---|---|
| `images_added` | `current_image_count − previous_image_count`. **Negative means images were removed**, not "0 added, N missing" — there is no separate `images_removed` field; the sign carries the direction. |
| `boxes_added` | Same idea, for total bounding-box annotations. Negative = fewer boxes than last release. |
| `classes_left_minimum` | Category names that **newly** dropped below `quality.yaml`'s real `min_images_per_class` threshold *in this release* — i.e. they were at or above it last release and are below it now. This is a regression signal, not a snapshot: a class that has been below the threshold for several releases in a row is **not** re-listed every time, only on the release where it first crosses down. A class recovering back above the threshold isn't listed either (there's no `classes_left_minimum`-equivalent for the reverse direction — check two consecutive `per_class` snapshots directly if that's needed). |
| `small_object_ratio_change_pct` | `current_small_object_percentage − previous_small_object_percentage`, in percentage **points** (e.g. `10.0 → 13.5` reports `3.5`, not a ratio-of-ratios like `1.35`). Negative means small objects became relatively less common. |

Worked example (from a real end-to-end test run of the `release` stage): image count went 300 → 290, annotations 700 → 690, category `person`'s distinct-image count went 305 → 295 (crossing below the 300 threshold), `car` went 310 → 312 (stayed above), small-object percentage went 10.0 → 13.5. The resulting diff was:

```json
{
  "images_added": -10,
  "boxes_added": -10,
  "classes_left_minimum": ["person"],
  "small_object_ratio_change_pct": 3.5
}
```

### PROD remote and hash consistency (OPS-07)

`pipeline/.dvc/config` has two remotes: `dev` (MinIO, `s3://dvc-cache`) and `prod` (real AWS S3, `s3://dvc-cache-prod-<account_id>`) — `dev` is untouched by this ticket, still MinIO. DVC's cache is content-addressed, so pushing the same local cache to both remotes with `dvc push -r dev` / `dvc push -r prod` produces byte-identical objects in both by construction; `infra/README.md`'s release-workflow section documents the real, evidence-backed run that proves this end-to-end.
