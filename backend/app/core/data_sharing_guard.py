"""
Data Sharing Guard — Privacy enforcement layer.

Central module that enforces patient data-sharing preferences whenever a doctor
or Chorui AI accesses patient data.  Every boolean category in
PatientDataSharingPreference maps to a set of response fields; fields that
belong to a category the patient has NOT shared are stripped (replaced with
None / empty list) before any data leaves the backend.

Design principles
─────────────────
* Private by default — if no preference record exists, *nothing* is shared.
* Fail-closed — any DB error results in an empty (fully-restricted) result.
* Single source of truth — this module is the ONLY place the mapping between
  sharing categories and response fields lives.  Routes never hard-code it.
"""

from __future__ import annotations

import logging
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.patient_data_sharing import (
    SHARING_CATEGORY_FIELDS,
    PatientDataSharingPreference,
)

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────
# Redaction sentinel — used so the frontend can distinguish "empty"
# from "restricted by patient".
# ────────────────────────────────────────────────────────────────────
RESTRICTED_LABEL = "[Restricted by patient]"
VIEW_SHARING_CATEGORY_FIELDS = [
    field_name for field_name in SHARING_CATEGORY_FIELDS if field_name != "can_use_ai"
]


@dataclass(frozen=True, slots=True)
class SharingPermissions:
    """Immutable snapshot of what a specific doctor is allowed to see."""

    can_view_profile: bool = False
    can_view_conditions: bool = False
    can_view_medications: bool = False
    can_view_allergies: bool = False
    can_view_medical_history: bool = False
    can_view_family_history: bool = False
    can_view_lifestyle: bool = False
    can_view_vaccinations: bool = False
    can_view_reports: bool = False
    can_view_health_metrics: bool = False
    can_view_prescriptions: bool = False
    can_use_ai: bool = False

    def shared_categories(self) -> list[str]:
        return [f for f in VIEW_SHARING_CATEGORY_FIELDS if getattr(self, f, False)]

    def restricted_categories(self) -> list[str]:
        return [f for f in VIEW_SHARING_CATEGORY_FIELDS if not getattr(self, f, False)]

    @property
    def nothing_shared(self) -> bool:
        return not any(getattr(self, f, False) for f in VIEW_SHARING_CATEGORY_FIELDS)

    @property
    def everything_shared(self) -> bool:
        return all(getattr(self, f, False) for f in VIEW_SHARING_CATEGORY_FIELDS)


# Fully-restricted default (used when no DB record exists or on error)
FULLY_RESTRICTED = SharingPermissions()


# ────────────────────────────────────────────────────────────────────
# DB lookup
# ────────────────────────────────────────────────────────────────────

async def get_sharing_permissions(
    db: AsyncSession,
    *,
    patient_id: str,
    doctor_id: str,
) -> SharingPermissions:
    """
    Fetch the sharing permissions a patient has granted to a specific doctor.
    Returns FULLY_RESTRICTED if no record exists (private by default).
    """
    try:
        result = await db.execute(
            select(PatientDataSharingPreference).where(
                and_(
                    PatientDataSharingPreference.patient_id == patient_id,
                    PatientDataSharingPreference.doctor_id == doctor_id,
                )
            )
        )
        pref = result.scalar_one_or_none()

        if pref is None:
            return FULLY_RESTRICTED

        return SharingPermissions(
            can_view_profile=pref.can_view_profile,
            can_view_conditions=pref.can_view_conditions,
            can_view_medications=pref.can_view_medications,
            can_view_allergies=pref.can_view_allergies,
            can_view_medical_history=pref.can_view_medical_history,
            can_view_family_history=pref.can_view_family_history,
            can_view_lifestyle=pref.can_view_lifestyle,
            can_view_vaccinations=pref.can_view_vaccinations,
            can_view_reports=pref.can_view_reports,
            can_view_health_metrics=pref.can_view_health_metrics,
            can_view_prescriptions=pref.can_view_prescriptions,
            can_use_ai=getattr(pref, "can_use_ai", False),
        )
    except Exception:
        logger.exception("Failed to fetch sharing preferences for patient=%s doctor=%s", patient_id, doctor_id)
        return FULLY_RESTRICTED


# ────────────────────────────────────────────────────────────────────
# Field-to-category mapping for the full doctor response
# (returned by GET /patient-access/patient/{id})
# ────────────────────────────────────────────────────────────────────

# Keys that are ALWAYS returned regardless of sharing (non-sensitive meta)
_ALWAYS_ALLOWED_KEYS = frozenset({
    "id",
    "patient_ref",
    "access_timestamp",
    "appointment_history",          # doctor's own appointments, not medical data
    "data_sharing_restrictions",    # meta field we inject
})

# Mapping: sharing category → set of response keys controlled by that category
_CATEGORY_TO_RESPONSE_KEYS: dict[str, frozenset[str]] = {
    "can_view_profile": frozenset({
        "first_name", "last_name", "email", "phone",
        "age", "date_of_birth", "gender", "marital_status", "profile_photo_url",
        "address", "city", "district", "postal_code", "country", "occupation",
        "blood_group", "height", "weight",
    }),
    "can_view_conditions": frozenset({
        "chronic_conditions",
        "has_diabetes", "has_hypertension", "has_heart_disease", "has_asthma",
        "has_cancer", "has_thyroid", "has_kidney_disease", "has_liver_disease",
        "has_arthritis", "has_stroke", "has_epilepsy", "has_mental_health",
        "other_conditions",
    }),
    "can_view_medications": frozenset({
        "taking_medications", "medications",
    }),
    "can_view_allergies": frozenset({
        "drug_allergies", "food_allergies", "environmental_allergies",
    }),
    "can_view_medical_history": frozenset({
        "surgeries", "hospitalizations", "ongoing_treatments",
        "medical_tests", "last_checkup_date",
    }),
    "can_view_family_history": frozenset({
        "family_has_diabetes", "family_has_heart_disease", "family_has_cancer",
        "family_has_hypertension", "family_has_stroke", "family_has_mental_health",
        "family_has_kidney_disease", "family_has_thyroid", "family_has_asthma",
        "family_has_blood_disorders", "family_history_notes",
    }),
    "can_view_lifestyle": frozenset({
        "smoking_status", "alcohol_consumption", "activity_level",
        "sleep_hours", "stress_level", "diet_type", "mental_health_concerns",
    }),
    "can_view_vaccinations": frozenset({
        "vaccinations",
    }),
    "can_view_reports": frozenset(set()),  # reports are a separate resource
    "can_view_health_metrics": frozenset({
        "height", "weight",
    }),
    "can_view_prescriptions": frozenset({
        "consultation_history",
        "prescription_history",
    }),
}

# Emergency contact is always visible (safety-critical)
_EMERGENCY_KEYS = frozenset({
    "emergency_contact_name", "emergency_contact_phone",
    "emergency_contact_relationship",
})


def _null_for_type(value: Any) -> Any:
    """Return the appropriate 'empty' sentinel for a value's type."""
    if isinstance(value, list):
        return []
    if isinstance(value, dict):
        return {}
    if isinstance(value, bool):
        return None
    return None


# ────────────────────────────────────────────────────────────────────
# Filter: full doctor response (patient_access.py)
# ────────────────────────────────────────────────────────────────────

def filter_doctor_patient_response(
    response: dict[str, Any],
    perms: SharingPermissions,
) -> dict[str, Any]:
    """
    Strip fields the patient has not shared from the doctor-facing patient
    response dict.  Adds a 'data_sharing_restrictions' metadata object so the
    frontend can show which categories are restricted.
    """
    if perms.everything_shared:
        response["data_sharing_restrictions"] = {
            "any_restricted": False,
            "restricted_categories": [],
        }
        return response

    filtered = {}
    restricted_keys: set[str] = set()

    # Build the set of keys this doctor is allowed to see
    allowed_keys: set[str] = set(_ALWAYS_ALLOWED_KEYS) | set(_EMERGENCY_KEYS)
    for category_field in VIEW_SHARING_CATEGORY_FIELDS:
        if getattr(perms, category_field, False):
            allowed_keys |= _CATEGORY_TO_RESPONSE_KEYS.get(category_field, set())

    for key, value in response.items():
        if key in allowed_keys or key in _ALWAYS_ALLOWED_KEYS or key in _EMERGENCY_KEYS:
            filtered[key] = value
        else:
            filtered[key] = _null_for_type(value)
            restricted_keys.add(key)

    # Inject restriction metadata
    filtered["data_sharing_restrictions"] = {
        "any_restricted": bool(restricted_keys),
        "restricted_categories": perms.restricted_categories(),
        "message": (
            "Some patient data is restricted. The patient has chosen not to "
            "share certain health information categories with you."
            if restricted_keys
            else None
        ),
    }

    return filtered


# ────────────────────────────────────────────────────────────────────
# Filter: AI raw summary (used by _build_raw_summary in ai_consultation)
# ────────────────────────────────────────────────────────────────────

def filter_raw_summary(
    raw_summary: dict[str, Any],
    perms: SharingPermissions,
) -> dict[str, Any]:
    """
    Filter the raw summary dict that feeds into Chorui AI.
    Strips conditions, medications, allergies, family history, surgeries,
    hospitalizations etc. based on sharing permissions.
    """
    if perms.everything_shared:
        return raw_summary

    filtered = deepcopy(raw_summary)

    # patient_ref is always included
    if not perms.can_view_conditions:
        filtered["conditions"] = []
        filtered["risk_flags"] = []  # derived from conditions

    if not perms.can_view_medications:
        filtered["medications"] = []

    if not perms.can_view_allergies:
        filtered["allergies"] = []
        # Also strip drug_allergies from history
        if isinstance(filtered.get("history"), dict):
            filtered["history"]["drug_allergies"] = []

    if not perms.can_view_family_history:
        filtered["family_history"] = []
        if isinstance(filtered.get("history"), dict):
            filtered["history"]["family_history_notes"] = ""

    if not perms.can_view_medical_history:
        if isinstance(filtered.get("history"), dict):
            filtered["history"]["surgeries"] = []
            filtered["history"]["hospitalizations"] = []

    return filtered


# ────────────────────────────────────────────────────────────────────
# Filter: AI extended context
# (used by _build_patient_extended_context in ai_consultation)
# ────────────────────────────────────────────────────────────────────

def filter_extended_context(
    context: dict[str, Any],
    perms: SharingPermissions,
) -> dict[str, Any]:
    """
    Filter the extended patient context dict used by Chorui AI.
    Strips demographics, consultations, prescriptions, lifestyle etc.
    """
    if perms.everything_shared:
        return context

    filtered = deepcopy(context)

    # Demographics: controlled by can_view_profile + can_view_health_metrics
    if isinstance(filtered.get("demographics"), dict):
        if not perms.can_view_profile:
            filtered["demographics"]["display_name"] = RESTRICTED_LABEL
            filtered["demographics"]["age"] = None
            filtered["demographics"]["gender"] = None
            filtered["demographics"]["blood_group"] = None
        if not perms.can_view_health_metrics:
            filtered["demographics"]["height_cm"] = None
            filtered["demographics"]["weight_kg"] = None

    # Recent consultations: controlled by can_view_medical_history
    if not perms.can_view_medical_history:
        filtered["recent_consultations"] = []

    # Recent prescriptions: controlled by can_view_prescriptions
    if not perms.can_view_prescriptions:
        filtered["recent_prescriptions"] = []

    # Lifestyle: controlled by can_view_lifestyle
    if not perms.can_view_lifestyle:
        filtered["lifestyle"] = {}

    # Appointment history is always visible (it's the doctor's own appointments)

    return filtered


# ────────────────────────────────────────────────────────────────────
# Helper: build a human-readable restriction notice for AI prompts
# ────────────────────────────────────────────────────────────────────

_CATEGORY_LABELS: dict[str, str] = {
    "can_view_profile": "Profile & Identity",
    "can_view_conditions": "Medical Conditions",
    "can_view_medications": "Medications",
    "can_view_allergies": "Allergies",
    "can_view_medical_history": "Medical History",
    "can_view_family_history": "Family History",
    "can_view_lifestyle": "Lifestyle & Habits",
    "can_view_vaccinations": "Vaccinations",
    "can_view_reports": "Lab Reports",
    "can_view_health_metrics": "Health Metrics",
    "can_view_prescriptions": "Prescriptions",
}


def build_ai_restriction_notice(perms: SharingPermissions) -> str | None:
    """
    Build a notice string that is prepended to the AI system prompt so
    Chorui AI knows which categories are restricted and must never
    fabricate or infer data for them.

    Returns None if everything is shared (no restriction).
    """
    if perms.everything_shared:
        return None

    restricted = perms.restricted_categories()
    labels = [_CATEGORY_LABELS.get(cat, cat) for cat in restricted]

    return (
        "PRIVACY RESTRICTION: The patient has NOT shared the following data "
        "categories with this doctor. You MUST NOT reveal, infer, guess, or "
        "fabricate any information in these categories. If asked about them, "
        "state that the patient has restricted access to that information.\n"
        f"Restricted categories: {', '.join(labels)}"
    )
