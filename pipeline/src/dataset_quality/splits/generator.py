"""Stratified, reproducible train/validation/test split generation (Tier 4)."""

from __future__ import annotations

import random
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime

from dataset_quality.config.models import SplitConfig
from dataset_quality.ingestion.models import CocoDataset
from dataset_quality.splits.models import (
    SplitClassDistribution,
    SplitLeakageCheck,
    SplitProportions,
    SplitReproducibilityCheck,
    SplitResult,
    SplitTotals,
)

_SPLIT_NAMES: tuple[str, ...] = ("train", "val", "test")


@dataclass(frozen=True)
class SplitGenerationResult:
    """The full per-image assignment plus the serializable summary report.

    ``assignment`` (image ids per split, sorted) is what callers use to write
    the actual dataset files; ``report`` is the ``contracts/splits.json``-shaped
    summary consumed by the Splits screen (APP-05) and DVC (OPS-04).
    """

    assignment: dict[str, list[int]]
    report: SplitResult


def generate_splits(
    dataset: CocoDataset,
    config: SplitConfig,
    dataset_version: str,
    duplicate_pairs: Sequence[tuple[int, int]] | None = None,
    tolerance: float = 0.02,
    generated_at: datetime | None = None,
) -> SplitGenerationResult:
    """Partition every image in ``dataset`` into train/validation/test per ``config``.

    - Deterministic: the same dataset, config and ``duplicate_pairs`` always
      produce the same image-id assignment for a given seed. This is not just
      assumed — the assignment is computed twice and compared before
      returning, and the result is reported in ``reproducibility_check``.
    - Grouped: image ids linked by ``duplicate_pairs`` (near-duplicates, e.g.
      DQ-05's pHash output, once available) are always kept together in a
      single split, so cross-split leakage is impossible by construction.
    - Covered: every category present in ``dataset`` is guaranteed to appear
      in both the validation and test splits, donating the smallest eligible
      group (preferring train) when the first pass misses one.

    Raises ``ValueError`` if a duplicate pair references an image id that is
    not part of ``dataset``.
    """

    duplicate_pairs = list(duplicate_pairs or [])
    image_ids = [image.id for image in dataset.images]
    known_image_ids = set(image_ids)
    for image_a, image_b in duplicate_pairs:
        if image_a not in known_image_ids or image_b not in known_image_ids:
            raise ValueError(
                f"duplicate pair ({image_a}, {image_b}) references an unknown image_id"
            )

    image_categories = _image_categories(dataset)
    name_by_category_id = {category.id: category.name for category in dataset.categories}
    groups = _build_duplicate_groups(image_ids, duplicate_pairs)

    first_assignment, first_group_split = _assign_with_full_class_coverage(
        groups, config, image_categories, dataset
    )
    second_assignment, _ = _assign_with_full_class_coverage(
        groups, config, image_categories, dataset
    )
    reproducible = _sorted(first_assignment) == _sorted(second_assignment)

    totals = SplitTotals(
        images=len(image_ids),
        train=len(first_assignment["train"]),
        val=len(first_assignment["val"]),
        test=len(first_assignment["test"]),
    )
    class_distribution = SplitClassDistribution(
        **{
            split_name: _class_counts(
                first_assignment[split_name], image_categories, name_by_category_id
            )
            for split_name in _SPLIT_NAMES
        }
    )
    leakage_check = _leakage_check(duplicate_pairs, first_group_split, groups)
    reproducibility_check = SplitReproducibilityCheck(
        status="pass" if reproducible else "fail",
        note=(
            f"Two runs with seed={config.seed} produced identical image_id assignments "
            "per split."
            if reproducible
            else f"Two runs with seed={config.seed} produced DIFFERENT image_id "
            "assignments — split generation is not reproducible."
        ),
    )

    report = SplitResult(
        dataset_version=dataset_version,
        generated_at=generated_at or datetime.now(UTC),
        seed=config.seed,
        proportions=SplitProportions(train=config.train, val=config.val, test=config.test),
        tolerance=tolerance,
        totals=totals,
        class_distribution=class_distribution,
        leakage_check=leakage_check,
        reproducibility_check=reproducibility_check,
    )

    return SplitGenerationResult(assignment=_sorted(first_assignment), report=report)


def _image_categories(dataset: CocoDataset) -> dict[int, set[int]]:
    categories: dict[int, set[int]] = defaultdict(set)
    for annotation in dataset.annotations:
        categories[annotation.image_id].add(annotation.category_id)
    return categories


def _build_duplicate_groups(
    image_ids: list[int], duplicate_pairs: list[tuple[int, int]]
) -> dict[int, list[int]]:
    """Union-find over ``duplicate_pairs``. Returns group_id -> sorted member image ids.

    Every image belongs to exactly one group; an image with no duplicate
    pair is its own singleton group.
    """

    parent = {image_id: image_id for image_id in image_ids}

    def find(node: int) -> int:
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    def union(a: int, b: int) -> None:
        root_a, root_b = find(a), find(b)
        if root_a == root_b:
            return
        # Smaller id always wins as root, regardless of pair order, so the
        # resulting grouping is deterministic for a given set of pairs.
        if root_a < root_b:
            parent[root_b] = root_a
        else:
            parent[root_a] = root_b

    for image_a, image_b in duplicate_pairs:
        union(image_a, image_b)

    members: dict[int, list[int]] = defaultdict(list)
    for image_id in image_ids:
        members[find(image_id)].append(image_id)
    return {group_id: sorted(ids) for group_id, ids in members.items()}


def _assign_with_full_class_coverage(
    groups: dict[int, list[int]],
    config: SplitConfig,
    image_categories: dict[int, set[int]],
    dataset: CocoDataset,
) -> tuple[dict[str, list[int]], dict[int, str]]:
    assignment, group_split = _assign_groups(groups, config)
    _fill_class_coverage_gaps(groups, group_split, assignment, image_categories, dataset)
    return assignment, group_split


def _assign_groups(
    groups: dict[int, list[int]], config: SplitConfig
) -> tuple[dict[str, list[int]], dict[int, str]]:
    """Deficit-balanced (Bresenham-style) group assignment.

    Groups are visited in a seeded-shuffle order; at every step the group
    goes to whichever split currently has the largest gap between its target
    and actual image count. This keeps every split within roughly one
    group's size of its target proportion, and is fully determined by the
    seed (same seed -> same visiting order -> same assignment).
    """

    target_ratio = {"train": config.train, "val": config.val, "test": config.test}
    total_images = sum(len(members) for members in groups.values())
    target_count = {name: ratio * total_images for name, ratio in target_ratio.items()}
    counts = dict.fromkeys(_SPLIT_NAMES, 0)

    ordered_group_ids = sorted(groups)
    random.Random(config.seed).shuffle(ordered_group_ids)

    assignment: dict[str, list[int]] = {name: [] for name in _SPLIT_NAMES}
    group_split: dict[int, str] = {}

    for group_id in ordered_group_ids:
        members = groups[group_id]
        chosen = max(_SPLIT_NAMES, key=lambda name: target_count[name] - counts[name])
        group_split[group_id] = chosen
        counts[chosen] += len(members)
        assignment[chosen].extend(members)

    return assignment, group_split


def _fill_class_coverage_gaps(
    groups: dict[int, list[int]],
    group_split: dict[int, str],
    assignment: dict[str, list[int]],
    image_categories: dict[int, set[int]],
    dataset: CocoDataset,
) -> None:
    ordered_group_ids = sorted(groups)

    for required_split in ("val", "test"):
        present = {
            category_id
            for image_id in assignment[required_split]
            for category_id in image_categories.get(image_id, ())
        }
        missing = [category.id for category in dataset.categories if category.id not in present]

        for category_id in missing:
            donor = _find_donor_group(
                category_id,
                required_split,
                groups,
                group_split,
                image_categories,
                ordered_group_ids,
            )
            if donor is None:
                # The category has no eligible donor left outside this split —
                # every image carrying it is already here or nowhere in the
                # dataset. Nothing left to move.
                continue
            _move_group(donor, required_split, groups, group_split, assignment)


def _find_donor_group(
    category_id: int,
    required_split: str,
    groups: dict[int, list[int]],
    group_split: dict[int, str],
    image_categories: dict[int, set[int]],
    ordered_group_ids: list[int],
) -> int | None:
    other_required = "test" if required_split == "val" else "val"
    # Prefer donating from train (the largest, least disruptive pool) before
    # borrowing from the other split that also needs full class coverage.
    for source in ("train", other_required):
        candidates = [
            group_id
            for group_id in ordered_group_ids
            if group_split[group_id] == source
            and any(category_id in image_categories.get(img, ()) for img in groups[group_id])
        ]
        if candidates:
            candidates.sort(key=lambda group_id: (len(groups[group_id]), group_id))
            return candidates[0]
    return None


def _move_group(
    group_id: int,
    target_split: str,
    groups: dict[int, list[int]],
    group_split: dict[int, str],
    assignment: dict[str, list[int]],
) -> None:
    source = group_split[group_id]
    if source == target_split:
        return
    members = set(groups[group_id])
    assignment[source] = [image_id for image_id in assignment[source] if image_id not in members]
    assignment[target_split].extend(groups[group_id])
    group_split[group_id] = target_split


def _class_counts(
    image_ids: list[int],
    image_categories: dict[int, set[int]],
    name_by_category_id: dict[int, str],
) -> dict[str, int]:
    counter: Counter[str] = Counter()
    for image_id in image_ids:
        for category_id in image_categories.get(image_id, ()):
            counter[name_by_category_id[category_id]] += 1
    return dict(counter)


def _leakage_check(
    duplicate_pairs: list[tuple[int, int]],
    group_split: dict[int, str],
    groups: dict[int, list[int]],
) -> SplitLeakageCheck:
    image_to_group = {
        image_id: group_id for group_id, members in groups.items() for image_id in members
    }
    same_split = sum(
        1
        for image_a, image_b in duplicate_pairs
        if group_split[image_to_group[image_a]] == group_split[image_to_group[image_b]]
    )
    checked = len(duplicate_pairs)
    leaked = checked - same_split
    return SplitLeakageCheck(
        status="pass" if leaked == 0 else "fail",
        leaked_pairs=leaked,
        near_duplicate_pairs_checked=checked,
        near_duplicate_pairs_same_split=same_split,
    )


def _sorted(assignment: dict[str, list[int]]) -> dict[str, list[int]]:
    return {name: sorted(ids) for name, ids in assignment.items()}
