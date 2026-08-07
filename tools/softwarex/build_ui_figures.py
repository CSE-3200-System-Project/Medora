#!/usr/bin/env python3
"""Prepare the interface screenshots used as figures in the SoftwareX manuscript.

The manuscript embeds raw product screenshots. Hand-cropping them would make the
figures unreproducible, so this script derives every published figure
deterministically from the archived source image:

1. cover contact details belonging to a real person with opaque fill,
2. trim the browser scrollbar gutter on desktop captures,
3. trim uniform blank bands from each edge,
4. downscale to a fixed width so the embedded PNG is not carrying pixels the page
   cannot show,
5. write to ``docs/softwarex/figures-ui/`` under the name the manuscript uses.

Step 1 uses opaque fill rather than blur for the reason ``tools/redaction`` gives:
blur is linear and partially invertible, so it is not a de-identification control.

Re-running it reproduces byte-comparable output from the same inputs.

    python tools/softwarex/build_ui_figures.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "docs" / "softwarex" / "imagesui"
OUTPUT_DIR = ROOT / "docs" / "softwarex" / "figures-ui"

# Desktop captures include the browser scrollbar; phone captures do not.
DESKTOP_WIDTH = 1400
PHONE_WIDTH = 460

# (source, output name, kind). Kind selects the target width and whether the
# right-hand scrollbar gutter is removed.
FIGURES: tuple[tuple[str, str, str], ...] = (
    ("patient/dashboard.png", "ui_dashboard_en.png", "desktop"),
    ("patient/dashboard_bangla.png", "ui_dashboard_bn.png", "desktop"),
    ("patient/data_sharing.png", "ui_consent_sharing.png", "desktop"),
    ("patient/history_access.png", "ui_consent_audit.png", "desktop"),
    ("patient/Find_doc_ai.png", "ui_ai_navigation.png", "desktop"),
    ("doctor/ai_summarizer_for_patient.png", "ui_ai_summary.png", "desktop"),
    ("doctor/consultation.png", "ui_prescription.png", "desktop"),
    ("patient/chorui_ai_mob.png", "ui_mobile_assistant.png", "phone"),
    ("patient/medical_history_mob.png", "ui_mobile_history.png", "phone"),
    ("patient/datasharing_mob.png", "ui_mobile_consent.png", "phone"),
)

# A row or column counts as blank when no channel varies by more than this along
# its length. Small enough to keep antialiased card edges, large enough to catch
# the near-uniform page gutter.
FLATNESS_TOLERANCE = 6
SCROLLBAR_GUTTER = 24

# A row or column belongs to the page gutter unless its luminance spread exceeds
# this. Cards, controls, and text all clear it comfortably; the background
# gradient does not.
CONTENT_VARIATION = 18
CONTENT_PADDING = 12

# Regions covered before any other processing, in source pixels. These are the
# telephone number and email address of a real person shown in the demonstration
# account; the pseudonymous patient reference beside them is deliberately kept,
# because it is what the manuscript describes reaching the model.
REDACTIONS: dict[str, tuple[tuple[int, int, int, int], ...]] = {
    "doctor/consultation.png": ((330, 526, 575, 586),),
}


def _line_is_flat(pixels: list[tuple[int, int, int]]) -> bool:
    for channel in range(3):
        values = [pixel[channel] for pixel in pixels]
        if max(values) - min(values) > FLATNESS_TOLERANCE:
            return False
    return True


def trim_flat_border(image: Image.Image) -> Image.Image:
    """Remove uniform bands from each edge without touching interior content."""
    width, height = image.size
    data = image.load()

    top = 0
    while top < height - 1 and _line_is_flat([data[x, top] for x in range(0, width, 4)]):
        top += 1
    bottom = height
    while bottom > top + 1 and _line_is_flat([data[x, bottom - 1] for x in range(0, width, 4)]):
        bottom -= 1
    left = 0
    while left < width - 1 and _line_is_flat([data[left, y] for y in range(top, bottom, 4)]):
        left += 1
    right = width
    while right > left + 1 and _line_is_flat([data[right - 1, y] for y in range(top, bottom, 4)]):
        right -= 1

    return image.crop((left, top, right, bottom))


def trim_gradient_border(image: Image.Image) -> Image.Image:
    """Drop the page gutter that ``trim_flat_border`` cannot see.

    The application background is a vertical gradient, so a gutter column is not
    flat -- but it is smooth, whereas any column crossing a card, a control, or
    text is not. Columns and rows whose spread stays under
    ``CONTENT_VARIATION`` are therefore background and can be dropped.
    """
    grey = image.convert("L")
    width, height = grey.size
    data = grey.load()

    def column_has_content(x: int) -> bool:
        values = [data[x, y] for y in range(0, height, 3)]
        return max(values) - min(values) > CONTENT_VARIATION

    def row_has_content(y: int) -> bool:
        values = [data[x, y] for x in range(0, width, 3)]
        return max(values) - min(values) > CONTENT_VARIATION

    columns = [x for x in range(width) if column_has_content(x)]
    rows = [y for y in range(height) if row_has_content(y)]
    if not columns or not rows:
        return image

    left = max(0, columns[0] - CONTENT_PADDING)
    right = min(width, columns[-1] + 1 + CONTENT_PADDING)
    top = max(0, rows[0] - CONTENT_PADDING)
    bottom = min(height, rows[-1] + 1 + CONTENT_PADDING)
    return image.crop((left, top, right, bottom))


def build(source: Path, destination: Path, kind: str, key: str) -> tuple[int, int]:
    image = Image.open(source).convert("RGB")

    for box in REDACTIONS.get(key, ()):  # opaque fill, never blur
        image.paste((0, 0, 0), box)

    if kind == "desktop" and image.width > 2 * SCROLLBAR_GUTTER:
        image = image.crop((0, 0, image.width - SCROLLBAR_GUTTER, image.height))

    image = trim_flat_border(image)
    image = trim_gradient_border(image)

    target_width = DESKTOP_WIDTH if kind == "desktop" else PHONE_WIDTH
    if image.width > target_width:
        target_height = round(image.height * target_width / image.width)
        image = image.resize((target_width, target_height), Image.LANCZOS)

    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, format="PNG", optimize=True)
    return image.size


def main() -> int:
    missing = [name for name, _, _ in FIGURES if not (SOURCE_DIR / name).is_file()]
    if missing:
        print("missing source screenshots:", ", ".join(missing), file=sys.stderr)
        return 2

    for name, output_name, kind in FIGURES:
        size = build(SOURCE_DIR / name, OUTPUT_DIR / output_name, kind, name)
        print(f"{output_name}: {size[0]}x{size[1]} from {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
