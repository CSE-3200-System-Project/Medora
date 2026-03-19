from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "medora-ai-ocr-service"
    APP_ENV: str = "development"

    MODEL_TYPE: Literal["read", "custom", "llm"] = "read"

    AZURE_OCR_ENDPOINT: str | None = None
    AZURE_OCR_KEY: str | None = None
    AZURE_OCR_MODEL_ID: str = "prebuilt-read"
    AZURE_OCR_TIMEOUT_SECONDS: float = 45.0

    YOLO_PADDING_PX: int = 12
    LINE_MERGE_Y_PX: int = 26
    FUZZY_MATCH_THRESHOLD: int = 85
    YOLO_MODEL_PATH: str = "models/Yolo26s/Yolo26s-prescription-5.onnx"
    YOLO_INPUT_SIZE: int = 640
    YOLO_CONFIDENCE_THRESHOLD: float = 0.25
    YOLO_RETRY_CONF_THRESHOLD: float = 0.18
    YOLO_RETRY_INPUT_SIZES: str = "832,960"
    YOLO_IOU_THRESHOLD: float = 0.45
    YOLO_ORT_INTRA_THREADS: int = 2
    YOLO_ORT_INTER_THREADS: int = 1
    YOLO_CLASS_NAMES: str = "Medication,Lines,Frequency,Quantity"
    YOLO_MAX_REGIONS: int = 0
    YOLO_MIN_AREA_RATIO: float = 0.01
    YOLO_PARENT_CLASSES: str = "Medication"
    YOLO_LINE_CLASSES: str = "Lines,Line"
    YOLO_FREQUENCY_CLASSES: str = "Frequency"
    YOLO_QUANTITY_CLASSES: str = "Quantity"
    YOLO_DOSAGE_CLASSES: str = "Dosage,Strength"
    GROUP_BY_YOLO_FOR_PARSING: bool = True
    DISABLE_MEDICINE_MATCHING: bool = True
    LOG_LEVEL: str = "INFO"
    OCR_LOG_FULL_TEXT: bool = True
    OCR_LOG_MAX_CHARS: int = 8000
    OCR_LOG_YOLO_FINDINGS: bool = True
    OCR_USE_FULL_IMAGE_FALLBACK: bool = False
    OCR_MAX_UPLOAD_BYTES: int = 15 * 1024 * 1024
    OCR_MAX_IMAGE_BYTES: int = 4 * 1024 * 1024
    OCR_MAX_IMAGE_DIMENSION: int = 2600
    OCR_JPEG_QUALITY: int = 88

    SUPABASE_URL: str | None = None
    SUPABASE_KEY: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    MEDICINE_DB_TABLE: str = "medicine_search_index"
    MEDICINE_DB_COLUMN: str = "term"
    MEDICINE_DB_MAX_ROWS: int = 5000
    MEDICINE_DB_CACHE_SECONDS: int = 900

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
