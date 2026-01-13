import json
import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional, Tuple

from app.core.config import settings
from app.core.dependencies import get_db
from app.db.models.doctor import DoctorProfile
from app.db.models.profile import Profile
from app.db.models.speciality import Speciality
from app.schemas.ai_search import AIDoctorSearchRequest, AIDoctorSearchResponse, AIDoctorResult

from groq import Groq

from app.services.specialty_matching import (
    match_specialties_from_llm_response,
    get_fallback_specialties,
    normalize_text
)

router = APIRouter()
client = Groq(api_key=settings.GROQ_API_KEY)


# === HAVERSINE DISTANCE CALCULATION (PRD Section 7.3) ===
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth.
    Returns distance in kilometers.
    """
    R = 6371  # Earth's radius in km
    
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


@router.post("/search", response_model=AIDoctorSearchResponse)
async def ai_doctor_search(
    request: AIDoctorSearchRequest,
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
    # 1. Get available specialties for LLM context
    available_specialties = await get_all_specialties(db)
    specialties_str = ", ".join(available_specialties)

    # 2. Construct LLM Prompt (PRD Section 5)
    system_prompt = f"""You are a medical intent extraction assistant for a Bangladeshi healthcare platform.
Analyze the user's health description and extract structured data.

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
            medical_intent={"error": str(e), "fallback": "manual_search"}
        )

    # 4. Advanced Specialty Matching (PRD Section 6.2)
    # Use intelligent matching instead of simple confidence filtering
    matched_specialties = match_specialties_from_llm_response(
        llm_response.get("specialties", []),
        available_specialties,
        min_confidence=0.3  # Lower threshold since we have advanced matching
    )

    extracted_specialties = [name for name, confidence in matched_specialties]

    # 5. Fallback Logic: If no specialties matched, try symptom-based fallback
    if not extracted_specialties:
        symptoms = [s.get('name', '') for s in llm_response.get("symptoms", [])]
        fallback_specialties = get_fallback_specialties(symptoms, available_specialties)
        if fallback_specialties:
            extracted_specialties = fallback_specialties[:2]  # Limit to top 2 fallbacks
            print(f"Using fallback specialties based on symptoms: {extracted_specialties}")

    # If still no specialties, return with high ambiguity
    if not extracted_specialties:
        return AIDoctorSearchResponse(
            doctors=[],
            ambiguity="high" if llm_response.get("ambiguity") == "high" else "medium",
            medical_intent={
                **llm_response,
                "matched_specialties": matched_specialties,
                "extracted_specialty_names": extracted_specialties,
                "total_specialties_matched": len(extracted_specialties),
                "fallback_used": True
            }
        )

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
            "matched_specialties": matched_specialties,  # Include matched specialties with confidence scores
            "extracted_specialty_names": extracted_specialties,  # Just the names for easy reference
            "total_specialties_matched": len(extracted_specialties)
        }
    )
