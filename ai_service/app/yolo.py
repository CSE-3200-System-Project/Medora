from __future__ import annotations

import logging
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageEnhance, ImageOps

from app.config import settings
from app.schemas import BBox, DetectedRegion

logger = logging.getLogger(__name__)

_DETECTOR: "YoloOnnxDetector | None" = None


@dataclass
class _PreparedImage:
    tensor: np.ndarray
    scale: float
    pad_x: float
    pad_y: float
    width: int
    height: int


def detect_regions(image_bytes: bytes, *, use_full_image_fallback: bool = True) -> list[DetectedRegion]:
    with Image.open(BytesIO(image_bytes)) as image:
        image = ImageOps.exif_transpose(image)
        width, height = image.size

    full_image_fallback = [
        DetectedRegion(
            label="prescription",
            bbox=BBox(x_min=0, y_min=0, x_max=float(width), y_max=float(height)),
            score=1.0,
        )
    ]

    detector = _get_detector()
    if detector is None:
        if not use_full_image_fallback:
            return []
        return full_image_fallback

    try:
        detections = detector.detect(image_bytes)
        if detections:
            return detections
        if use_full_image_fallback:
            return full_image_fallback
        return []
    except Exception as exc:
        logger.exception("YOLO detection failed: %s", exc)
        if not use_full_image_fallback:
            return []
        return full_image_fallback


def crop_regions(image_bytes: bytes, regions: list[DetectedRegion], padding_px: int = 12) -> list[bytes]:
    crops: list[bytes] = []
    with Image.open(BytesIO(image_bytes)) as image:
        image = ImageOps.exif_transpose(image)
        width, height = image.size

        for region in regions:
            x_min = max(0, int(region.bbox.x_min) - padding_px)
            y_min = max(0, int(region.bbox.y_min) - padding_px)
            x_max = min(width, int(region.bbox.x_max) + padding_px)
            y_max = min(height, int(region.bbox.y_max) + padding_px)

            if x_max <= x_min or y_max <= y_min:
                continue

            crop = image.crop((x_min, y_min, x_max, y_max))
            processed = _normalize_crop(crop)

            output = BytesIO()
            processed.save(output, format="PNG")
            crops.append(output.getvalue())

    return crops or [image_bytes]


def _normalize_crop(image: Image.Image) -> Image.Image:
    # Improves OCR consistency for low-contrast handwritten prescriptions.
    grayscale = ImageOps.grayscale(image)
    autocontrasted = ImageOps.autocontrast(grayscale)
    enhanced = ImageEnhance.Contrast(autocontrasted).enhance(1.35)
    return enhanced


def _get_detector() -> "YoloOnnxDetector | None":
    global _DETECTOR
    if _DETECTOR is not None:
        return _DETECTOR

    model_path = _resolve_model_path(settings.YOLO_MODEL_PATH)
    if model_path is None:
        logger.warning("YOLO model not found at %s. Using fallback detection.", settings.YOLO_MODEL_PATH)
        return None

    if model_path.suffix.lower() != ".onnx":
        logger.warning("YOLO model path must point to an ONNX model: %s", model_path)
        return None

    _DETECTOR = YoloOnnxDetector(model_path=model_path)
    return _DETECTOR


def _resolve_model_path(model_path: str) -> Path | None:
    candidate = Path(model_path)
    if candidate.is_file():
        return candidate

    # Support running from repo root and from container /app.
    local_relative = Path(__file__).resolve().parents[1] / model_path
    if local_relative.is_file():
        return local_relative

    return None


class YoloOnnxDetector:
    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        configured_input_size = max(320, int(settings.YOLO_INPUT_SIZE))
        self.conf_threshold = float(settings.YOLO_CONFIDENCE_THRESHOLD)
        self.retry_conf_threshold = max(0.05, float(settings.YOLO_RETRY_CONF_THRESHOLD))
        self.iou_threshold = float(settings.YOLO_IOU_THRESHOLD)
        self.class_names = [name.strip() for name in settings.YOLO_CLASS_NAMES.split(",") if name.strip()]
        self.parent_labels = {
            label.strip().lower()
            for label in settings.YOLO_PARENT_CLASSES.split(",")
            if label.strip()
        }

        session_options = ort.SessionOptions()
        session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        session_options.enable_mem_pattern = True
        session_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        session_options.intra_op_num_threads = max(1, int(settings.YOLO_ORT_INTRA_THREADS))
        session_options.inter_op_num_threads = max(1, int(settings.YOLO_ORT_INTER_THREADS))

        self.session = ort.InferenceSession(str(model_path), sess_options=session_options, providers=["CPUExecutionProvider"])
        input_meta = self.session.get_inputs()[0]
        self.input_name = input_meta.name

        fixed_input_size = _get_fixed_model_input_size(input_meta.shape)
        if fixed_input_size is not None:
            if fixed_input_size != configured_input_size:
                logger.debug(
                    "yolo_input_size_overridden model=%s configured=%d fixed=%d",
                    self.model_path.name,
                    configured_input_size,
                    fixed_input_size,
                )
            self.input_size = fixed_input_size
            self.retry_input_sizes = [fixed_input_size]
        else:
            self.input_size = configured_input_size
            self.retry_input_sizes = _parse_retry_input_sizes(settings.YOLO_RETRY_INPUT_SIZES, self.input_size)

    def detect(self, image_bytes: bytes) -> list[DetectedRegion]:
        detections = self._detect_once(image_bytes, input_size=self.input_size, conf_threshold=self.conf_threshold)
        if detections and self._has_parent_detection(detections):
            return detections

        best = detections
        for retry_size in self.retry_input_sizes:
            if retry_size == self.input_size:
                continue
            retry_detections = self._detect_once(
                image_bytes,
                input_size=retry_size,
                conf_threshold=self.retry_conf_threshold,
            )
            if self._is_better_candidate(best, retry_detections):
                best = retry_detections
            if best and self._has_parent_detection(best):
                logger.debug(
                    "yolo_onnx_retry_success model=%s input_size=%d detections=%d",
                    self.model_path.name,
                    retry_size,
                    len(best),
                )
                break

        return best

    def _detect_once(self, image_bytes: bytes, *, input_size: int, conf_threshold: float) -> list[DetectedRegion]:
        prepared = _prepare_image(image_bytes, input_size)
        outputs = self.session.run(None, {self.input_name: prepared.tensor})
        boxes, scores, class_ids = _decode_predictions(outputs)
        if boxes.size == 0:
            return []

        keep = _nms(boxes, scores, self.iou_threshold)
        detections: list[DetectedRegion] = []
        min_area = float(prepared.width * prepared.height) * float(settings.YOLO_MIN_AREA_RATIO)
        for idx in keep:
            score = float(scores[idx])
            if score < conf_threshold:
                continue

            x1, y1, x2, y2 = _scale_back_box(
                box=boxes[idx],
                scale=prepared.scale,
                pad_x=prepared.pad_x,
                pad_y=prepared.pad_y,
                width=prepared.width,
                height=prepared.height,
            )
            area = max(0.0, (x2 - x1) * (y2 - y1))
            if area < min_area:
                continue

            label = _label_for_class(int(class_ids[idx]), self.class_names)
            detections.append(
                DetectedRegion(
                    label=label,
                    bbox=BBox(x_min=x1, y_min=y1, x_max=x2, y_max=y2),
                    score=round(score, 4),
                )
            )

        detections.sort(key=lambda item: (item.bbox.y_min, item.bbox.x_min))
        max_regions = int(settings.YOLO_MAX_REGIONS)
        if max_regions > 0:
            return detections[:max_regions]
        return detections

    def _has_parent_detection(self, detections: list[DetectedRegion]) -> bool:
        if not self.parent_labels:
            return True
        return any(item.label.strip().lower() in self.parent_labels for item in detections)

    def _is_better_candidate(self, current: list[DetectedRegion], candidate: list[DetectedRegion]) -> bool:
        if not candidate:
            return False
        if not current:
            return True

        current_has_parent = self._has_parent_detection(current)
        candidate_has_parent = self._has_parent_detection(candidate)
        if candidate_has_parent and not current_has_parent:
            return True
        if current_has_parent and not candidate_has_parent:
            return False

        current_score = max((item.score for item in current), default=0.0)
        candidate_score = max((item.score for item in candidate), default=0.0)
        if candidate_score > current_score + 0.03:
            return True

        return len(candidate) > len(current)


def _parse_retry_input_sizes(raw_value: str, base_input_size: int) -> list[int]:
    values: list[int] = []
    for token in raw_value.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            size = int(token)
        except ValueError:
            continue
        if size < 320:
            continue
        values.append(size)

    values.append(base_input_size)
    unique_sorted = sorted(set(values))
    return unique_sorted


def _prepare_image(image_bytes: bytes, input_size: int) -> _PreparedImage:
    with Image.open(BytesIO(image_bytes)) as image:
        rgb = ImageOps.exif_transpose(image).convert("RGB")
        width, height = rgb.size
        image_np = np.asarray(rgb)

    scale = min(input_size / width, input_size / height)
    new_w = int(round(width * scale))
    new_h = int(round(height * scale))

    resized = Image.fromarray(image_np).resize((new_w, new_h), Image.BILINEAR)
    canvas = Image.new("RGB", (input_size, input_size), (114, 114, 114))
    pad_x = (input_size - new_w) // 2
    pad_y = (input_size - new_h) // 2
    canvas.paste(resized, (pad_x, pad_y))

    tensor = np.asarray(canvas).astype(np.float32) / 255.0
    tensor = np.transpose(tensor, (2, 0, 1))
    tensor = np.expand_dims(tensor, axis=0)

    return _PreparedImage(
        tensor=tensor,
        scale=scale,
        pad_x=float(pad_x),
        pad_y=float(pad_y),
        width=width,
        height=height,
    )


def _decode_predictions(outputs: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if not outputs:
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32), np.empty((0,), dtype=np.int32)

    raw = np.asarray(outputs[0])
    if raw.ndim == 3:
        raw = raw[0]
    if raw.ndim != 2:
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32), np.empty((0,), dtype=np.int32)

    # Layout variants:
    # - [N, 6] -> x1,y1,x2,y2,score,class
    # - [attrs, N] or [N, attrs] -> YOLO style xywh + class/objectness vectors
    if raw.shape[1] <= 10 and raw.shape[1] >= 6:
        boxes = raw[:, :4].astype(np.float32)
        scores = raw[:, 4].astype(np.float32)
        class_ids = raw[:, 5].astype(np.int32)
        return boxes, scores, class_ids

    predictions = raw
    if raw.shape[0] <= 256 and raw.shape[1] > raw.shape[0]:
        predictions = raw.T
    if predictions.shape[1] < 5:
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32), np.empty((0,), dtype=np.int32)

    xywh = predictions[:, :4].astype(np.float32)
    score_slice = predictions[:, 4:].astype(np.float32)

    if score_slice.shape[1] == 1:
        class_ids = np.zeros((score_slice.shape[0],), dtype=np.int32)
        scores = score_slice[:, 0]
    else:
        # Try both no-objectness and objectness-first interpretations and pick stronger confidence.
        no_obj_cls_ids = np.argmax(score_slice, axis=1)
        no_obj_scores = score_slice[np.arange(score_slice.shape[0]), no_obj_cls_ids]

        obj = score_slice[:, 0]
        cls_part = score_slice[:, 1:]
        if cls_part.shape[1] > 0:
            obj_cls_ids = np.argmax(cls_part, axis=1)
            obj_scores = obj * cls_part[np.arange(cls_part.shape[0]), obj_cls_ids]
            use_obj = float(np.mean(obj_scores)) > float(np.mean(no_obj_scores)) * 0.95
            class_ids = obj_cls_ids if use_obj else no_obj_cls_ids
            scores = obj_scores if use_obj else no_obj_scores
        else:
            class_ids = np.zeros((score_slice.shape[0],), dtype=np.int32)
            scores = obj

    boxes = _xywh_to_xyxy(xywh)
    return boxes, scores.astype(np.float32), class_ids.astype(np.int32)


def _xywh_to_xyxy(xywh: np.ndarray) -> np.ndarray:
    xyxy = np.empty_like(xywh, dtype=np.float32)
    xyxy[:, 0] = xywh[:, 0] - xywh[:, 2] / 2
    xyxy[:, 1] = xywh[:, 1] - xywh[:, 3] / 2
    xyxy[:, 2] = xywh[:, 0] + xywh[:, 2] / 2
    xyxy[:, 3] = xywh[:, 1] + xywh[:, 3] / 2
    return xyxy


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> list[int]:
    if boxes.size == 0:
        return []

    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]

    areas = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
    order = scores.argsort()[::-1]
    keep: list[int] = []

    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break

        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        intersection = w * h
        union = areas[i] + areas[order[1:]] - intersection + 1e-6
        iou = intersection / union

        remaining = np.where(iou <= iou_threshold)[0]
        order = order[remaining + 1]

    return keep


def _scale_back_box(
    *,
    box: np.ndarray,
    scale: float,
    pad_x: float,
    pad_y: float,
    width: int,
    height: int,
) -> tuple[float, float, float, float]:
    x1 = (float(box[0]) - pad_x) / scale
    y1 = (float(box[1]) - pad_y) / scale
    x2 = (float(box[2]) - pad_x) / scale
    y2 = (float(box[3]) - pad_y) / scale

    x1 = max(0.0, min(float(width), x1))
    y1 = max(0.0, min(float(height), y1))
    x2 = max(0.0, min(float(width), x2))
    y2 = max(0.0, min(float(height), y2))
    return x1, y1, x2, y2


def _label_for_class(class_id: int, class_names: list[str]) -> str:
    if not class_names:
        return "prescription" if class_id == 0 else f"region_{class_id}"
    if 0 <= class_id < len(class_names):
        return class_names[class_id]
    return f"class_{class_id}"


def _get_fixed_model_input_size(shape: list[object] | tuple[object, ...]) -> int | None:
    if len(shape) < 4:
        return None

    height = shape[2]
    width = shape[3]
    if not isinstance(height, int) or not isinstance(width, int):
        return None
    if height <= 0 or width <= 0:
        return None
    if height != width:
        return None
    return int(height)
