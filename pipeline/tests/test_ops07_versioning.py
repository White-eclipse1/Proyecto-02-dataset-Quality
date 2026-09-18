from __future__ import annotations

import pytest

from dataset_quality.versioning.__main__ import _diff, _parse_semver
from dataset_quality.versioning.models import VersionSnapshot


def test_parse_semver_accepts_plain_major_minor_patch() -> None:
    assert _parse_semver("v1.0.0") == (1, 0, 0)
    assert _parse_semver("v2.11.3") == (2, 11, 3)


@pytest.mark.parametrize("version", ["1.0.0", "v1.0", "v1.0.0-dev", "vX.0.0", "v1.0.0.0"])
def test_parse_semver_rejects_anything_else(version: str) -> None:
    with pytest.raises(ValueError, match="MAJOR"):
        _parse_semver(version)


def _snapshot(
    image_count: int,
    box_count: int,
    per_class_counts: dict[str, int],
    small_object_percentage: float,
) -> VersionSnapshot:
    return VersionSnapshot(
        image_count=image_count,
        box_count=box_count,
        per_class_counts=per_class_counts,
        small_object_percentage=small_object_percentage,
    )


def test_diff_signs_match_direction_of_change_not_just_magnitude() -> None:
    previous = _snapshot(100, 250, {"person": 300, "car": 305}, 10.0)
    current = _snapshot(90, 260, {"person": 300, "car": 305}, 12.5)

    diff = _diff(current, previous, min_images_threshold=300)

    assert diff.images_added == -10  # fewer images than before: negative, not "removed=10"
    assert diff.boxes_added == 10
    assert diff.small_object_ratio_change_pct == pytest.approx(2.5)


def test_diff_classes_left_minimum_only_lists_new_regressions() -> None:
    # "car" was already below 300 last release — not a *new* regression this time.
    # "person" just dropped below 300 this release — that IS a new regression.
    # "bike" stays comfortably above 300 both times — never listed.
    previous = _snapshot(500, 1000, {"person": 305, "car": 280, "bike": 400}, 5.0)
    current = _snapshot(495, 990, {"person": 298, "car": 275, "bike": 390}, 5.0)

    diff = _diff(current, previous, min_images_threshold=300)

    assert diff.classes_left_minimum == ["person"]


def test_diff_classes_left_minimum_empty_when_nothing_newly_regresses() -> None:
    previous = _snapshot(500, 1000, {"person": 310, "car": 320}, 5.0)
    current = _snapshot(505, 1010, {"person": 312, "car": 325}, 5.0)

    diff = _diff(current, previous, min_images_threshold=300)

    assert diff.classes_left_minimum == []
