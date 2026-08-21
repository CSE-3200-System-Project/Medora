import json
import secrets
import math
import asyncio
import time
import logging
import re
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from typing import Iterable, List, Optional, Tuple
from datetime import date
from types import SimpleNamespace

from app.core.ai_privacy import redact_pii_text
from app.core.config import settings
from app.core.security import verify_jwt
from app.core.dependencies import get_db
from app.core.vapi_auth import verify_vapi_tool_secret
from app.routes.auth import get_current_user_token
from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_location import DoctorLocation
from app.db.models.profile import Profile
from app.db.models.speciality import Speciality
from app.db.models.patient import PatientProfile
from app.db.models.appointment import Appointment
from app.schemas.ai_search import (
    AIDoctorSearchRequest, 
    AIDoctorSearchResponse, 
    AIDoctorResult,
    PatientContextFactor,
    UserLocation,
)

from app.services.specialty_matching import (
    match_specialties_from_llm_response,
    get_fallback_specialties,
    normalize_text
)
from app.services.medical_knowledge import (
    get_related_specialties,
    get_fallback_chain,
    UNIVERSAL_FALLBACKS
)
from app.schemas.processing_consent import ProcessingPurpose
from app.services.processing_consent import require_processing_consent
from app.services.ai_orchestrator import AIOrchestratorError, ai_orchestrator
from app.services.risk_classifier import classify_risk, is_emergency_text
from app.services.helpline_registry import resolve_helplines
from app.core.arohon import resolve_tier
from app.db.models.enums import AutonomyTier, RiskClass

router = APIRouter()
logger = logging.getLogger(__name__)
SPECIALTY_CACHE_TTL_SECONDS = max(60, settings.PERF_API_CACHE_TTL)
_all_specialties_cache: dict[str, object] = {"value": None, "expires_at": 0.0}
_available_specialties_cache: dict[str, object] = {"value": None, "expires_at": 0.0}
VAPI_DOCTOR_SEARCH_TOOL_NAMES = {"search_doctors_ai", "find_doctor", "ai_doctor_search"}
# Hard ceiling on how long the doctor-search pipeline can take before Vapi
# gets a spoken apology instead of a silent hang. Stays under Vapi's own
# tool-call deadline with headroom.
VAPI_DOCTOR_SEARCH_TIMEOUT_SECONDS = 12.0


def detect_emergency_red_flags(text: str) -> bool:
    """Deployed red-flag screen. Now a thin view over the risk classifier.

    The patterns moved to `app/services/risk_classifier.py` so Arohon can read the risk
    *class*, not just a boolean, and give self-harm a different ceiling from cardiac.
    The answer this returns is unchanged; parity over all 30 navigation fixtures is
    asserted in `tests/unit/backend/test_arohon.py`.
    """
    return is_emergency_text(text)


EMERGENCY_SAFETY_MESSAGE = (
    "This navigation search cannot assess an emergency. Call Bangladesh emergency service 999 "
    "or go to the nearest emergency department now."
)

# The self-harm path deliberately reads differently. Telling someone who has disclosed
# suicidal ideation to go to an emergency department is both the wrong first bridge and
# coercive in tone; the specification caps this path at L3 precisely so the person keeps
# the choice. Clinician-authored supportive copy and time-aware human options go on the
# screen, no method content appears anywhere, and nothing is dispatched on their behalf.
CRISIS_SUPPORT_MESSAGE = (
    "This search cannot help with what you are going through, but a person can. "
    "You choose whether to reach out, and nothing is sent on your behalf."
)

#: How an L3 surface should be presented. Same tier, different interface, because the
#: ceiling asymmetry is only real if the screen the user sees is also different.
ESCALATION_TAKEOVER = "emergency_takeover"
ESCALATION_CRISIS_SUPPORT = "crisis_support"


def classify_navigation_outcome(
    *,
    user_text: str,
    intent: dict | None,
    available_specialties: list[str],
    specialties_with_doctors: Iterable[str],
) -> dict:
    """Decide the navigation outcome for one utterance, with no I/O.

    This is the whole decision surface of ``ai_doctor_search``: the deterministic
    emergency rules, the provider-unavailable fallback, and the three-tier specialty
    match. It is pure so the safety benchmark can score the real rules instead of a
    reimplementation of them. ``intent=None`` means the provider failed or returned
    nothing usable.

    This never assigns urgency, severity, or a triage level, and manual browsing
    always stays available.
    """
    assessment = classify_risk(user_text)
    if assessment.is_emergency:
        # Same tier for both, different screen. Self-harm surfaces support and keeps the
        # choice with the person; a physical red flag surfaces the takeover. `risk_class`
        # is what the frontend branches on, so the asymmetry is visible to the user and
        # not just recorded in a log.
        is_crisis = assessment.risk_class is RiskClass.SELF_HARM
        decision = resolve_tier(AutonomyTier.L3_ESCALATE, assessment.risk_class)
        return {
            "outcome": "emergency",
            "requires_immediate_care": True,
            "uncertain": True,
            "manual_browse_available": True,
            "ambiguity": "high",
            "safety_message": CRISIS_SUPPORT_MESSAGE if is_crisis else EMERGENCY_SAFETY_MESSAGE,
            "medical_intent": {"navigation_bypassed": "emergency_red_flag"},
            "risk_class": assessment.risk_class.value,
            "matched_risk_classes": [item.value for item in assessment.matched_classes],
            "autonomy_tier": decision.granted_tier.value,
            "escalation_mode": ESCALATION_CRISIS_SUPPORT if is_crisis else ESCALATION_TAKEOVER,
            # L4 would mean notifying someone without the person in the loop. It is
            # unreachable for self-harm by construction, and for the physical classes it
            # needs a prior, still-valid grant that this route does not resolve.
            "autonomous_notification": False,
            "candidate_source": "none",
            "matched_specialties": [],
            "primary_specialties": [],
            "secondary_specialties": [],
            "extracted_specialties": [],
            "fallback_reason": None,
        }

    if intent is None:
        return {
            "outcome": "provider_unavailable",
            "requires_immediate_care": False,
            "uncertain": True,
            "manual_browse_available": True,
            "ambiguity": "high",
            "safety_message": None,
            "risk_class": assessment.risk_class.value,
            "matched_risk_classes": [],
            "autonomy_tier": AutonomyTier.L1_INFORM.value,
            "escalation_mode": None,
            "autonomous_notification": False,
            "medical_intent": {"error": "llm_unavailable", "fallback": "manual_search"},
            "candidate_source": "none",
            "matched_specialties": [],
            "primary_specialties": [],
            "secondary_specialties": [],
            "extracted_specialties": [],
            "fallback_reason": None,
        }

    specialties_with_doctors = list(specialties_with_doctors)
    symptoms = [item.get("name", "") for item in intent.get("symptoms", [])]

    # Tier 1: provider-proposed specialties, filtered by confidence and catalog match.
    matched_specialties = match_specialties_from_llm_response(
        intent.get("specialties", []),
        available_specialties,
        min_confidence=0.3,
    )
    primary_specialties = [name for name, _confidence in matched_specialties]
    candidate_source = "matched" if primary_specialties else "none"

    # Tier 2: symptom-derived related specialties.
    if not primary_specialties:
        related = get_related_specialties(symptoms, max_results=3)
        primary_specialties = [item for item in related if item in specialties_with_doctors]
        if primary_specialties:
            candidate_source = "symptom_fallback"

    # Tier 3: fallback chain so the patient always gets somewhere to go.
    final_specialties, secondary_specialties = get_fallback_chain(
        primary_specialties=primary_specialties,
        available_specialties=specialties_with_doctors,
        min_count=2,
    )
    extracted_specialties = final_specialties + secondary_specialties
    if candidate_source == "none" and extracted_specialties:
        candidate_source = "universal_fallback"

    fallback_reason = None
    if secondary_specialties:
        if "General Physician" in secondary_specialties:
            fallback_reason = "General Physicians included for comprehensive consultation"
        elif "Internal Medicine" in secondary_specialties:
            fallback_reason = "Internal Medicine added for diagnostic evaluation"
        else:
            fallback_reason = "Additional specialties included to ensure availability"

    ambiguity = intent.get("ambiguity", "low")
    public_intent = {
        key: value
        for key, value in intent.items()
        if key not in {"severity", "urgency", "triage", "triage_priority"}
    }
    return {
        "outcome": "navigation",
        "requires_immediate_care": False,
        "uncertain": ambiguity != "low",
        "manual_browse_available": True,
        "ambiguity": ambiguity,
        "safety_message": None,
        "risk_class": assessment.risk_class.value,
        "matched_risk_classes": [],
        # Navigation reads the catalog and names candidates. It writes nothing and
        # decides nothing, so L1 is the whole of its authority.
        "autonomy_tier": AutonomyTier.L1_INFORM.value,
        "escalation_mode": None,
        "autonomous_notification": False,
        "medical_intent": {
            **public_intent,
            "matched_specialties": matched_specialties,
            "primary_specialties": final_specialties,
            "secondary_specialties": secondary_specialties,
            "extracted_specialty_names": extracted_specialties,
            "total_specialties_matched": len(extracted_specialties),
            "fallback_reason": fallback_reason,
        },
        "candidate_source": candidate_source,
        "matched_specialties": matched_specialties,
        "primary_specialties": final_specialties,
        "secondary_specialties": secondary_specialties,
        "extracted_specialties": extracted_specialties,
        "fallback_reason": fallback_reason,
    }


def _arohon_response_fields(outcome: dict, *, correlation_id: str | None = None) -> dict:
    """Copy the Arohon decision out of a navigation outcome onto the wire.

    Helplines are resolved here rather than inside ``classify_navigation_outcome``
    because the registry reads the clock, and that function is deliberately pure so the
    safety benchmark can score the real rules without pinning a time.
    """
    risk_class = outcome.get("risk_class")
    escalating = bool(risk_class and outcome.get("escalation_mode"))
    helplines = resolve_helplines(RiskClass(risk_class)) if escalating else []
    if escalating and correlation_id is None:
        # A random token minted per surface. The client echoes it back when the takeover
        # resolves, which is what ties a dismissal to the escalation that produced it —
        # without the utterance, the patient ID, or anything else re-identifying being
        # stored alongside the outcome.
        correlation_id = f"esc_{secrets.token_hex(10)}"
    return {
        "risk_class": risk_class,
        "autonomy_tier": outcome.get("autonomy_tier"),
        "escalation_mode": outcome.get("escalation_mode"),
        "autonomous_notification": bool(outcome.get("autonomous_notification", False)),
        "helplines": helplines,
        "correlation_id": correlation_id,
    }


def _normalize_secret(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().strip("\"'")
    return normalized or None


def _safe_vapi_text(value: object, *, max_length: int = 5000) -> str:
    if value is None:
        return ""
    return str(value).strip()[:max_length]


def _safe_vapi_dict(value: object) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}


def _extract_vapi_tool_calls(payload: dict) -> list[dict]:
    message = payload.get("message")
    if not isinstance(message, dict):
        return []

    tool_calls: list[dict] = []

    raw_calls = message.get("toolCallList")
    if isinstance(raw_calls, list):
        for item in raw_calls:
            if not isinstance(item, dict):
                continue
            tool_calls.append(
                {
                    "id": _safe_vapi_text(item.get("id"), max_length=128),
                    "name": _safe_vapi_text(item.get("name"), max_length=128),
                    "arguments": _safe_vapi_dict(item.get("arguments")),
                }
            )

    wrapped_calls = message.get("toolWithToolCallList")
    if isinstance(wrapped_calls, list):
        for wrapped in wrapped_calls:
            if not isinstance(wrapped, dict):
                continue
            tool_call = wrapped.get("toolCall")
            if not isinstance(tool_call, dict):
                continue
            function_payload = tool_call.get("function")
            function_dict = function_payload if isinstance(function_payload, dict) else {}
            tool_calls.append(
                {
                    "id": _safe_vapi_text(tool_call.get("id"), max_length=128),
                    "name": _safe_vapi_text(
                        function_dict.get("name") or wrapped.get("name"),
                        max_length=128,
                    ),
                    "arguments": _safe_vapi_dict(function_dict.get("parameters")),
                }
            )

    return tool_calls


def _extract_vapi_metadata(payload: dict) -> dict:
    message = payload.get("message")
    if not isinstance(message, dict):
        return {}
    call = message.get("call")
    if not isinstance(call, dict):
        return {}
    metadata = call.get("metadata")
    if not isinstance(metadata, dict):
        return {}
    return metadata


def _extract_vapi_token(arguments: dict, metadata: dict, authorization_header: str | None) -> str:
    candidates = [
        arguments.get("session_token"),
        arguments.get("auth_token"),
        arguments.get("token"),
        metadata.get("session_token"),
        metadata.get("auth_token"),
        metadata.get("medora_session_token"),
        authorization_header,
    ]
    for candidate in candidates:
        token = _safe_vapi_text(candidate, max_length=8000)
        if not token:
            continue
        if token.lower().startswith("bearer "):
            token = token.split(" ", 1)[1].strip()
        if token:
            return token
    return ""


def _extract_vapi_user_location(arguments: dict, metadata: dict) -> UserLocation | None:
    user_location = arguments.get("user_location")
    if not isinstance(user_location, dict):
        user_location = metadata.get("user_location") if isinstance(metadata.get("user_location"), dict) else None

    latitude = None
    longitude = None
    if isinstance(user_location, dict):
        latitude = user_location.get("latitude")
        longitude = user_location.get("longitude")
    else:
        latitude = arguments.get("latitude") or metadata.get("latitude")
        longitude = arguments.get("longitude") or metadata.get("longitude")

    try:
        if latitude is None or longitude is None:
            return None
        return UserLocation(latitude=float(latitude), longitude=float(longitude))
    except Exception:
        return None


def _build_vapi_doctor_search_summary(response: AIDoctorSearchResponse) -> str:
    if not response.doctors:
        if (response.ambiguity or "").lower() == "high":
            return (
                "I need a bit more detail to find the right doctor. "
                "Please describe your main concern, how long it has been happening, and any accompanying symptoms."
            )
        return "I could not find matching doctors right now. Please try a different symptom description or location."

    top_doctors = response.doctors[:3]
    lines: list[str] = [f"I found {len(response.doctors)} matching doctors. Here are the top options."]

    for index, doctor in enumerate(top_doctors, start=1):
        name = f"Dr. {doctor.first_name} {doctor.last_name}".strip()
        specialty = doctor.specialization
        reason = _safe_vapi_text(doctor.reason, max_length=180)
        distance_text = f", {doctor.distance_km:.1f} kilometer away" if doctor.distance_km is not None else ""
        lines.append(f"{index}. {name}, {specialty}{distance_text}. {reason}")

    lines.append("You can now open doctor profiles and book the best fit.")
    return " ".join(lines)


async def get_optional_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    try:
        token = authorization.split(" ", 1)[1] if authorization.startswith("Bearer ") else authorization
        payload = await verify_jwt(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        return SimpleNamespace(id=user_id)
    except Exception:
        return None


async def get_patient_history_context(db: AsyncSession, user_id: str) -> Tuple[str, List[PatientContextFactor]]:
    """
    Fetch patient medical history and return both:
    1. Formatted context string for LLM
    2. Structured factors for frontend display
    """
    result = await db.execute(select(PatientProfile).where(PatientProfile.profile_id == user_id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        return "", []

    parts = []
    context_factors = []
    
    # Basic Info
    agestr = ""
    if patient.date_of_birth:
        age = (date.today() - patient.date_of_birth).days // 365
        agestr = f"{age} years old"
    
    gender = patient.gender or "Unknown"
    parts.append(f"PATIENT CONTEXT ({gender}, {agestr}):")

    # Conditions
    chronic = []
    if patient.has_diabetes:
        chronic.append("Diabetes")
        context_factors.append(PatientContextFactor(
            category="condition",
            value="Diabetes",
            influence="Requires endocrinologist or experienced general practitioner"
        ))
    
    if patient.has_hypertension:
        chronic.append("Hypertension")
        context_factors.append(PatientContextFactor(
            category="condition",
            value="Hypertension",
            influence="May require cardiologist for comprehensive management"
        ))
    
    if patient.has_heart_disease:
        chronic.append("Heart Disease")
        context_factors.append(PatientContextFactor(
            category="condition",
            value="Heart Disease",
            influence="Specialist cardiologist recommended for safety"
        ))
    
    if patient.has_asthma:
        chronic.append("Asthma")
        context_factors.append(PatientContextFactor(
            category="condition",
            value="Asthma",
            influence="Respiratory specialist or pulmonologist may be beneficial"
        ))
    
    if patient.has_kidney_disease:
        chronic.append("Kidney Disease")
        context_factors.append(PatientContextFactor(
            category="condition",
            value="Kidney Disease",
            influence="Nephrologist expertise recommended"
        ))

    if patient.conditions:
        conds = [c.get('name') for c in patient.conditions if isinstance(c, dict) and c.get('name')]
        chronic.extend(conds)
        for cond in conds:
            context_factors.append(PatientContextFactor(
                category="condition",
                value=cond,
                influence=f"Consider specialists experienced with {cond}"
            ))
    
    if chronic:
        parts.append(f"- Known Conditions: {', '.join(set(chronic))}")

    # Medications
    if patient.medications:
        meds = [m.get('name') for m in patient.medications if isinstance(m, dict) and m.get('name')]
        if meds:
            parts.append(f"- Current Medications: {', '.join(meds)}")
            for med in meds:
                context_factors.append(PatientContextFactor(
                    category="medication",
                    value=med,
                    influence="Doctor should be aware of current medications for interaction checks"
                ))

    # Allergies
    if patient.drug_allergies:
        allergies = [a.get('drug_name') for a in patient.drug_allergies if isinstance(a, dict) and a.get('drug_name')]
        if allergies:
            parts.append(f"- Drug Allergies: {', '.join(allergies)}")
            for allergy in allergies:
                context_factors.append(PatientContextFactor(
                    category="allergy",
                    value=allergy,
                    influence=f"Doctor must avoid {allergy} and alternatives"
                ))

    # Surgeries
    if patient.surgeries:
        surgeries = [s.get('name') for s in patient.surgeries if isinstance(s, dict) and s.get('name')]
        if surgeries:
            parts.append(f"- Past Surgeries: {', '.join(surgeries)}")
            for surgery in surgeries:
                context_factors.append(PatientContextFactor(
                    category="surgery",
                    value=surgery,
                    influence=f"History of {surgery} may affect treatment approach"
                ))

    # Hospitalizations
    if patient.hospitalizations:
        hosps = [h.get('reason') for h in patient.hospitalizations if isinstance(h, dict) and h.get('reason')]
        if hosps:
            parts.append(f"- Past Hospitalizations: {', '.join(hosps)}")
            for hosp in hosps:
                context_factors.append(PatientContextFactor(
                    category="hospitalization",
                    value=hosp,
                    influence=f"Previous hospitalization for {hosp} suggests need for specialist review"
                ))

    context_str = "\n".join(parts)
    return context_str, context_factors


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two geographic points using Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_location_score(distance_km: Optional[float]) -> float:
    """
    Convert distance to a 0-1 score (closer = higher score).
    PRD: Location proximity scoring for offline consultations.
    """
    if distance_km is None:
        return 0.5  # Neutral score if no location data
    
    # Score decreases as distance increases
    # < 2km = 1.0, 5km = 0.8, 10km = 0.5, 20km+ = 0.1
    if distance_km < 2:
        return 1.0
    elif distance_km < 5:
        return 0.8
    elif distance_km < 10:
        return 0.6
    elif distance_km < 20:
        return 0.4
    else:
        return 0.2


async def get_all_specialties(db: AsyncSession) -> List[str]:
    if _all_specialties_cache["value"] and time.time() < float(_all_specialties_cache["expires_at"]):
        return _all_specialties_cache["value"]  # type: ignore[return-value]

    stmt = select(Speciality.name)
    result = await db.execute(stmt)
    values = [row[0] for row in result.all()]
    _all_specialties_cache["value"] = values
    _all_specialties_cache["expires_at"] = time.time() + SPECIALTY_CACHE_TTL_SECONDS
    return values


async def get_available_specialties_with_doctors(db: AsyncSession) -> set[str]:
    """
    Get specialties that actually have verified doctors in the database.
    This ensures fallbacks only suggest specialties with available doctors.
    """
    cached = _available_specialties_cache["value"]
    if cached and time.time() < float(_available_specialties_cache["expires_at"]):
        return cached  # type: ignore[return-value]

    stmt = select(Speciality.name).join(
        DoctorProfile, DoctorProfile.speciality_id == Speciality.id
    ).where(
        DoctorProfile.bmdc_verified == True
    ).distinct()
    
    result = await db.execute(stmt)
    values = set(row[0] for row in result.all())
    _available_specialties_cache["value"] = values
    _available_specialties_cache["expires_at"] = time.time() + SPECIALTY_CACHE_TTL_SECONDS
    return values


@router.post("/search", response_model=AIDoctorSearchResponse)
async def ai_doctor_search(
    request: AIDoctorSearchRequest,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    AI-Assisted Doctor Search (PRD: doctor-search-prd.md)
    
    Flow:
    1. Extract medical intent via LLM (Groq)
    2. Validate and filter by confidence thresholds
    3. Query verified doctors by specialty
    4. Rank using PRD formula with location awareness
    5. Return ranked list with explainable reasons
    """
    # Get patient context if logged in
    patient_context_text = ""
    patient_context_factors: List[PatientContextFactor] = []
    actor_id: str | None = None
    
    if authorization:
        user = await get_optional_user(authorization)
        if user:
            actor_id = str(user.id)
            patient_context_text, patient_context_factors = await get_patient_history_context(db, user.id)

    emergency_outcome = classify_navigation_outcome(
        user_text=request.user_text,
        intent=None,
        available_specialties=[],
        specialties_with_doctors=[],
    )
    if emergency_outcome["outcome"] == "emergency":
        return AIDoctorSearchResponse(
            doctors=[],
            ambiguity=emergency_outcome["ambiguity"],
            medical_intent=emergency_outcome["medical_intent"],
            patient_context_factors=None,
            requires_immediate_care=emergency_outcome["requires_immediate_care"],
            safety_message=emergency_outcome["safety_message"],
            uncertain=emergency_outcome["uncertain"],
            manual_browse_available=emergency_outcome["manual_browse_available"],
            **_arohon_response_fields(emergency_outcome),
        )

    if actor_id is None:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "authentication_required_for_external_processing",
                "message": "Sign in and choose external text processing, or browse specialties manually.",
                "manual_browse_available": True,
            },
        )
    await require_processing_consent(
        db,
        subject_id=actor_id,
        purpose=ProcessingPurpose.EXTERNAL_TEXT_AI,
        provider=ai_orchestrator.provider,
        required_scopes={ProcessingPurpose.EXTERNAL_TEXT_AI.value},
    )

    # 1. Get available specialties for LLM context
    available_specialties = await get_all_specialties(db)
    specialties_str = ", ".join(available_specialties)

    # 2. Construct LLM Prompt (PRD Section 5)
    system_prompt = f"""You are a medical intent extraction assistant for a Bangladeshi healthcare platform.
Analyze the user's health description and extract structured data.

{patient_context_text if patient_context_text else 'No prior medical history.'}

AVAILABLE SPECIALTIES (Choose from this list, but you can use common variations):
[{specialties_str}]

EXAMPLES of valid specialty matching:
- "heart problem" → "Cardiologist"
- "skin issue" → "Dermatologist"
- "women's health" → "Gynecologists"
- "child doctor" → "Pediatrician"
- "bone pain" → "Orthopedist"
- "stomach problem" → "Gastroenterologist"
- "mental health" → "Psychiatrist"

OUTPUT SCHEMA (JSON only, no explanation):
{{
  "language_detected": "bn" | "en" | "mixed",
  "symptoms": [{{"name": "symptom in English", "confidence": 0.0-1.0}}],
  "duration_days": number or null,
  "specialties": [{{"name": "specialty name or common variation", "confidence": 0.0-1.0}}],
  "ambiguity": "low" | "medium" | "high"
}}

RULES:
- Output ONLY valid JSON, no explanations
- Use English medical terms for symptoms
- For specialties, you can use the exact names from the list OR common variations (e.g., "heart doctor" for "Cardiologist")
- ambiguity: high = unclear input, needs clarification
- If you cannot extract intent, return {{"error": "unable_to_extract", "ambiguity": "high"}}
"""

    sanitized_user_text = redact_pii_text(request.user_text or "").text
    user_prompt = f"Patient description: {sanitized_user_text}"

    llm_response = {}

    # Use the same configured provider and validation boundary as every other
    # hosted text operation. Provider fallback is deliberately disabled.
    try:
        llm_response = await ai_orchestrator.extract_navigation_intent(
            user_text=request.user_text,
            available_specialties=available_specialties,
            patient_context=patient_context_text,
        )
    except AIOrchestratorError as e:
        logger.warning("LLM error in AI search: %s", e)
        unavailable = classify_navigation_outcome(
            user_text=request.user_text,
            intent=None,
            available_specialties=available_specialties,
            specialties_with_doctors=[],
        )
        return AIDoctorSearchResponse(
            doctors=[],
            ambiguity=unavailable["ambiguity"],
            medical_intent=unavailable["medical_intent"],
            patient_context_factors=patient_context_factors if patient_context_factors else None,
            uncertain=unavailable["uncertain"],
            manual_browse_available=unavailable["manual_browse_available"],
            **_arohon_response_fields(unavailable),
        )

    # 4. Get specialties that have actual doctors available
    available_specialties_with_doctors = await get_available_specialties_with_doctors(db)

    # 5. Multi-tier specialty matching, shared with the safety benchmark.
    outcome = classify_navigation_outcome(
        user_text=request.user_text,
        intent=llm_response,
        available_specialties=available_specialties,
        specialties_with_doctors=available_specialties_with_doctors,
    )
    matched_specialties = outcome["matched_specialties"]
    final_specialties = outcome["primary_specialties"]
    secondary_specialties = outcome["secondary_specialties"]
    extracted_specialties = outcome["extracted_specialties"]
    fallback_reason = outcome["fallback_reason"]

    # 5. Query Database (PRD Section 7.1)
    stmt = select(DoctorProfile, Profile, Speciality).join(
        Profile, DoctorProfile.profile_id == Profile.id
    ).join(
        Speciality, DoctorProfile.speciality_id == Speciality.id
    ).where(
        Speciality.name.in_(extracted_specialties),
        DoctorProfile.bmdc_verified == True
    )

    # Location text filter (optional)
    if request.location:
        location_search_term = f"%{request.location}%"
        stmt = stmt.where(
            or_(
                DoctorProfile.hospital_city.ilike(location_search_term),
                DoctorProfile.hospital_address.ilike(location_search_term),
                DoctorProfile.chamber_city.ilike(location_search_term),
                select(DoctorLocation.id)
                .where(
                    DoctorLocation.doctor_id == DoctorProfile.profile_id,
                    or_(
                        DoctorLocation.location_name.ilike(location_search_term),
                        DoctorLocation.address.ilike(location_search_term),
                        DoctorLocation.city.ilike(location_search_term),
                        DoctorLocation.display_name.ilike(location_search_term),
                    ),
                )
                .exists(),
            )
        )
        
    # Consultation mode filter
    if request.consultation_mode:
        stmt = stmt.where(DoctorProfile.consultation_mode.ilike(f"%{request.consultation_mode}%"))

    result = await db.execute(stmt)
    rows = result.all()

    # Rank for navigation only. No urgency or severity value affects ranking.
    
    scored_doctors = []
    is_online = request.consultation_mode and "online" in request.consultation_mode.lower()
    
    # Get user coordinates for distance calculation
    user_lat = request.user_location.latitude if request.user_location else None
    user_lng = request.user_location.longitude if request.user_location else None
    
    for doc, profile, spec in rows:
        # === SPECIALTY MATCH (30%) ===
        specialty_score = 1.0  # Already filtered by specialty
        
        # === EXPERIENCE SCORE (20%) ===
        exp = doc.years_of_experience or 0
        experience_score = min(exp, 20) / 20  # Normalize to 0-1, cap at 20 years
        
        # === LOCATION PROXIMITY (20%) ===
        distance_km = None
        if not is_online and user_lat and user_lng and doc.latitude and doc.longitude:
            distance_km = haversine_distance(user_lat, user_lng, doc.latitude, doc.longitude)
            location_score = calculate_location_score(distance_km)
        else:
            # Online consultation or no location data
            location_score = 0.5  # Neutral
        
        # === AVAILABILITY SCORE (15%) ===
        # Simple heuristic: has visiting hours defined = higher availability
        availability_score = 0.8 if doc.visiting_hours else 0.5
        
        # === FINAL SCORE (PRD Formula) ===
        final_score = (
            0.35 * specialty_score +
            0.25 * experience_score +
            0.25 * location_score +
            0.15 * availability_score
        )
        
        # === REASON GENERATION (PRD Section 8) ===
        reasons = []
        reasons.append(f"Specializes in {spec.name}")
        
        if exp >= 10:
            reasons.append(f"{exp}+ years of experience")
        elif exp >= 5:
            reasons.append(f"{exp} years of experience")
            
        if distance_km is not None:
            if distance_km < 2:
                reasons.append("located nearby")
            elif distance_km < 5:
                reasons.append(f"{distance_km:.1f} km away")
        elif doc.hospital_city:
            reasons.append(f"in {doc.hospital_city}")
            
        reason = ", ".join(reasons) + "."
        reason = reason[0].upper() + reason[1:]  # Capitalize first letter

        doctor_data = AIDoctorResult(
            profile_id=doc.profile_id,
            first_name=profile.first_name,
            last_name=profile.last_name,
            title=doc.title,
            specialization=spec.name,
            qualifications=doc.qualifications,
            years_of_experience=doc.years_of_experience,
            hospital_name=doc.hospital_name,
            hospital_address=doc.hospital_address,
            hospital_city=doc.hospital_city,
            consultation_fee=doc.consultation_fee,
            profile_photo_url=doc.profile_photo_url,
            visiting_hours=doc.visiting_hours,
            available_days=doc.available_days,
            consultation_mode=doc.consultation_mode,
            score=round(final_score, 2),
            reason=reason,
            distance_km=round(distance_km, 1) if distance_km is not None else None,
            latitude=doc.latitude,
            longitude=doc.longitude
        )
        scored_doctors.append(doctor_data)

    # Sort by score (highest first)
    scored_doctors.sort(key=lambda x: x.score, reverse=True)

    return AIDoctorSearchResponse(
        doctors=scored_doctors[:10],  # Top 10 results
        ambiguity=outcome["ambiguity"],
        medical_intent=outcome["medical_intent"],
        patient_context_factors=patient_context_factors if patient_context_factors else None,
        uncertain=outcome["uncertain"],
        manual_browse_available=outcome["manual_browse_available"],
        **_arohon_response_fields(outcome),
    )


@router.post("/vapi/tools/doctor-search")
async def vapi_doctor_search_tool(
    payload: dict,
    request: Request,
    _vapi_secret: None = Depends(verify_vapi_tool_secret),
    db: AsyncSession = Depends(get_db),
):
    tool_calls = _extract_vapi_tool_calls(payload)
    if not tool_calls:
        return {"received": True}

    metadata = _extract_vapi_metadata(payload)
    authorization_header = request.headers.get("authorization")
    results: list[dict] = []

    for tool_call in tool_calls:
        tool_call_id = _safe_vapi_text(tool_call.get("id"), max_length=128) or str(int(time.time() * 1000))
        tool_name = _safe_vapi_text(tool_call.get("name"), max_length=128).lower()
        if tool_name and tool_name not in VAPI_DOCTOR_SEARCH_TOOL_NAMES:
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "Unsupported tool name. Use search_doctors_ai for Medora doctor search.",
                }
            )
            continue

        arguments = _safe_vapi_dict(tool_call.get("arguments"))
        user_text = _safe_vapi_text(
            arguments.get("user_text")
            or arguments.get("message")
            or arguments.get("query")
            or metadata.get("user_text")
            or metadata.get("message"),
            max_length=2500,
        )
        if not user_text:
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "Missing symptom description. Please provide a message describing the health concern.",
                }
            )
            continue

        session_token = _extract_vapi_token(arguments, metadata, authorization_header)
        auth_header = f"Bearer {session_token}" if session_token else None

        vapi_user = await get_optional_user(auth_header)
        if vapi_user is None:
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "Voice session authentication failed. Sign in and restart the session.",
                }
            )
            continue
        try:
            await require_processing_consent(
                db,
                subject_id=str(vapi_user.id),
                purpose=ProcessingPurpose.EXTERNAL_LIVE_AUDIO,
                provider="vapi",
                local_option_available=True,
                required_scopes={ProcessingPurpose.EXTERNAL_LIVE_AUDIO.value},
            )
        except HTTPException:
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "Vapi audio consent is missing or expired. Use local voice processing instead.",
                }
            )
            continue

        location = _safe_vapi_text(arguments.get("location") or metadata.get("location"), max_length=120) or None
        consultation_mode = _safe_vapi_text(
            arguments.get("consultation_mode") or metadata.get("consultation_mode"),
            max_length=64,
        ) or None
        user_location = _extract_vapi_user_location(arguments, metadata)

        search_request = AIDoctorSearchRequest(
            user_text=user_text,
            location=location,
            consultation_mode=consultation_mode,
            user_location=user_location,
        )

        try:
            search_response = await asyncio.wait_for(
                ai_doctor_search(
                    request=search_request,
                    authorization=auth_header,
                    db=db,
                ),
                timeout=VAPI_DOCTOR_SEARCH_TIMEOUT_SECONDS,
            )
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": _build_vapi_doctor_search_summary(search_response),
                }
            )
        except asyncio.TimeoutError:
            logger.warning(
                "Vapi doctor search exceeded %.1fs — returning voice apology",
                VAPI_DOCTOR_SEARCH_TIMEOUT_SECONDS,
            )
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "Searching is taking longer than usual. Please ask again in a moment.",
                }
            )
        except Exception as exc:
            logger.warning("Vapi doctor search tool failed: %s", exc)
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "I could not complete doctor search right now. Please try again in a moment.",
                }
            )

    return {"results": results}


# ============================================================================
# VOICE-TO-TEXT ENDPOINT
# ============================================================================

from fastapi import UploadFile, File, Form
from app.schemas.voice import VoiceTranscriptionResponse, VoiceTranscriptionError
from app.services.asr import transcribe_audio, get_confidence_level

# Maximum audio file size (10 MB)
MAX_AUDIO_SIZE = 10 * 1024 * 1024


@router.post(
    "/normalize/voice",
    response_model=VoiceTranscriptionResponse,
    responses={
        400: {"model": VoiceTranscriptionError},
        413: {"model": VoiceTranscriptionError},
        500: {"model": VoiceTranscriptionError}
    }
)
async def normalize_voice(
    audio_file: UploadFile = File(..., description="Audio file (webm, wav, mp3)"),
    language: Optional[str] = Form(default="auto", description="Language hint: 'auto' (detect), 'bn' (Bangla), or 'en' (English)"),
    current_user=Depends(get_current_user_token),
):
    """
    Transcribe voice audio to text for AI doctor search.
    
    This endpoint converts speech to text using Whisper-Small ASR.
    The transcribed text can then be used with the /ai/doctor-search endpoint.
    
    **Language Parameter:**
    - `auto` (default): Auto-detect between English and Bangla - RECOMMENDED
    - `bn`: Force Bangla transcription only
    - `en`: Force English transcription only
    
    **Auto-detection Strategy:**
    - Transcribes with both English and Bangla
    - Compares confidence scores
    - Returns the result with higher confidence
    - Validates script correctness (Bengali vs Devanagari)
    
    Supported formats: audio/webm, audio/wav, audio/mp3, audio/mpeg
    Max file size: 10 MB
    Max duration: 60 seconds
    
    Returns:
        VoiceTranscriptionResponse with transcribed text, confidence, and language
    """
    # Validate language parameter
    valid_languages = ["bn", "en", "auto"]
    if language not in valid_languages:
        language = "auto"  # Default to auto-detection
    
    # Validate file type
    allowed_types = [
        "audio/webm", 
        "audio/wav", 
        "audio/wave",
        "audio/x-wav",
        "audio/mp3", 
        "audio/mpeg",
        "audio/ogg",
        "audio/x-m4a",
        "audio/mp4"
    ]
    
    content_type = audio_file.content_type or ""
    if content_type and content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"Unsupported audio format: {content_type}",
                "retry_suggested": True,
                "fallback_to_text": True
            }
        )
    
    # Read file content
    try:
        audio_content = await audio_file.read()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Failed to read audio file",
                "retry_suggested": True,
                "fallback_to_text": True
            }
        )
    
    # Validate file size
    if len(audio_content) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=413,
            detail={
                "error": "Audio file too large. Maximum size is 10 MB.",
                "retry_suggested": True,
                "fallback_to_text": True
            }
        )
    
    # Check for empty file
    if len(audio_content) == 0:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Empty audio file",
                "retry_suggested": True,
                "fallback_to_text": True
            }
        )
    
    # Transcribe audio with language hint
    try:
        transcribed_text, confidence, detected_lang = await transcribe_audio(
            audio_content, 
            audio_file.filename or "audio.webm",
            language_hint=language  # Pass language hint to ASR
        )
        
        return VoiceTranscriptionResponse(
            normalized_text=transcribed_text,
            confidence=round(confidence, 2),
            confidence_level=get_confidence_level(confidence),
            language_detected=detected_lang,
            source="voice"
        )
        
    except ValueError as e:
        # Empty/silence detection
        raise HTTPException(
            status_code=400,
            detail={
                "error": str(e),
                "retry_suggested": True,
                "fallback_to_text": True
            }
        )
    except Exception as e:
        # Unexpected ASR failure
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Transcription failed. Please try again or use text input.",
                "retry_suggested": True,
                "fallback_to_text": True
            }
        )
