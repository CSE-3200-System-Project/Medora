import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List

from app.core.config import settings
from app.core.dependencies import get_db
from app.db.models.doctor import DoctorProfile
from app.db.models.profile import Profile
from app.db.models.speciality import Speciality
from app.schemas.ai_search import AIDoctorSearchRequest, AIDoctorSearchResponse, AIDoctorResult

from groq import Groq

router = APIRouter()
client = Groq(api_key=settings.GROQ_API_KEY)

async def get_all_specialties(db: AsyncSession) -> List[str]:
    stmt = select(Speciality.name)
    result = await db.execute(stmt)
    return [row[0] for row in result.all()]

@router.post("/search", response_model=AIDoctorSearchResponse)
async def ai_doctor_search(
    request: AIDoctorSearchRequest,
    db: AsyncSession = Depends(get_db)
):
    # 1. Get available specialties for context
    available_specialties = await get_all_specialties(db)
    specialties_str = ", ".join(available_specialties)

    # 2. Construct Prompt
    system_prompt = f"""
You are a medical intent extraction assistant. 
Analyze the user's input and extract structured medical data.

AVAILABLE SPECIALTIES (Choose ONLY from this list):
[{specialties_str}]

OUTPUT SCHEMA (JSON):
{{
  "language_detected": "string",
  "symptoms": [{{"name": "string", "confidence": float}}],
  "duration_days": int | null,
  "severity": "low | medium | high",
  "specialties": [{{"name": "string", "confidence": float}}],
  "ambiguity": "low | medium | high"
}}

If you cannot extract intent, set ambiguity to "high".
"""

    user_prompt = f"User Input: {request.user_text}"

    print("=== AI DOCTOR SEARCH LOG ===")
    print(f"System Prompt: {system_prompt}")
    print(f"User Prompt: {user_prompt}")
    print("============================")

    llm_response = {}

    # 3. Call Groq
    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        content = completion.choices[0].message.content
        if content:
            llm_response = json.loads(content)
        else:
            raise ValueError("Empty response from LLM")
            
    except Exception as e:
        print(f"LLM Error: {e}")
        return AIDoctorSearchResponse(doctors=[], ambiguity="high", medical_intent={"error": str(e)})

    print(f"LLM Response: {json.dumps(llm_response, indent=2)}")
    print("============================")

    # 4. Filter Doctors
    extracted_specialties = [
        s['name'] for s in llm_response.get("specialties", []) 
        if s['confidence'] > 0.4 and s['name'] in available_specialties
    ]
    
    # If no specialties found via LLM but user provided inputs, fall back?
    # For now, strict AI search. If no extracted specialties, return empty or high ambiguity.
    
    if not extracted_specialties:
         return AIDoctorSearchResponse(
            doctors=[], 
            ambiguity="high" if llm_response.get("ambiguity") == "high" else "medium",
            medical_intent=llm_response
        )

    # Query DB
    stmt = select(DoctorProfile, Profile, Speciality).join(
        Profile, DoctorProfile.profile_id == Profile.id
    ).join(
        Speciality, DoctorProfile.speciality_id == Speciality.id
    ).where(
        Speciality.name.in_(extracted_specialties),
        DoctorProfile.bmdc_verified == True
    )

    if request.location:
        # Simple text match for city/address logic
        stmt = stmt.where(
            or_(
                DoctorProfile.hospital_city.ilike(f"%{request.location}%"),
                DoctorProfile.hospital_address.ilike(f"%{request.location}%"),
                DoctorProfile.chamber_city.ilike(f"%{request.location}%")
            )
        )
        
    if request.consultation_mode:
        stmt = stmt.where(DoctorProfile.consultation_mode.ilike(f"%{request.consultation_mode}%"))

    result = await db.execute(stmt)
    rows = result.all()

    # 5. Rank Doctors
    scored_doctors = []
    urgency = llm_response.get("severity", "medium")
    
    for doc, profile, spec in rows:
        score = 0.0
        
        # Base score from specialty (already filtered, so at least 0.35)
        score += 0.35
        
        # Experience
        exp = doc.years_of_experience or 0
        exp_score = min(exp, 20) / 20 * 0.25
        score += exp_score
        
        # Urgency adjustment
        if urgency == "high":
            if exp > 10: score += 0.15 
        else:
            score += 0.05
            
        # Reason generation
        reason = f"Specializes in {spec.name}"
        if exp > 5:
            reason += f" with {exp} years of experience"
        
        if request.location and request.location.lower() in (doc.hospital_city or "").lower():
            reason += f", located in {doc.hospital_city}"
            score += 0.15 # Location bonus
            
        reason += "."

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
            score=round(score, 2),
            reason=reason
        )
        scored_doctors.append(doctor_data)

    # Sort by score details
    scored_doctors.sort(key=lambda x: x.score, reverse=True)

    return AIDoctorSearchResponse(
        doctors=scored_doctors[:10],
        ambiguity=llm_response.get("ambiguity", "low"),
        medical_intent=llm_response
    )
