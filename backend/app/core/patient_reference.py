from __future__ import annotations

import base64
import hashlib
import hmac
import re
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.appointment import Appointment
from app.db.models.consultation import Consultation

UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    flags=re.IGNORECASE,
)
PATIENT_REF_PATTERN = re.compile(r"^(?:PT[-_]?)?([A-Z2-7]{10})$", flags=re.IGNORECASE)
PATIENT_REF_TOKEN_LENGTH = 10


def is_uuid_like(value: str | None) -> bool:
    if not value:
        return False
    return UUID_PATTERN.match(value.strip()) is not None


def normalize_patient_ref(value: str | None) -> str | None:
    if not value:
        return None
    match = PATIENT_REF_PATTERN.match(value.strip())
    if not match:
        return None
    return match.group(1).upper()


def _resolve_patient_ref_secret() -> str:
    candidate = (
        settings.PATIENT_REF_HASH_SECRET
        or settings.AI_ID_HASH_SECRET
        or settings.SUPABASE_SERVICE_ROLE_KEY
        or settings.SUPABASE_KEY
        or "medora-patient-ref-local-dev"
    )
    return str(candidate).strip()


def patient_ref_from_uuid(patient_id: str) -> str:
    raw_value = (patient_id or "").strip().lower()
    if not raw_value:
        return "PT-UNKNOWN000"

    secret = _resolve_patient_ref_secret()
    digest = hmac.new(secret.encode("utf-8"), raw_value.encode("utf-8"), hashlib.sha256).digest()
    token = base64.b32encode(digest).decode("ascii").rstrip("=")[:PATIENT_REF_TOKEN_LENGTH].upper()
    return f"PT-{token}"


def match_patient_ref_token(patient_id: str, ref: str) -> bool:
    normalized = normalize_patient_ref(ref)
    if not normalized:
        return False
    return patient_ref_from_uuid(patient_id).split("-", 1)[1] == normalized


async def list_doctor_patient_ids(db: AsyncSession, doctor_id: str) -> list[str]:
    appointment_result = await db.execute(
        select(Appointment.patient_id)
        .where(Appointment.doctor_id == doctor_id)
        .distinct()
    )
    consultation_result = await db.execute(
        select(Consultation.patient_id)
        .where(Consultation.doctor_id == doctor_id)
        .distinct()
    )

    candidate_ids: set[str] = set()
    for row in appointment_result.fetchall():
        if row and row[0]:
            candidate_ids.add(str(row[0]))

    for row in consultation_result.fetchall():
        if row and row[0]:
            candidate_ids.add(str(row[0]))

    return list(candidate_ids)


async def resolve_doctor_patient_identifier(
    db: AsyncSession,
    *,
    doctor_id: str,
    patient_identifier: str,
    candidate_patient_ids: Iterable[str] | None = None,
) -> str | None:
    normalized = str(patient_identifier or "").strip()
    if not normalized:
        return None

    candidate_ids = list(candidate_patient_ids or [])
    if not candidate_ids:
        candidate_ids = await list_doctor_patient_ids(db, doctor_id)
    if not candidate_ids:
        return None

    if is_uuid_like(normalized):
        lowered = normalized.lower()
        for patient_id in candidate_ids:
            if str(patient_id).strip().lower() == lowered:
                return str(patient_id)
        return None

    ref_token = normalize_patient_ref(normalized)
    if not ref_token:
        return None

    matches = [patient_id for patient_id in candidate_ids if match_patient_ref_token(patient_id, ref_token)]
    if len(matches) == 1:
        return matches[0]
    return None
