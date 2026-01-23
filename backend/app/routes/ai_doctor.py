import json
import math
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from typing import List, Optional, Tuple
from datetime import date

from app.core.config import settings
from app.core.dependencies import get_db
from app.db.models.doctor import DoctorProfile
from app.db.models.profile import Profile
from app.db.models.speciality import Speciality
from app.db.models.patient import PatientProfile
from app.db.models.appointment import Appointment
from app.schemas.ai_search import (
    AIDoctorSearchRequest, 
    AIDoctorSearchResponse, 
    AIDoctorResult,
    PatientContextFactor
)

from app.db.supabase import supabase
from groq import Groq

from app.services.specialty_matching import (
    match_specialties_from_llm_response,
    get_fallback_specialties,
    normalize_text
)
from app.services.medical_knowledge import (
    get_related_specialties,
    get_fallback_chain,
    should_always_include_gp,
    should_include_internal_medicine,
    UNIVERSAL_FALLBACKS
)

router = APIRouter()
client = Groq(api_key=settings.GROQ_API_KEY)


async def get_optional_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    try:
        if "Bearer" in authorization:
            token = authorization.split(" ")[1]
        else:
            token = authorization
        
        response = supabase.auth.get_user(token)
        return response.user if response else None 
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
    stmt = select(Speciality.name)
    result = await db.execute(stmt)
    return [row[0] for row in result.all()]


async def get_available_specialties_with_doctors(db: AsyncSession) -> set[str]:
    """
    Get specialties that actually have verified doctors in the database.
    This ensures fallbacks only suggest specialties with available doctors.
    """
    stmt = select(Speciality.name).join(
        DoctorProfile, DoctorProfile.speciality_id == Speciality.id
    ).where(
        DoctorProfile.bmdc_verified == True
    ).distinct()
    
    result = await db.execute(stmt)
    return set(row[0] for row in result.all())


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
    
    if authorization:
        user = await get_optional_user(authorization)
        if user:
            patient_context_text, patient_context_factors = await get_patient_history_context(db, user.id)

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
  "severity": "low" | "medium" | "high",
  "specialties": [{{"name": "specialty name or common variation", "confidence": 0.0-1.0}}],
  "ambiguity": "low" | "medium" | "high"
}}

RULES:
- Output ONLY valid JSON, no explanations
- Use English medical terms for symptoms
- For specialties, you can use the exact names from the list OR common variations (e.g., "heart doctor" for "Cardiologist")
- severity: high = urgent/emergency symptoms, medium = needs attention, low = routine
- ambiguity: high = unclear input, needs clarification
- If you cannot extract intent, return {{"error": "unable_to_extract", "ambiguity": "high"}}
"""

    user_prompt = f"Patient description: {request.user_text}"

    llm_response = {}

    # 3. Call Groq LLM (PRD Section 4.3)
    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=300
        )
        content = completion.choices[0].message.content
        if content:
            llm_response = json.loads(content)
        else:
            raise ValueError("Empty response from LLM")
            
    except Exception as e:
        # PRD Section 10: LLM Failure - fallback to manual search
        print(f"LLM Error: {e}")
        return AIDoctorSearchResponse(
            doctors=[], 
            ambiguity="high", 
            medical_intent={"error": str(e), "fallback": "manual_search"},
            patient_context_factors=patient_context_factors if patient_context_factors else None
        )

    # 4. Get specialties that have actual doctors available
    available_specialties_with_doctors = await get_available_specialties_with_doctors(db)
    
    # 5. Multi-Tier Specialty Matching (Enhanced Medical Knowledge)
    severity = llm_response.get("severity", "medium")
    symptoms = [s.get('name', '') for s in llm_response.get("symptoms", [])]
    
    # Tier 1: LLM-extracted specialties
    matched_specialties = match_specialties_from_llm_response(
        llm_response.get("specialties", []),
        available_specialties,
        min_confidence=0.3
    )
    primary_specialties = [name for name, confidence in matched_specialties]
    
    # Tier 2: Symptom-based related specialties
    if not primary_specialties:
        related = get_related_specialties(symptoms, severity, max_results=3)
        primary_specialties = [s for s in related if s in available_specialties_with_doctors]
    
    # Tier 3: Build fallback chain with GP/Internal Medicine
    final_specialties, secondary_specialties = get_fallback_chain(
        primary_specialties=primary_specialties,
        available_specialties=available_specialties_with_doctors,
        severity=severity,
        min_count=2  # Always return at least 2 specialties
    )
    
    # Combine for query (but track which are primary vs secondary)
    extracted_specialties = final_specialties + secondary_specialties
    
    fallback_reason = None
    if secondary_specialties:
        if "General Physician" in secondary_specialties:
            fallback_reason = "General Physicians included for comprehensive consultation"
        elif "Internal Medicine" in secondary_specialties:
            fallback_reason = "Internal Medicine added for diagnostic evaluation"
        else:
            fallback_reason = "Additional specialties included to ensure availability"

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
        stmt = stmt.where(
            or_(
                DoctorProfile.hospital_city.ilike(f"%{request.location}%"),
                DoctorProfile.hospital_address.ilike(f"%{request.location}%"),
                DoctorProfile.chamber_city.ilike(f"%{request.location}%")
            )
        )
        
    # Consultation mode filter
    if request.consultation_mode:
        stmt = stmt.where(DoctorProfile.consultation_mode.ilike(f"%{request.consultation_mode}%"))

    result = await db.execute(stmt)
    rows = result.all()

    # 6. Rank Doctors (PRD Section 7.4 - Authoritative v1 Formula)
    # final_score = 0.30 * specialty_match + 0.20 * experience_score + 
    #               0.15 * severity_alignment + 0.20 * location_proximity + 0.15 * availability_score
    
    scored_doctors = []
    severity = llm_response.get("severity", "medium")
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
        
        # === SEVERITY ALIGNMENT (15%) ===
        if severity == "high":
            # For urgent cases, prefer senior doctors
            severity_score = 1.0 if exp >= 10 else 0.6 if exp >= 5 else 0.3
        elif severity == "medium":
            severity_score = 0.7
        else:
            severity_score = 0.5
        
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
            0.30 * specialty_score +
            0.20 * experience_score +
            0.15 * severity_score +
            0.20 * location_score +
            0.15 * availability_score
        )
        
        # === REASON GENERATION (PRD Section 8) ===
        reasons = []
        reasons.append(f"Specializes in {spec.name}")
        
        if exp >= 10:
            reasons.append(f"{exp}+ years of experience")
        elif exp >= 5:
            reasons.append(f"{exp} years of experience")
            
        if severity == "high" and exp >= 10:
            reasons.append("suitable for urgent cases")
            
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
        ambiguity=llm_response.get("ambiguity", "low"),
        medical_intent={
            **llm_response,
            "matched_specialties": matched_specialties,
            "primary_specialties": final_specialties,
            "secondary_specialties": secondary_specialties,
            "extracted_specialty_names": extracted_specialties,
            "total_specialties_matched": len(extracted_specialties),
            "fallback_reason": fallback_reason
        },
        patient_context_factors=patient_context_factors if patient_context_factors else None
    )
