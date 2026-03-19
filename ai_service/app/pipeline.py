from __future__ import annotations

import logging
import time
from io import BytesIO

from PIL import Image, ImageOps

from app.azure_ocr import AzureReadClient
from app.config import settings
from app.db import medicine_vocabulary
from app.parser import parse_prescription
from app.schemas import BBox, DetectedRegion, OCRDebug, OCRLine, OCRMeta, OCRResponse
from app.yolo import detect_regions

logger = logging.getLogger(__name__)


class OCRPipeline:
    def __init__(self) -> None:
        self._azure_client: AzureReadClient | None = None

    def run(self, image_bytes: bytes, debug: bool = False) -> OCRResponse:
        started_at = time.perf_counter()

        model_type = settings.MODEL_TYPE.lower().strip()
        if model_type == "read":
            medications, all_lines, model_name, region_count, crop_count, regions, vocab_size = self._run_read_pipeline(image_bytes)
        elif model_type == "custom":
            medications, all_lines, model_name, region_count, crop_count, regions, vocab_size = self._run_custom_pipeline(image_bytes)
        elif model_type == "llm":
            medications, all_lines, model_name, region_count, crop_count, regions, vocab_size = self._run_llm_pipeline(image_bytes)
        else:
            medications, all_lines, model_name, region_count, crop_count, regions, vocab_size = self._run_read_pipeline(image_bytes)

        raw_text = "\n".join(line.text for line in all_lines)
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        logger.debug(
            "ocr_pipeline_summary model=%s regions=%d crops=%d lines=%d meds=%d elapsed_ms=%d",
            model_name,
            region_count,
            crop_count,
            len(all_lines),
            len(medications),
            elapsed_ms,
        )

        if settings.OCR_LOG_FULL_TEXT:
            logger.debug("ocr_raw_text full=%r", raw_text)
        else:
            logger.debug("ocr_raw_text preview=%r", raw_text[: settings.OCR_LOG_MAX_CHARS])
        logger.debug("ocr_parsed_medications_count=%d", len(medications))

        response = OCRResponse(
            medications=medications,
            raw_text=raw_text,
            meta=OCRMeta(
                model=model_name,
                model_type=model_type,
                processing_time_ms=elapsed_ms,
                detected_regions=region_count,
                ocr_line_count=len(all_lines),
            ),
        )
        if debug:
            response.debug = OCRDebug(
                detected_regions=regions,
                ocr_lines=all_lines,
                medicine_db_enabled=not settings.DISABLE_MEDICINE_MATCHING,
                medicine_candidates_loaded=vocab_size,
            )
        return response

    def _run_read_pipeline(self, image_bytes: bytes):
        if self._azure_client is None:
            self._azure_client = AzureReadClient()

        all_detections = detect_regions(image_bytes, use_full_image_fallback=False)
        if settings.OCR_LOG_YOLO_FINDINGS:
            logger.debug("yolo_findings full_image=%s", [_region_to_log_dict(region) for region in all_detections])

        parent_labels = _parse_label_list(settings.YOLO_PARENT_CLASSES)
        child_labels = _parse_label_list(
            ",".join(
                [
                    settings.YOLO_LINE_CLASSES,
                    settings.YOLO_FREQUENCY_CLASSES,
                    settings.YOLO_QUANTITY_CLASSES,
                ]
            )
        )

        medication_regions = _sort_regions(_filter_regions_by_labels(all_detections, parent_labels))
        child_regions = _sort_regions(_filter_regions_by_labels(all_detections, child_labels))

        if not medication_regions and child_regions:
            inferred = _infer_medication_region_from_children(child_regions)
            if inferred is not None:
                medication_regions = [inferred]

        parent_to_children = _assign_children_to_medications(
            medications=medication_regions,
            children=child_regions,
        )

        if settings.OCR_LOG_YOLO_FINDINGS:
            grouped_log = []
            for idx, medication in enumerate(medication_regions):
                grouped_log.append(
                    {
                        "medication": _region_to_log_dict(medication),
                        "children": [_region_to_log_dict(item) for item in parent_to_children.get(idx, [])],
                    }
                )
            logger.debug("yolo_findings grouped=%s", grouped_log)

        ordered_regions = medication_regions
        logger.debug("yolo_detection_complete regions=%d", len(ordered_regions))

        all_lines: list[OCRLine] = []
        region_line_groups: list[list[OCRLine]] = []
        ocr_regions: list[DetectedRegion] = []
        crop_count = 0

        with Image.open(BytesIO(image_bytes)) as source_image:
            source_rgb = ImageOps.exif_transpose(source_image).convert("RGB")

            for idx, medication in enumerate(ordered_regions):
                region_lines: list[OCRLine] = []
                children = parent_to_children.get(idx, [])
                merged_children = _merge_child_regions(children)

                # Primary path: OCR only child boxes (Lines/Frequency/Quantity) from the original image.
                for child in merged_children:
                    child_crop = _crop_region_png_bytes(
                        source_rgb,
                        child.bbox,
                        padding_px=max(2, settings.YOLO_PADDING_PX // 2),
                    )
                    if child_crop is None:
                        continue

                    child_lines = self._azure_client.read_lines(child_crop)
                    if not child_lines:
                        continue

                    region_lines.extend(child_lines)
                    all_lines.extend(child_lines)
                    ocr_regions.append(child)
                    crop_count += 1

                # Medication-only fallback when no child regions produced OCR lines.
                if not region_lines:
                    medication_crop = _crop_region_png_bytes(
                        source_rgb,
                        medication.bbox,
                        padding_px=settings.YOLO_PADDING_PX,
                    )
                    if medication_crop is not None:
                        medication_lines = self._azure_client.read_lines(medication_crop)
                        if medication_lines:
                            region_lines.extend(medication_lines)
                            all_lines.extend(medication_lines)
                            ocr_regions.append(medication)
                            crop_count += 1

                if region_lines:
                    region_line_groups.append(region_lines)

        # Optional full-image fallback remains disabled by default.
        if not all_lines and settings.OCR_USE_FULL_IMAGE_FALLBACK and not all_detections:
            fallback_lines = self._azure_client.read_lines(image_bytes)
            all_lines = fallback_lines
            with Image.open(BytesIO(image_bytes)) as image:
                image_width, image_height = image.size
            ocr_regions = [
                DetectedRegion(
                    label="prescription_fallback",
                    bbox=BBox(x_min=0.0, y_min=0.0, x_max=float(image_width), y_max=float(image_height)),
                    score=1.0,
                )
            ]
            crop_count = 1

        ordered_lines = _sort_lines(all_lines)
        logger.debug("azure_ocr_complete total_lines=%d", len(ordered_lines))

        medicine_names = [] if settings.DISABLE_MEDICINE_MATCHING else medicine_vocabulary.get_names()
        vocabulary_size = len(medicine_names)
        if settings.GROUP_BY_YOLO_FOR_PARSING and region_line_groups:
            medications = _extract_medications_in_region_order(
                region_line_groups=region_line_groups,
                ordered_lines=ordered_lines,
                medicine_names=medicine_names,
            )
        else:
            medications = parse_prescription(ordered_lines, medicine_names)

        return (
            medications,
            ordered_lines,
            f"azure_{settings.AZURE_OCR_MODEL_ID}",
            len(ocr_regions),
            crop_count,
            ocr_regions,
            vocabulary_size,
        )

    def _run_custom_pipeline(self, image_bytes: bytes):
        # Stub for future custom model replacement while keeping the same API contract.
        medications, lines, _, region_count, crop_count, regions, vocabulary_size = self._run_read_pipeline(image_bytes)
        return medications, lines, "custom_stub_using_read", region_count, crop_count, regions, vocabulary_size

    def _run_llm_pipeline(self, image_bytes: bytes):
        # Stub for future multimodal implementation while keeping the same API contract.
        medications, lines, _, region_count, crop_count, regions, vocabulary_size = self._run_read_pipeline(image_bytes)
        return medications, lines, "llm_stub_using_read", region_count, crop_count, regions, vocabulary_size


def _sort_regions(regions: list[DetectedRegion]) -> list[DetectedRegion]:
    return sorted(regions, key=lambda region: (region.bbox.y_min, region.bbox.x_min))


def _parse_label_list(raw_labels: str) -> set[str]:
    return {label.strip().lower() for label in raw_labels.split(",") if label.strip()}


def _filter_regions_by_labels(regions: list[DetectedRegion], labels: set[str]) -> list[DetectedRegion]:
    if not labels:
        return regions
    return [region for region in regions if region.label.strip().lower() in labels]


def _crop_region_png_bytes(image: Image.Image, bbox: BBox, padding_px: int) -> bytes | None:
    width, height = image.size
    x_min = max(0, int(bbox.x_min) - int(padding_px))
    y_min = max(0, int(bbox.y_min) - int(padding_px))
    x_max = min(width, int(bbox.x_max) + int(padding_px))
    y_max = min(height, int(bbox.y_max) + int(padding_px))
    if x_max <= x_min or y_max <= y_min:
        return None

    crop = image.crop((x_min, y_min, x_max, y_max))
    output = BytesIO()
    crop.save(output, format="PNG")
    return output.getvalue()


def _region_to_log_dict(region: DetectedRegion) -> dict[str, object]:
    return {
        "label": region.label,
        "score": round(region.score, 4),
        "bbox": [
            round(region.bbox.x_min, 2),
            round(region.bbox.y_min, 2),
            round(region.bbox.x_max, 2),
            round(region.bbox.y_max, 2),
        ],
    }


def _assign_children_to_medications(
    *,
    medications: list[DetectedRegion],
    children: list[DetectedRegion],
) -> dict[int, list[DetectedRegion]]:
    assignment: dict[int, list[DetectedRegion]] = {idx: [] for idx in range(len(medications))}
    if not medications:
        return assignment

    for child in children:
        child_center_x = (child.bbox.x_min + child.bbox.x_max) / 2
        child_center_y = (child.bbox.y_min + child.bbox.y_max) / 2

        best_idx: int | None = None
        best_overlap = 0.0
        for idx, medication in enumerate(medications):
            if _point_inside_bbox(child_center_x, child_center_y, medication.bbox):
                overlap = _overlap_area(child.bbox, medication.bbox)
                if overlap >= best_overlap:
                    best_overlap = overlap
                    best_idx = idx

        if best_idx is not None:
            assignment[best_idx].append(child)

    for idx in assignment:
        assignment[idx] = _sort_regions(assignment[idx])
    return assignment


def _point_inside_bbox(x: float, y: float, bbox: BBox) -> bool:
    return bbox.x_min <= x <= bbox.x_max and bbox.y_min <= y <= bbox.y_max


def _infer_medication_region_from_children(children: list[DetectedRegion]) -> DetectedRegion | None:
    if not children:
        return None

    x_min = min(item.bbox.x_min for item in children)
    y_min = min(item.bbox.y_min for item in children)
    x_max = max(item.bbox.x_max for item in children)
    y_max = max(item.bbox.y_max for item in children)

    return DetectedRegion(
        label="Medication",
        bbox=BBox(
            x_min=x_min,
            y_min=y_min,
            x_max=x_max,
            y_max=y_max,
        ),
        score=max(item.score for item in children),
    )


def _merge_child_regions(children: list[DetectedRegion]) -> list[DetectedRegion]:
    if not children:
        return []

    x_min = min(item.bbox.x_min for item in children)
    y_min = min(item.bbox.y_min for item in children)
    x_max = max(item.bbox.x_max for item in children)
    y_max = max(item.bbox.y_max for item in children)
    max_score = max(item.score for item in children)

    return [
        DetectedRegion(
            label="MergedChildRegion",
            bbox=BBox(x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max),
            score=max_score,
        )
    ]


def _sort_lines(lines: list[OCRLine]) -> list[OCRLine]:
    return sorted(
        lines,
        key=lambda line: (
            line.page,
            line.bbox.y_min if line.bbox else 10_000.0,
            line.bbox.x_min if line.bbox else 10_000.0,
        ),
    )


def _assign_lines_to_regions(lines: list[OCRLine], regions: list[DetectedRegion]) -> list[list[OCRLine]]:
    if not regions:
        return [lines]

    groups: list[list[OCRLine]] = [[] for _ in regions]
    for line in lines:
        best_idx = 0
        best_score = -1.0

        for idx, region in enumerate(regions):
            score = _line_region_score(line.bbox, region.bbox)
            if score > best_score:
                best_score = score
                best_idx = idx

        groups[best_idx].append(line)

    return groups


def _line_region_score(line_bbox: BBox | None, region_bbox: BBox) -> float:
    if line_bbox is None:
        return 0.0

    overlap = _overlap_area(line_bbox, region_bbox)
    if overlap > 0:
        line_area = max(1e-6, (line_bbox.x_max - line_bbox.x_min) * (line_bbox.y_max - line_bbox.y_min))
        return overlap / line_area

    # If no overlap, choose by inverse distance between centers.
    lx = (line_bbox.x_min + line_bbox.x_max) / 2
    ly = (line_bbox.y_min + line_bbox.y_max) / 2
    rx = (region_bbox.x_min + region_bbox.x_max) / 2
    ry = (region_bbox.y_min + region_bbox.y_max) / 2
    dist = ((lx - rx) ** 2 + (ly - ry) ** 2) ** 0.5
    return 1.0 / (1.0 + dist)


def _overlap_area(a: BBox, b: BBox) -> float:
    x1 = max(a.x_min, b.x_min)
    y1 = max(a.y_min, b.y_min)
    x2 = min(a.x_max, b.x_max)
    y2 = min(a.y_max, b.y_max)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    return (x2 - x1) * (y2 - y1)


def _extract_medications_in_region_order(
    *,
    region_line_groups: list[list[OCRLine]],
    ordered_lines: list[OCRLine],
    medicine_names: list[str],
):
    medications = []
    for group in region_line_groups:
        if not group:
            continue
        parsed_group = parse_prescription(group, medicine_names)
        if not parsed_group:
            continue
        medications.extend(parsed_group)

    if not medications:
        medications = parse_prescription(ordered_lines, medicine_names)

    # Preserve order while dropping exact duplicates.
    unique = []
    seen: set[tuple[str | None, str | None, str | None, str | None]] = set()
    for medication in medications:
        key = (medication.name, medication.dosage, medication.frequency, medication.quantity)
        if key in seen:
            continue
        seen.add(key)
        unique.append(medication)

    return unique
