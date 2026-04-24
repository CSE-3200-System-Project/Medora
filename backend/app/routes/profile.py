from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.core.dependencies import get_db, resolve_profile
from app.routes.auth import get_current_user_token
from app.db.models.patient import PatientProfile
from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_location import DoctorLocation
from app.db.models.speciality import Speciality
from app.db.models.profile import Profile
from app.db.models.enums import VerificationStatus, UserRole
from app.core.avatar_defaults import generate_default_avatar_url
from app.schemas.onboarding import (
    PatientAIAccessResponse,
    PatientAIAccessUpdate,
    PatientOnboardingUpdate,
    DoctorOnboardingUpdate,
)
from app.services.geocoding import geocode_and_save_doctor_locations, geocode_location_text_with_cache
from typing import Optional, List, Dict, Any
from datetime import datetime
import traceback
import re
import uuid

router = APIRouter()


async def _ensure_patient_avatar(db: AsyncSession, user_id: str, patient: PatientProfile | None) -> str:
    fallback_url = generate_default_avatar_url(user_id)
    if not patient:
        return fallback_url
    if patient.profile_photo_url and str(patient.profile_photo_url).strip():
        return str(patient.profile_photo_url)

    await db.execute(
        update(PatientProfile)
        .where(PatientProfile.profile_id == user_id)
        .values(profile_photo_url=fallback_url)
    )
    await db.commit()
    return fallback_url


async def _ensure_doctor_avatar(db: AsyncSession, user_id: str, doctor: DoctorProfile | None) -> str:
    fallback_url = generate_default_avatar_url(user_id)
    if not doctor:
        return fallback_url
    if doctor.profile_photo_url and str(doctor.profile_photo_url).strip():
        return str(doctor.profile_photo_url)

    await db.execute(
        update(DoctorProfile)
        .where(DoctorProfile.profile_id == user_id)
        .values(profile_photo_url=fallback_url)
    )
    await db.commit()
    return fallback_url


def _normalize_slot_text(value: str) -> str:
    value = (value or "").strip()
    value = re.sub(r"\s*,\s*", ", ", value)
    value = re.sub(r"(\d)(AM|PM|am|pm|Am|aM|Pm|pM)", r"\1 \2", value)
    value = re.sub(r"(?i)\bam\b", "AM", value)
    value = re.sub(r"(?i)\bpm\b", "PM", value)
    return value.strip()


def _normalize_day_slots(day_slots: Dict[str, List[str]] | None) -> Dict[str, List[str]]:
    if not day_slots:
        return {}

    normalized: Dict[str, List[str]] = {}
    for day, slots in day_slots.items():
        normalized[day] = [_normalize_slot_text(slot) for slot in slots if slot]
    return normalized


def _compose_location_text(
    location_name: str | None,
    address: str | None,
    city: str | None,
    country: str | None,
    location_text: str | None,
) -> str:
    explicit = (location_text or "").strip()
    if explicit:
        return explicit

    parts = [
        (location_name or "").strip(),
        (address or "").strip(),
        (city or "").strip(),
        (country or "").strip() or "Bangladesh",
    ]
    return ", ".join([part for part in parts if part])

@router.get("/verification-status")
async def get_verification_status(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get user verification status"""
    profile = await resolve_profile(db, user)

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {
        "verification_status": profile.verification_status.value,
        "role": profile.role.value,
        "bmdc_verified": profile.verification_status == VerificationStatus.verified if profile.role == UserRole.DOCTOR else None
    }

@router.patch("/patient/onboarding")
async def update_patient_onboarding(
    data: PatientOnboardingUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update patient profile during onboarding"""
    print(f"Received onboarding data: {data.dict(exclude_unset=True)}")
    user_id = user.id
    try:
        # 1. Update Profile table (common fields)
        profile_data = {}
        if data.first_name: profile_data['first_name'] = data.first_name
        if data.last_name: profile_data['last_name'] = data.last_name
        if data.phone: profile_data['phone'] = data.phone
        if data.onboarding_completed is not None: profile_data['onboarding_completed'] = data.onboarding_completed
        
        if profile_data:
            await db.execute(
                update(Profile)
                .where(Profile.id == user_id)
                .values(**profile_data)
            )

        # 2. Update PatientProfile table
        patient_data = {}
        
        # Helper to convert yes/no to bool
        def to_bool(val):
            if isinstance(val, bool): return val
            if isinstance(val, str): return val.lower() == 'yes'
            return False
        
        # Helper to convert list of pydantic models to dicts
        def to_dict_list(items):
            if items is None: return None
            return [item.model_dump() if hasattr(item, 'model_dump') else (item.dict() if hasattr(item, 'dict') else item) for item in items]

        def normalize_medical_tests(items):
            allowed_statuses = {"pending", "completed", "skipped"}
            normalized = []
            if items is None:
                return normalized
            for raw in items:
                item = dict(raw) if isinstance(raw, dict) else {}
                result_text = str(item.get("result") or "").strip()
                incoming_status = str(item.get("status") or "").strip().lower()
                status_value = incoming_status if incoming_status in allowed_statuses else ("completed" if result_text else "pending")
                item["status"] = status_value
                normalized.append(item)
            return normalized

        # Basic Identity
        if data.dob: patient_data['date_of_birth'] = datetime.strptime(data.dob, '%Y-%m-%d').date()
        if data.gender: patient_data['gender'] = data.gender
        if data.profile_photo_url is not None: patient_data['profile_photo_url'] = data.profile_photo_url
        if data.profile_banner_url is not None: patient_data['profile_banner_url'] = data.profile_banner_url
        if data.nid_number: patient_data['nid_number'] = data.nid_number
        
        # Contact & Address
        if data.address: patient_data['address'] = data.address
        if data.city: patient_data['city'] = data.city
        if data.district: patient_data['district'] = data.district
        if data.postal_code: patient_data['postal_code'] = data.postal_code
        if data.country: patient_data['country'] = data.country
        
        # Physical & Demographic
        if data.height: patient_data['height'] = data.height
        if data.weight: patient_data['weight'] = data.weight
        if data.blood_group: patient_data['blood_group'] = data.blood_group
        if data.marital_status: patient_data['marital_status'] = data.marital_status
        if data.occupation: patient_data['occupation'] = data.occupation
        if data.medical_summary_url: patient_data['medical_summary_url'] = data.medical_summary_url
        
        # Known Conditions
        if data.has_conditions is not None: patient_data['has_conditions'] = to_bool(data.has_conditions)
        if data.conditions is not None: patient_data['conditions'] = to_dict_list(data.conditions)
        if data.has_diabetes is not None: patient_data['has_diabetes'] = data.has_diabetes
        if data.has_hypertension is not None: patient_data['has_hypertension'] = data.has_hypertension
        if data.has_heart_disease is not None: patient_data['has_heart_disease'] = data.has_heart_disease
        if data.has_asthma is not None: patient_data['has_asthma'] = data.has_asthma
        if data.has_kidney_disease is not None: patient_data['has_kidney_disease'] = data.has_kidney_disease
        if data.has_liver_disease is not None: patient_data['has_liver_disease'] = data.has_liver_disease
        if data.has_thyroid is not None: patient_data['has_thyroid'] = data.has_thyroid
        if data.has_neurological is not None: patient_data['has_neurological'] = data.has_neurological
        if data.has_cancer is not None: patient_data['has_cancer'] = data.has_cancer
        if data.has_arthritis is not None: patient_data['has_arthritis'] = data.has_arthritis
        if data.has_stroke is not None: patient_data['has_stroke'] = data.has_stroke
        if data.has_epilepsy is not None: patient_data['has_epilepsy'] = data.has_epilepsy
        if data.has_mental_health is not None: patient_data['has_mental_health'] = data.has_mental_health
        if data.chronic_conditions_notes: patient_data['chronic_conditions_notes'] = data.chronic_conditions_notes
        if data.other_conditions: patient_data['other_conditions'] = data.other_conditions
        if data.condition_details: patient_data['condition_details'] = data.condition_details
        
        # Medications & Allergies
        if data.taking_meds is not None: patient_data['taking_meds'] = to_bool(data.taking_meds)
        if data.medications is not None: patient_data['medications'] = to_dict_list(data.medications)
        if data.allergies: patient_data['allergies'] = data.allergies
        if data.allergy_reaction: patient_data['allergy_reaction'] = data.allergy_reaction
        if data.drug_allergies is not None: patient_data['drug_allergies'] = to_dict_list(data.drug_allergies)
        if data.food_allergies: patient_data['food_allergies'] = data.food_allergies
        if data.environmental_allergies: patient_data['environmental_allergies'] = data.environmental_allergies
        
        # Medical History
        if data.past_surgeries is not None: patient_data['past_surgeries'] = to_bool(data.past_surgeries)
        if data.surgery_description: patient_data['surgery_description'] = data.surgery_description
        if data.surgeries is not None: patient_data['surgeries'] = to_dict_list(data.surgeries)
        if data.ongoing_treatments is not None: patient_data['ongoing_treatments'] = to_bool(data.ongoing_treatments)
        if data.treatment_description: patient_data['treatment_description'] = data.treatment_description
        if data.ongoing_treatment_details: patient_data['ongoing_treatment_details'] = data.ongoing_treatment_details
        if data.hospitalizations is not None: patient_data['hospitalizations'] = to_dict_list(data.hospitalizations)
        if data.has_medical_tests is not None: patient_data['has_medical_tests'] = to_bool(data.has_medical_tests)
        if data.medical_tests is not None:
            patient_data['medical_tests'] = normalize_medical_tests(to_dict_list(data.medical_tests))
        if data.previous_doctors: patient_data['previous_doctors'] = data.previous_doctors
        if data.last_checkup_date: patient_data['last_checkup_date'] = data.last_checkup_date
        
        # Family History
        if data.family_has_diabetes is not None: patient_data['family_has_diabetes'] = data.family_has_diabetes
        if data.family_has_hypertension is not None: patient_data['family_has_hypertension'] = data.family_has_hypertension
        if data.family_has_heart_disease is not None: patient_data['family_has_heart_disease'] = data.family_has_heart_disease
        if data.family_has_cancer is not None: patient_data['family_has_cancer'] = data.family_has_cancer
        if data.family_has_stroke is not None: patient_data['family_has_stroke'] = data.family_has_stroke
        if data.family_has_asthma is not None: patient_data['family_has_asthma'] = data.family_has_asthma
        if data.family_has_thalassemia is not None: patient_data['family_has_thalassemia'] = data.family_has_thalassemia
        if data.family_has_blood_disorders is not None: patient_data['family_has_blood_disorders'] = data.family_has_blood_disorders
        if data.family_has_mental_health is not None: patient_data['family_has_mental_health'] = data.family_has_mental_health
        if data.family_has_kidney_disease is not None: patient_data['family_has_kidney_disease'] = data.family_has_kidney_disease
        if data.family_has_thyroid is not None: patient_data['family_has_thyroid'] = data.family_has_thyroid
        if data.family_history_notes: patient_data['family_history_notes'] = data.family_history_notes
        
        # Lifestyle
        if data.smoking: patient_data['smoking'] = data.smoking
        if data.smoking_details: patient_data['smoking_details'] = data.smoking_details
        if data.smoking_amount: patient_data['smoking_amount'] = data.smoking_amount
        if data.alcohol: patient_data['alcohol'] = data.alcohol
        if data.alcohol_details: patient_data['alcohol_details'] = data.alcohol_details
        if data.alcohol_frequency: patient_data['alcohol_frequency'] = data.alcohol_frequency
        if data.tobacco_use: patient_data['tobacco_use'] = data.tobacco_use
        if data.drug_use: patient_data['drug_use'] = data.drug_use
        if data.caffeine: patient_data['caffeine'] = data.caffeine
        if data.activity_level: patient_data['activity_level'] = data.activity_level
        if data.exercise_type: patient_data['exercise_type'] = data.exercise_type
        if data.exercise_frequency: patient_data['exercise_frequency'] = data.exercise_frequency
        if data.sleep_duration: patient_data['sleep_duration'] = data.sleep_duration
        if data.sleep_quality: patient_data['sleep_quality'] = data.sleep_quality
        if data.diet: patient_data['diet'] = data.diet
        if data.diet_restrictions: patient_data['diet_restrictions'] = data.diet_restrictions
        if data.dietary_restrictions: patient_data['dietary_restrictions'] = data.dietary_restrictions
        if data.water_intake: patient_data['water_intake'] = data.water_intake
        if data.stress_level: patient_data['stress_level'] = data.stress_level
        if data.mental_health_history: patient_data['mental_health_history'] = data.mental_health_history
        if data.mental_health_concerns: patient_data['mental_health_concerns'] = data.mental_health_concerns
        if data.currently_in_therapy is not None: patient_data['currently_in_therapy'] = data.currently_in_therapy
        
        # Vaccination
        if data.vaccination_status: patient_data['vaccination_status'] = data.vaccination_status
        if data.vaccinations is not None: patient_data['vaccinations'] = to_dict_list(data.vaccinations)
        if data.has_epi_vaccination is not None: patient_data['has_epi_vaccination'] = data.has_epi_vaccination
        if data.has_covid_vaccination is not None: patient_data['has_covid_vaccination'] = data.has_covid_vaccination
        if data.covid_vaccine_doses is not None: patient_data['covid_vaccine_doses'] = data.covid_vaccine_doses
        if data.has_hepatitis_vaccination is not None: patient_data['has_hepatitis_vaccination'] = data.has_hepatitis_vaccination
        if data.has_tb_vaccination is not None: patient_data['has_tb_vaccination'] = data.has_tb_vaccination
        if data.has_tt_vaccination is not None: patient_data['has_tt_vaccination'] = data.has_tt_vaccination
        
        # Preferences & Consent
        if data.language: patient_data['language'] = data.language
        if data.preferred_language: patient_data['preferred_language'] = data.preferred_language
        if data.languages_spoken is not None: patient_data['languages_spoken'] = data.languages_spoken
        if data.preferred_contact_method: patient_data['preferred_contact_method'] = data.preferred_contact_method
        if data.notifications is not None: patient_data['notifications'] = data.notifications
        if data.notification_preferences is not None: patient_data['notification_preferences'] = data.notification_preferences
        if data.emergency_name: patient_data['emergency_name'] = data.emergency_name
        if data.emergency_relation: patient_data['emergency_relation'] = data.emergency_relation
        if data.emergency_phone: patient_data['emergency_phone'] = data.emergency_phone
        if data.emergency_address: patient_data['emergency_address'] = data.emergency_address
        if data.secondary_emergency_name: patient_data['secondary_emergency_name'] = data.secondary_emergency_name
        if data.secondary_emergency_phone: patient_data['secondary_emergency_phone'] = data.secondary_emergency_phone
        if data.consent_storage is not None: patient_data['consent_storage'] = data.consent_storage
        if data.consent_ai is not None:
            patient_data['consent_ai'] = data.consent_ai
            # Backward compatibility: onboarding's legacy consent_ai now seeds both AI access modes.
            if data.ai_personal_context_enabled is None:
                patient_data['ai_personal_context_enabled'] = data.consent_ai
            if data.ai_general_chat_enabled is None:
                patient_data['ai_general_chat_enabled'] = data.consent_ai
        if data.ai_personal_context_enabled is not None:
            patient_data['ai_personal_context_enabled'] = data.ai_personal_context_enabled
        if data.ai_general_chat_enabled is not None:
            patient_data['ai_general_chat_enabled'] = data.ai_general_chat_enabled
        if (
            data.consent_ai is None
            and (
                data.ai_personal_context_enabled is not None
                or data.ai_general_chat_enabled is not None
            )
        ):
            personal_enabled = (
                data.ai_personal_context_enabled
                if data.ai_personal_context_enabled is not None
                else False
            )
            general_enabled = (
                data.ai_general_chat_enabled
                if data.ai_general_chat_enabled is not None
                else False
            )
            patient_data['consent_ai'] = bool(personal_enabled or general_enabled)
        if data.consent_doctor is not None: patient_data['consent_doctor'] = data.consent_doctor
        if data.consent_research is not None: patient_data['consent_research'] = data.consent_research

        # AUTO-SYNC BOOLEAN FLAGS: Set flags based on array content (data consistency fix)
        if 'surgeries' in patient_data and patient_data['surgeries']:
            patient_data['past_surgeries'] = len(patient_data['surgeries']) > 0
        if 'medications' in patient_data and patient_data['medications']:
            patient_data['taking_meds'] = len(patient_data['medications']) > 0
        if 'conditions' in patient_data and patient_data['conditions']:
            patient_data['has_conditions'] = len(patient_data['conditions']) > 0

        if patient_data:
            # Check if patient profile exists
            result = await db.execute(select(PatientProfile).where(PatientProfile.profile_id == user_id))
            if not result.scalar():
                # Create if not exists (should exist from signup, but just in case)
                new_profile = PatientProfile(profile_id=user_id, **patient_data)
                db.add(new_profile)
            else:
                await db.execute(
                    update(PatientProfile)
                    .where(PatientProfile.profile_id == user_id)
                    .values(**patient_data)
                )
        
        await db.commit()
        return {"message": "Profile updated successfully"}
    except Exception as e:
        await db.rollback()
        print(f"Error updating patient profile: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/doctor/onboarding")
async def update_doctor_onboarding(
    data: DoctorOnboardingUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update doctor profile during onboarding"""
    user_id = user.id
    try:
        # Debug log incoming data
        print("Received doctor onboarding payload:", data.model_dump(exclude_unset=True))
        # 1. Update Profile table
        profile_data = {}
        if data.first_name: profile_data['first_name'] = data.first_name
        if data.last_name: profile_data['last_name'] = data.last_name
        if data.phone: profile_data['phone'] = data.phone
        if data.onboarding_completed is not None: profile_data['onboarding_completed'] = data.onboarding_completed
        
        if profile_data:
            await db.execute(
                update(Profile)
                .where(Profile.id == user_id)
                .values(**profile_data)
            )

        # 2. Update DoctorProfile table
        doctor_data = {}
        normalized_locations_payload: list[dict[str, Any]] = []
        
        # Helper to convert list of pydantic models to dicts
        def to_dict_list(items):
            if items is None: return None
            return [item.model_dump() if hasattr(item, 'model_dump') else (item.dict() if hasattr(item, 'dict') else item) for item in items]
        
        # Personal Identity
        if data.title: doctor_data['title'] = data.title
        if data.gender: doctor_data['gender'] = data.gender
        if data.dob: doctor_data['date_of_birth'] = datetime.strptime(data.dob, '%Y-%m-%d').date()
        if data.profile_photo_url is not None: doctor_data['profile_photo_url'] = data.profile_photo_url
        if data.profile_banner_url is not None: doctor_data['profile_banner_url'] = data.profile_banner_url
        if data.nid_number: doctor_data['nid_number'] = data.nid_number
        
        # Professional Credentials
        if data.registration_number: doctor_data['bmdc_number'] = data.registration_number
        if data.bmdc_document_url: doctor_data['bmdc_document_url'] = data.bmdc_document_url
        if data.qualifications: doctor_data['qualifications'] = data.qualifications
        if data.degree: doctor_data['degree'] = data.degree
        if data.degree_certificates_url: doctor_data['degree_certificates_url'] = data.degree_certificates_url
        if data.education is not None: doctor_data['education'] = to_dict_list(data.education)
        
        # Specialization
        if data.speciality_id is not None:
            doctor_data['speciality_id'] = data.speciality_id
            # Resolve the name and set specialization text
            try:
                spec_res = await db.execute(select(Speciality).where(Speciality.id == data.speciality_id))
                spec_row = spec_res.scalar_one_or_none()
                if spec_row:
                    doctor_data['specialization'] = spec_row.name
            except Exception:
                pass
        elif data.specialization:
            doctor_data['specialization'] = data.specialization
        if data.sub_specializations is not None: doctor_data['sub_specializations'] = data.sub_specializations
        if data.services is not None: doctor_data['services'] = data.services
        
        # Experience
        if data.experience: 
            try:
                doctor_data['years_of_experience'] = int(data.experience)
            except:
                pass
        if data.work_experience is not None: doctor_data['work_experience'] = to_dict_list(data.work_experience)
        
        # Practice Details
        if data.hospital_name: doctor_data['hospital_name'] = data.hospital_name
        if data.hospital_address: doctor_data['hospital_address'] = data.hospital_address
        if data.hospital_city: doctor_data['hospital_city'] = data.hospital_city
        if data.hospital_country: doctor_data['hospital_country'] = data.hospital_country
        if data.chamber_name: doctor_data['chamber_name'] = data.chamber_name
        if data.chamber_address: doctor_data['chamber_address'] = data.chamber_address
        if data.chamber_city: doctor_data['chamber_city'] = data.chamber_city
        if data.practice_location: doctor_data['practice_location'] = data.practice_location
        if data.consultation_mode: doctor_data['consultation_mode'] = data.consultation_mode
        if data.affiliation_letter_url: doctor_data['affiliation_letter_url'] = data.affiliation_letter_url
        if data.institution: doctor_data['institution'] = data.institution

        if data.practice_locations is not None:
            for idx, location in enumerate(data.practice_locations):
                location_name = (location.location_name or "").strip()
                address = (location.address or "").strip()
                city = (location.city or "").strip()
                country = (location.country or "Bangladesh").strip() or "Bangladesh"
                location_type = (location.location_type or "CHAMBER").strip().upper()
                composed_location_text = _compose_location_text(
                    location_name,
                    address,
                    city,
                    country,
                    location.location_text,
                )

                if not location_name and not composed_location_text:
                    continue

                if len(composed_location_text) < 5:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Location text for chamber #{idx + 1} must be at least 5 characters",
                    )

                latitude = location.latitude
                longitude = location.longitude
                display_name = (location.display_name or "").strip() or None
                geocode_source = "manual"

                if latitude is None or longitude is None:
                    geocode_result = await geocode_location_text_with_cache(db, composed_location_text)
                    if geocode_result:
                        latitude = float(geocode_result["lat"])
                        longitude = float(geocode_result["lng"])
                        display_name = str(geocode_result.get("display_name") or composed_location_text)
                        geocode_source = str(geocode_result.get("source") or "nominatim")

                if latitude is None or longitude is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Coordinates are required for '{location_name or composed_location_text}'",
                    )

                normalized_day_slots = _normalize_day_slots(location.day_time_slots)
                available_days = location.available_days or list(normalized_day_slots.keys())

                normalized_locations_payload.append(
                    {
                        "id": (location.id or "").strip() or None,
                        "location_name": location_name or composed_location_text,
                        "location_type": location_type,
                        "location_text": composed_location_text,
                        "display_name": display_name,
                        "address": address,
                        "city": city,
                        "country": country,
                        "latitude": float(latitude),
                        "longitude": float(longitude),
                        "geocode_source": geocode_source,
                        "available_days": available_days,
                        "day_time_slots": normalized_day_slots,
                        "appointment_duration": location.appointment_duration,
                        "is_primary": bool(location.is_primary) if location.is_primary is not None else idx == 0,
                    }
                )

            if normalized_locations_payload:
                primary = next((loc for loc in normalized_locations_payload if loc["is_primary"]), normalized_locations_payload[0])
                secondary = next((loc for loc in normalized_locations_payload if loc is not primary), None)

                doctor_data["hospital_name"] = primary["location_name"]
                doctor_data["hospital_address"] = primary["address"]
                doctor_data["hospital_city"] = primary["city"]
                doctor_data["hospital_country"] = primary["country"]
                doctor_data["hospital_latitude"] = primary["latitude"]
                doctor_data["hospital_longitude"] = primary["longitude"]
                doctor_data["latitude"] = primary["latitude"]
                doctor_data["longitude"] = primary["longitude"]
                doctor_data["available_days"] = primary["available_days"]
                doctor_data["day_time_slots"] = primary["day_time_slots"]
                if primary.get("appointment_duration"):
                    doctor_data["appointment_duration"] = primary["appointment_duration"]

                if secondary:
                    doctor_data["chamber_name"] = secondary["location_name"]
                    doctor_data["chamber_address"] = secondary["address"]
                    doctor_data["chamber_city"] = secondary["city"]
                    doctor_data["chamber_latitude"] = secondary["latitude"]
                    doctor_data["chamber_longitude"] = secondary["longitude"]
        
        # Consultation Setup
        if data.consultation_fee: 
            try:
                doctor_data['consultation_fee'] = float(data.consultation_fee)
            except:
                pass
        if data.follow_up_fee:
            try:
                doctor_data['follow_up_fee'] = float(data.follow_up_fee)
            except:
                pass
        if data.visiting_hours: doctor_data['visiting_hours'] = data.visiting_hours
        if data.available_days: doctor_data['available_days'] = data.available_days

        # Handle per-day time slots (new structure)
        if data.day_time_slots:
            normalized_day_slots = _normalize_day_slots(data.day_time_slots)
            doctor_data['day_time_slots'] = normalized_day_slots
            
            # Also set legacy fields for backwards compatibility
            if data.available_days and normalized_day_slots.get(data.available_days[0]):
                legacy_time_slots = ", ".join(normalized_day_slots[data.available_days[0]])
                doctor_data['time_slots'] = legacy_time_slots
        elif data.time_slots:
            normalized = _normalize_slot_text(data.time_slots)
            doctor_data['time_slots'] = normalized

        if data.appointment_duration is not None: doctor_data['appointment_duration'] = data.appointment_duration
        if data.emergency_availability is not None: doctor_data['emergency_availability'] = data.emergency_availability
        if data.emergency_contact: doctor_data['emergency_contact'] = data.emergency_contact
        
        # About & Bio
        if data.about: doctor_data['about'] = data.about
        
        # Preferences & Consent
        if data.language: doctor_data['language'] = data.language
        if data.languages_spoken is not None: doctor_data['languages_spoken'] = data.languages_spoken
        if data.case_types: doctor_data['case_types'] = data.case_types
        if data.ai_assistance is not None: doctor_data['ai_assistance'] = data.ai_assistance
        if data.allow_patient_ai_visibility is not None: doctor_data['allow_patient_ai_visibility'] = data.allow_patient_ai_visibility
        if data.terms_accepted is not None: doctor_data['terms_accepted'] = data.terms_accepted
        if data.telemedicine_available is not None: doctor_data['telemedicine_available'] = data.telemedicine_available
        if data.telemedicine_platforms is not None: doctor_data['telemedicine_platforms'] = data.telemedicine_platforms

        if doctor_data:
            result = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == user_id))
            if not result.scalar():
                new_profile = DoctorProfile(profile_id=user_id, **doctor_data)
                db.add(new_profile)
            else:
                await db.execute(
                    update(DoctorProfile)
                    .where(DoctorProfile.profile_id == user_id)
                    .values(**doctor_data)
                )

        if data.practice_locations is not None:
            existing_location_rows = (
                (
                    await db.execute(
                        select(DoctorLocation).where(DoctorLocation.doctor_id == user_id)
                    )
                )
                .scalars()
                .all()
            )
            existing_locations_by_id = {row.id: row for row in existing_location_rows}
            retained_location_ids: set[str] = set()

            # Reconcile-by-id to avoid deleting referenced locations that are tied to appointments.
            for location_payload in normalized_locations_payload:
                incoming_location_id = location_payload.get("id")
                existing_location = (
                    existing_locations_by_id.get(incoming_location_id) if incoming_location_id else None
                )
                normalized_location_text = " ".join(location_payload["location_text"].strip().lower().split())

                if existing_location is not None:
                    existing_location.location_name = location_payload["location_name"]
                    existing_location.location_type = location_payload["location_type"]
                    existing_location.location_text = location_payload["location_text"]
                    existing_location.normalized_location_text = normalized_location_text
                    existing_location.display_name = location_payload["display_name"]
                    existing_location.address = location_payload["address"]
                    existing_location.city = location_payload["city"]
                    existing_location.country = location_payload["country"]
                    existing_location.latitude = location_payload["latitude"]
                    existing_location.longitude = location_payload["longitude"]
                    existing_location.geocoded_at = datetime.utcnow()
                    existing_location.geocode_source = location_payload["geocode_source"]
                    existing_location.is_primary = location_payload["is_primary"]
                    existing_location.available_days = location_payload["available_days"]
                    existing_location.day_time_slots = location_payload["day_time_slots"]
                    existing_location.appointment_duration = location_payload.get("appointment_duration")
                    retained_location_ids.add(existing_location.id)
                    continue

                new_location_id = incoming_location_id or str(uuid.uuid4())
                retained_location_ids.add(new_location_id)
                db.add(
                    DoctorLocation(
                        id=new_location_id,
                        doctor_id=user_id,
                        location_name=location_payload["location_name"],
                        location_type=location_payload["location_type"],
                        location_text=location_payload["location_text"],
                        normalized_location_text=normalized_location_text,
                        display_name=location_payload["display_name"],
                        address=location_payload["address"],
                        city=location_payload["city"],
                        country=location_payload["country"],
                        latitude=location_payload["latitude"],
                        longitude=location_payload["longitude"],
                        geocoded_at=datetime.utcnow(),
                        geocode_source=location_payload["geocode_source"],
                        is_primary=location_payload["is_primary"],
                        available_days=location_payload["available_days"],
                        day_time_slots=location_payload["day_time_slots"],
                        appointment_duration=location_payload.get("appointment_duration"),
                    )
                )

            stale_location_ids = [
                row.id for row in existing_location_rows if row.id not in retained_location_ids
            ]
            if stale_location_ids:
                from app.db.models.appointment import Appointment
                from app.db.models.doctor_availability import (
                    DoctorAvailability,
                    DoctorException,
                    DoctorScheduleOverride,
                )

                referenced_location_ids: set[str] = set()
                appointment_refs = await db.execute(
                    select(Appointment.doctor_location_id).where(
                        Appointment.doctor_location_id.in_(stale_location_ids)
                    )
                )
                referenced_location_ids.update(
                    location_id for (location_id,) in appointment_refs.all() if location_id
                )

                availability_refs = await db.execute(
                    select(DoctorAvailability.doctor_location_id).where(
                        DoctorAvailability.doctor_location_id.in_(stale_location_ids)
                    )
                )
                referenced_location_ids.update(
                    location_id for (location_id,) in availability_refs.all() if location_id
                )

                exception_refs = await db.execute(
                    select(DoctorException.doctor_location_id).where(
                        DoctorException.doctor_location_id.in_(stale_location_ids)
                    )
                )
                referenced_location_ids.update(
                    location_id for (location_id,) in exception_refs.all() if location_id
                )

                override_refs = await db.execute(
                    select(DoctorScheduleOverride.doctor_location_id).where(
                        DoctorScheduleOverride.doctor_location_id.in_(stale_location_ids)
                    )
                )
                referenced_location_ids.update(
                    location_id for (location_id,) in override_refs.all() if location_id
                )

                removable_location_ids = [
                    location_id
                    for location_id in stale_location_ids
                    if location_id not in referenced_location_ids
                ]
                if removable_location_ids:
                    await db.execute(
                        delete(DoctorLocation).where(
                            DoctorLocation.doctor_id == user_id,
                            DoctorLocation.id.in_(removable_location_ids),
                        )
                    )

                if referenced_location_ids and retained_location_ids:
                    await db.execute(
                        update(DoctorLocation)
                        .where(
                            DoctorLocation.doctor_id == user_id,
                            DoctorLocation.id.in_(list(referenced_location_ids)),
                        )
                        .values(is_primary=False)
                    )
                    print(
                        f"Skipping deletion for referenced doctor_locations for doctor {user_id}: {sorted(referenced_location_ids)}"
                    )
        
        # Geocode addresses if they were provided in the update
        address_fields_updated = data.practice_locations is None and any([
            data.hospital_address is not None,
            data.hospital_city is not None, 
            data.hospital_name is not None,
            data.chamber_address is not None,
            data.chamber_city is not None,
            data.chamber_name is not None
        ])
        
        if address_fields_updated:
            print(f"Address fields updated for doctor {user_id}, triggering geocoding...")
            try:
                geocode_result = await geocode_and_save_doctor_locations(db, user_id, force_regeocode=True)
                print(f"Geocoding completed for doctor {user_id}: {geocode_result}")
            except Exception as geocode_error:
                print(f"Geocoding failed for doctor {user_id}: {geocode_error}")
                # Don't fail the entire onboarding if geocoding fails
                # Just log the error and continue
        
        await db.commit()
        # Debug: show updated speciality_id
        updated = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == user_id))
        updated_doc = updated.scalar_one_or_none()
        print("Doctor profile after update (speciality_id):", getattr(updated_doc, 'speciality_id', None))
        return {"message": "Profile updated successfully"}
    except Exception as e:
        await db.rollback()
        print(f"Error updating doctor profile: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/complete-onboarding")
async def complete_onboarding(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    user_id = user.id
    await db.execute(
        update(Profile)
        .where(Profile.id == user_id)
        .values(onboarding_completed=True)
    )
    await db.commit()
    return {"message": "Onboarding completed"}


def _resolve_ai_preferences(patient: PatientProfile) -> tuple[bool, bool, bool]:
    personal_enabled = bool(getattr(patient, "ai_personal_context_enabled", patient.consent_ai))
    general_enabled = bool(getattr(patient, "ai_general_chat_enabled", patient.consent_ai))
    legacy_consent = bool(personal_enabled or general_enabled)
    return personal_enabled, general_enabled, legacy_consent


@router.get("/patient/ai-access", response_model=PatientAIAccessResponse)
async def get_patient_ai_access(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    user_id = user.id
    patient_result = await db.execute(
        select(PatientProfile).where(PatientProfile.profile_id == user_id)
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient medical profile not found")

    personal_enabled, general_enabled, legacy_consent = _resolve_ai_preferences(patient)
    return PatientAIAccessResponse(
        ai_personal_context_enabled=personal_enabled,
        ai_general_chat_enabled=general_enabled,
        consent_ai=legacy_consent,
    )


@router.patch("/patient/ai-access", response_model=PatientAIAccessResponse)
async def update_patient_ai_access(
    data: PatientAIAccessUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    user_id = user.id
    patient_result = await db.execute(
        select(PatientProfile).where(PatientProfile.profile_id == user_id)
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient medical profile not found")

    current_personal, current_general, _ = _resolve_ai_preferences(patient)
    next_personal = current_personal if data.ai_personal_context_enabled is None else bool(data.ai_personal_context_enabled)
    next_general = current_general if data.ai_general_chat_enabled is None else bool(data.ai_general_chat_enabled)

    await db.execute(
        update(PatientProfile)
        .where(PatientProfile.profile_id == user_id)
        .values(
            ai_personal_context_enabled=next_personal,
            ai_general_chat_enabled=next_general,
            # Keep legacy field consistent for older clients/routes.
            consent_ai=bool(next_personal or next_general),
        )
    )
    await db.commit()

    return PatientAIAccessResponse(
        ai_personal_context_enabled=next_personal,
        ai_general_chat_enabled=next_general,
        consent_ai=bool(next_personal or next_general),
    )

@router.get("/patient/onboarding")
async def get_patient_onboarding_data(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get patient profile data for onboarding pre-fill"""
    user_id = user.id
    
    # Get base profile
    profile_result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = profile_result.scalar()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Get patient profile
    patient_result = await db.execute(
        select(PatientProfile).where(PatientProfile.profile_id == user_id)
    )
    patient = patient_result.scalar()
    avatar_url = await _ensure_patient_avatar(db, user_id, patient)
    
    # Build response with all fields for pre-fill
    response = {
        # From Profile table
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": profile.email,
        "phone": profile.phone,
        "onboarding_completed": profile.onboarding_completed,
    }

    def _normalized_medical_tests_for_response(items):
        normalized = []
        allowed = {"pending", "completed", "skipped"}
        for raw in (items or []):
            if not isinstance(raw, dict):
                continue
            item = dict(raw)
            result_text = str(item.get("result") or "").strip()
            incoming_status = str(item.get("status") or "").strip().lower()
            item["status"] = incoming_status if incoming_status in allowed else ("completed" if result_text else "pending")
            normalized.append(item)
        return normalized
    
    if patient:
        response.update({
            # Basic Identity
            "dob": str(patient.date_of_birth) if patient.date_of_birth else None,
            "gender": patient.gender,
            "profile_photo_url": avatar_url,
            "profile_banner_url": getattr(patient, "profile_banner_url", None),
            "nid_number": patient.nid_number,
            
            # Contact & Address
            "address": patient.address,
            "city": patient.city,
            "district": patient.district,
            "postal_code": patient.postal_code,
            "country": patient.country,
            
            # Physical & Demographic
            "height": patient.height,
            "weight": patient.weight,
            "blood_group": patient.blood_group,
            "marital_status": patient.marital_status,
            "occupation": patient.occupation,
            "medical_summary_url": patient.medical_summary_url,
            
            # Known Conditions
            "has_conditions": "yes" if patient.has_conditions else "no",
            "conditions": patient.conditions or [],
            "has_diabetes": patient.has_diabetes,
            "has_hypertension": patient.has_hypertension,
            "has_heart_disease": patient.has_heart_disease,
            "has_asthma": patient.has_asthma,
            "has_kidney_disease": patient.has_kidney_disease,
            "has_liver_disease": patient.has_liver_disease,
            "has_thyroid": patient.has_thyroid,
            "has_neurological": patient.has_neurological,
            "has_cancer": getattr(patient, 'has_cancer', False),
            "has_arthritis": getattr(patient, 'has_arthritis', False),
            "has_stroke": getattr(patient, 'has_stroke', False),
            "has_epilepsy": getattr(patient, 'has_epilepsy', False),
            "has_mental_health": getattr(patient, 'has_mental_health', False),
            "chronic_conditions_notes": patient.chronic_conditions_notes,
            "other_conditions": getattr(patient, 'other_conditions', None),
            "condition_details": getattr(patient, 'condition_details', None),
            
            # Medications & Allergies
            "taking_meds": "yes" if patient.taking_meds else "no",
            "medications": patient.medications or [],
            "allergies": patient.allergies,
            "allergy_reaction": patient.allergy_reaction,
            "drug_allergies": patient.drug_allergies or [],
            "food_allergies": patient.food_allergies,
            "environmental_allergies": patient.environmental_allergies,
            
            # Medical History
            "past_surgeries": "yes" if patient.past_surgeries else "no",
            "surgery_description": patient.surgery_description,
            "surgeries": patient.surgeries or [],
            "ongoing_treatments": "yes" if patient.ongoing_treatments else "no",
            "treatment_description": patient.treatment_description,
            "ongoing_treatment_details": getattr(patient, 'ongoing_treatment_details', None),
            "hospitalizations": patient.hospitalizations or [],
            "has_medical_tests": "yes" if getattr(patient, 'has_medical_tests', False) else "no",
            "medical_tests": _normalized_medical_tests_for_response(getattr(patient, 'medical_tests', None) or []),
            "previous_doctors": getattr(patient, 'previous_doctors', None),
            "last_checkup_date": getattr(patient, 'last_checkup_date', None),
            
            # Family History
            "family_has_diabetes": patient.family_has_diabetes,
            "family_has_hypertension": patient.family_has_hypertension,
            "family_has_heart_disease": patient.family_has_heart_disease,
            "family_has_cancer": patient.family_has_cancer,
            "family_has_stroke": patient.family_has_stroke,
            "family_has_asthma": patient.family_has_asthma,
            "family_has_thalassemia": patient.family_has_thalassemia,
            "family_has_blood_disorders": patient.family_has_blood_disorders,
            "family_has_mental_health": getattr(patient, 'family_has_mental_health', False),
            "family_has_kidney_disease": getattr(patient, 'family_has_kidney_disease', False),
            "family_has_thyroid": getattr(patient, 'family_has_thyroid', False),
            "family_history_notes": patient.family_history_notes,
            
            # Lifestyle
            "smoking": patient.smoking,
            "smoking_details": patient.smoking_details,
            "smoking_amount": getattr(patient, 'smoking_amount', None),
            "alcohol": patient.alcohol,
            "alcohol_details": patient.alcohol_details,
            "alcohol_frequency": getattr(patient, 'alcohol_frequency', None),
            "tobacco_use": patient.tobacco_use,
            "drug_use": patient.drug_use,
            "caffeine": getattr(patient, 'caffeine', None),
            "dietary_restrictions": getattr(patient, 'dietary_restrictions', None),
            "activity_level": patient.activity_level,
            "exercise_type": patient.exercise_type,
            "exercise_frequency": patient.exercise_frequency,
            "sleep_duration": patient.sleep_duration,
            "sleep_quality": patient.sleep_quality,
            "diet": patient.diet,
            "diet_restrictions": patient.diet_restrictions,
            "water_intake": patient.water_intake,
            "stress_level": patient.stress_level,
            "mental_health_history": patient.mental_health_history,
            "mental_health_concerns": getattr(patient, 'mental_health_concerns', None),
            "currently_in_therapy": getattr(patient, 'currently_in_therapy', False),
            
            # Vaccination
            "vaccination_status": patient.vaccination_status,
            "vaccinations": patient.vaccinations or [],
            "has_epi_vaccination": patient.has_epi_vaccination,
            "has_covid_vaccination": patient.has_covid_vaccination,
            "covid_vaccine_doses": patient.covid_vaccine_doses,
            "has_hepatitis_vaccination": patient.has_hepatitis_vaccination,
            "has_tb_vaccination": patient.has_tb_vaccination,
            "has_tt_vaccination": patient.has_tt_vaccination,
            
            # Preferences & Consent
            "language": patient.language,
            "preferred_language": patient.preferred_language,
            "languages_spoken": getattr(patient, 'languages_spoken', []) or [],
            "preferred_contact_method": getattr(patient, 'preferred_contact_method', None),
            "notifications": patient.notifications,
            "notification_preferences": patient.notification_preferences or [],
            "emergency_name": patient.emergency_name,
            "emergency_relation": patient.emergency_relation,
            "emergency_phone": patient.emergency_phone,
            "emergency_address": patient.emergency_address,
            "secondary_emergency_name": getattr(patient, 'secondary_emergency_name', None),
            "secondary_emergency_phone": getattr(patient, 'secondary_emergency_phone', None),
            "consent_storage": patient.consent_storage,
            "consent_ai": patient.consent_ai,
            "ai_personal_context_enabled": getattr(patient, 'ai_personal_context_enabled', patient.consent_ai),
            "ai_general_chat_enabled": getattr(patient, 'ai_general_chat_enabled', patient.consent_ai),
            "consent_doctor": patient.consent_doctor,
            "consent_research": patient.consent_research,
        })
    
    return response

@router.get("/doctor/onboarding")
async def get_doctor_onboarding_data(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get doctor profile data for onboarding pre-fill"""
    user_id = user.id
    
    # Get base profile
    profile_result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = profile_result.scalar()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Get doctor profile
    doctor_result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.profile_id == user_id)
    )
    doctor = doctor_result.scalar()
    avatar_url = await _ensure_doctor_avatar(db, user_id, doctor)
    
    # Build response with all fields for pre-fill
    response = {
        # From Profile table
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": profile.email,
        "phone": profile.phone,
        "onboarding_completed": profile.onboarding_completed,
    }
    
    if doctor:
        location_rows = (
            (
                await db.execute(
                    select(DoctorLocation)
                    .where(DoctorLocation.doctor_id == user_id)
                    .order_by(DoctorLocation.is_primary.desc(), DoctorLocation.created_at.asc())
                )
            )
            .scalars()
            .all()
        )
        practice_locations = [
            {
                "id": location.id,
                "location_name": location.location_name,
                "location_type": location.location_type,
                "location_text": location.location_text,
                "display_name": location.display_name,
                "address": location.address,
                "city": location.city,
                "country": location.country,
                "latitude": location.latitude,
                "longitude": location.longitude,
                "available_days": location.available_days or [],
                "day_time_slots": location.day_time_slots or {},
                "appointment_duration": location.appointment_duration,
                "is_primary": location.is_primary,
            }
            for location in location_rows
        ]

        # Resolve speciality name if a speciality_id is set
        speciality_name = None
        if getattr(doctor, 'speciality_id', None):
            spec_res = await db.execute(select(Speciality).where(Speciality.id == doctor.speciality_id))
            spec_row = spec_res.scalar_one_or_none()
            if spec_row:
                speciality_name = spec_row.name

        response.update({
            # Personal Identity
            "title": doctor.title,
            "gender": doctor.gender,
            "dob": str(doctor.date_of_birth) if doctor.date_of_birth else None,
            "profile_photo_url": avatar_url,
            "profile_banner_url": getattr(doctor, "profile_banner_url", None),
            "nid_number": doctor.nid_number,
            
            # Professional Credentials
            "registration_number": doctor.bmdc_number,
            "bmdc_document_url": doctor.bmdc_document_url,
            "qualifications": doctor.qualifications,
            "degree": doctor.degree,
            "degree_certificates_url": doctor.degree_certificates_url,
            "education": doctor.education or [],
            
            # Specialization
            "speciality_id": doctor.speciality_id,
            "specialization": doctor.specialization,
            "speciality_name": speciality_name or doctor.specialization,
            "sub_specializations": doctor.sub_specializations or [],
            "services": doctor.services or [],
            
            # Experience
            "experience": str(doctor.years_of_experience) if doctor.years_of_experience else "",
            "work_experience": doctor.work_experience or [],
            
            # Practice Details
            "hospital_name": doctor.hospital_name,
            "hospital_address": doctor.hospital_address,
            "hospital_city": doctor.hospital_city,
            "hospital_country": doctor.hospital_country,
            "chamber_name": doctor.chamber_name,
            "chamber_address": doctor.chamber_address,
            "chamber_city": doctor.chamber_city,
            "practice_location": doctor.practice_location,
            "consultation_mode": doctor.consultation_mode,
            "affiliation_letter_url": doctor.affiliation_letter_url,
            "institution": doctor.institution,
            "practice_locations": practice_locations,
            
            # Consultation Setup
            "consultation_fee": str(doctor.consultation_fee) if doctor.consultation_fee else "",
            "follow_up_fee": str(doctor.follow_up_fee) if doctor.follow_up_fee else "",
            "visiting_hours": doctor.visiting_hours,
            "available_days": doctor.available_days or [],
            "time_slots": doctor.time_slots,
            "day_time_slots": getattr(doctor, 'day_time_slots', None) or {},
            "appointment_duration": doctor.appointment_duration,
            "emergency_availability": doctor.emergency_availability,
            "emergency_contact": doctor.emergency_contact,
            
            # About & Bio
            "about": doctor.about,
            
            # Preferences & Consent
            "language": doctor.language,
            "languages_spoken": doctor.languages_spoken or [],
            "case_types": doctor.case_types,
            "ai_assistance": doctor.ai_assistance,
            "allow_patient_ai_visibility": getattr(doctor, "allow_patient_ai_visibility", True),
            "terms_accepted": doctor.terms_accepted,
            "telemedicine_available": doctor.telemedicine_available,
            "telemedicine_platforms": doctor.telemedicine_platforms or [],
        })
    
    return response

@router.get("/patient/profile")
async def get_patient_profile(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get complete patient profile"""
    user_id = user.id
    result = await db.execute(
        select(Profile, PatientProfile)
        .join(PatientProfile, Profile.id == PatientProfile.profile_id)
        .where(Profile.id == user_id)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile, patient = row
    return {
        "profile": {
            "id": profile.id,
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "email": profile.email,
            "phone": profile.phone,
            "role": profile.role,
            "onboarding_completed": profile.onboarding_completed
        },
        "patient_data": {
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender,
            "blood_group": patient.blood_group,
            "allergies": patient.allergies,
            "height": patient.height,
            "weight": patient.weight,
            "city": patient.city,
            "country": patient.country,
            "occupation": patient.occupation,
            "marital_status": patient.marital_status,
            "has_conditions": patient.has_conditions,
            "conditions": patient.conditions,
            "taking_meds": patient.taking_meds,
            "medications": patient.medications,
        }
    }

@router.get("/doctor/profile")
async def get_doctor_profile(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get complete doctor profile - flattened for easy consumption"""
    user_id = user.id
    
    # Get base profile
    profile_result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = profile_result.scalar()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Get doctor profile
    doctor_result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.profile_id == user_id)
    )
    doctor = doctor_result.scalar()
    avatar_url = await _ensure_doctor_avatar(db, user_id, doctor)
    
    # Build flattened response
    response = {
        # From Profile table
        "id": profile.id,
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": profile.email,
        "phone": profile.phone,
        "role": profile.role,
        "verification_status": profile.verification_status,
        "onboarding_completed": profile.onboarding_completed,
    }
    
    if doctor:
        location_rows = (
            (
                await db.execute(
                    select(DoctorLocation)
                    .where(DoctorLocation.doctor_id == user_id)
                    .order_by(DoctorLocation.is_primary.desc(), DoctorLocation.created_at.asc())
                )
            )
            .scalars()
            .all()
        )
        practice_locations = [
            {
                "id": location.id,
                "location_name": location.location_name,
                "location_type": location.location_type,
                "location_text": location.location_text,
                "display_name": location.display_name,
                "address": location.address,
                "city": location.city,
                "country": location.country,
                "latitude": location.latitude,
                "longitude": location.longitude,
                "available_days": location.available_days or [],
                "day_time_slots": location.day_time_slots or {},
                "appointment_duration": location.appointment_duration,
                "is_primary": location.is_primary,
            }
            for location in location_rows
        ]

        # Resolve speciality name if `speciality_id` is present
        speciality_name = None
        if getattr(doctor, 'speciality_id', None):
            spec_res = await db.execute(select(Speciality).where(Speciality.id == doctor.speciality_id))
            spec_row = spec_res.scalar_one_or_none()
            if spec_row:
                speciality_name = spec_row.name

        response.update({
            # Personal Identity
            "title": doctor.title,
            "gender": doctor.gender,
            "date_of_birth": str(doctor.date_of_birth) if doctor.date_of_birth else None,
            "profile_photo_url": avatar_url,
            "profile_banner_url": getattr(doctor, "profile_banner_url", None),
            "nid_number": doctor.nid_number,
            
            # Professional Credentials
            "bmdc_number": doctor.bmdc_number,
            "bmdc_verified": doctor.bmdc_verified,
            "bmdc_document_url": doctor.bmdc_document_url,
            "qualifications": doctor.qualifications,
            "degree": doctor.degree,
            "degree_certificates_url": doctor.degree_certificates_url,
            "education": doctor.education or [],
            
            # Specialization
            "speciality_id": doctor.speciality_id,
            "specialization": doctor.specialization,
            "speciality_name": speciality_name or doctor.specialization,
            "sub_specializations": doctor.sub_specializations or [],
            "services": doctor.services or [],
            
            # Experience
            "years_of_experience": doctor.years_of_experience,
            "work_experience": doctor.work_experience or [],
            
            # Practice Details & Locations
            "hospital_name": doctor.hospital_name,
            "hospital_address": doctor.hospital_address,
            "hospital_city": doctor.hospital_city,
            "hospital_country": doctor.hospital_country,
            "chamber_name": doctor.chamber_name,
            "chamber_address": doctor.chamber_address,
            "chamber_city": doctor.chamber_city,
            "practice_location": doctor.practice_location,
            "consultation_mode": doctor.consultation_mode,
            "affiliation_letter_url": doctor.affiliation_letter_url,
            "institution": doctor.institution,
            "practice_locations": practice_locations,
            
            # Consultation Setup
            "consultation_fee": doctor.consultation_fee,
            "follow_up_fee": doctor.follow_up_fee,
            "total_revenue": float(doctor.total_revenue or 0.0),
            "visiting_hours": doctor.visiting_hours,
            "available_days": doctor.available_days or [],
            "time_slots": doctor.time_slots,
            "day_time_slots": getattr(doctor, 'day_time_slots', None) or {},
            "appointment_duration": doctor.appointment_duration,
            "emergency_availability": doctor.emergency_availability,
            "emergency_contact": doctor.emergency_contact,
            
            # About & Bio
            "about": doctor.about,
            
            # Preferences & Consent
            "language": doctor.language,
            "languages_spoken": doctor.languages_spoken or [],
            "case_types": doctor.case_types,
            "ai_assistance": doctor.ai_assistance,
            "terms_accepted": doctor.terms_accepted,
            "telemedicine_available": doctor.telemedicine_available,
            "telemedicine_platforms": doctor.telemedicine_platforms or [],
        })
    
    return response


@router.patch("/doctor/update")
async def update_doctor_profile(
    data: DoctorOnboardingUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update doctor profile - can be used both during and after onboarding"""
    user_id = user.id
    
    try:
        # Debug log incoming data
        print(" Received doctor update payload:", data.model_dump(exclude_unset=True))
        # 1. Update Profile table (common fields)
        profile_data = {}
        if data.first_name: profile_data['first_name'] = data.first_name
        if data.last_name: profile_data['last_name'] = data.last_name
        if data.phone: profile_data['phone'] = data.phone
        if data.onboarding_completed is not None: profile_data['onboarding_completed'] = data.onboarding_completed
        
        if profile_data:
            await db.execute(
                update(Profile)
                .where(Profile.id == user_id)
                .values(**profile_data)
            )

        # 2. Update DoctorProfile table
        doctor_data = {}
        
        # Helper to convert list of pydantic models to dicts
        def to_dict_list(items):
            if items is None: return None
            return [item.model_dump() if hasattr(item, 'model_dump') else (item.dict() if hasattr(item, 'dict') else item) for item in items]
        
        # Personal Identity
        if data.title: doctor_data['title'] = data.title
        if data.gender: doctor_data['gender'] = data.gender
        if data.dob: 
            doctor_data['date_of_birth'] = datetime.strptime(data.dob, '%Y-%m-%d').date()
        if data.profile_photo_url is not None: doctor_data['profile_photo_url'] = data.profile_photo_url
        if data.profile_banner_url is not None: doctor_data['profile_banner_url'] = data.profile_banner_url
        if data.nid_number: doctor_data['nid_number'] = data.nid_number
        
        # Professional Credentials
        if data.registration_number: doctor_data['bmdc_number'] = data.registration_number
        if data.bmdc_document_url: doctor_data['bmdc_document_url'] = data.bmdc_document_url
        if data.qualifications: doctor_data['qualifications'] = data.qualifications
        if data.degree: doctor_data['degree'] = data.degree
        if data.degree_certificates_url: doctor_data['degree_certificates_url'] = data.degree_certificates_url
        if data.education is not None: doctor_data['education'] = to_dict_list(data.education)
        
        # Specialization
        if data.speciality_id is not None:
            doctor_data['speciality_id'] = data.speciality_id
            # Resolve the name and set specialization text
            try:
                spec_res = await db.execute(select(Speciality).where(Speciality.id == data.speciality_id))
                spec_row = spec_res.scalar_one_or_none()
                if spec_row:
                    doctor_data['specialization'] = spec_row.name
            except Exception:
                pass
        elif data.specialization:
            doctor_data['specialization'] = data.specialization
        if data.sub_specializations is not None: doctor_data['sub_specializations'] = data.sub_specializations
        if data.services is not None: doctor_data['services'] = data.services
        
        # Experience
        if data.experience: doctor_data['years_of_experience'] = int(data.experience)
        if data.work_experience is not None: doctor_data['work_experience'] = to_dict_list(data.work_experience)
        
        # Practice Details
        if data.hospital_name: doctor_data['hospital_name'] = data.hospital_name
        if data.hospital_address: doctor_data['hospital_address'] = data.hospital_address
        if data.hospital_city: doctor_data['hospital_city'] = data.hospital_city
        if data.hospital_country: doctor_data['hospital_country'] = data.hospital_country
        if data.chamber_name: doctor_data['chamber_name'] = data.chamber_name
        if data.chamber_address: doctor_data['chamber_address'] = data.chamber_address
        if data.chamber_city: doctor_data['chamber_city'] = data.chamber_city
        if data.practice_location: doctor_data['practice_location'] = data.practice_location
        if data.consultation_mode: doctor_data['consultation_mode'] = data.consultation_mode
        if data.affiliation_letter_url: doctor_data['affiliation_letter_url'] = data.affiliation_letter_url
        if data.institution: doctor_data['institution'] = data.institution
        
        # Consultation Setup
        if data.consultation_fee: doctor_data['consultation_fee'] = int(data.consultation_fee)
        if data.follow_up_fee: doctor_data['follow_up_fee'] = int(data.follow_up_fee)
        if data.visiting_hours: doctor_data['visiting_hours'] = data.visiting_hours
        if data.available_days is not None: doctor_data['available_days'] = data.available_days
        if data.time_slots: doctor_data['time_slots'] = data.time_slots
        if data.appointment_duration: doctor_data['appointment_duration'] = data.appointment_duration
        if data.emergency_availability is not None: doctor_data['emergency_availability'] = data.emergency_availability
        if data.emergency_contact: doctor_data['emergency_contact'] = data.emergency_contact
        
        # About & Bio
        if data.about: doctor_data['about'] = data.about
        
        # Preferences
        if data.language: doctor_data['language'] = data.language
        if data.languages_spoken is not None: doctor_data['languages_spoken'] = data.languages_spoken
        if data.case_types: doctor_data['case_types'] = data.case_types
        if data.ai_assistance is not None: doctor_data['ai_assistance'] = data.ai_assistance
        if data.allow_patient_ai_visibility is not None: doctor_data['allow_patient_ai_visibility'] = data.allow_patient_ai_visibility
        if data.terms_accepted is not None: doctor_data['terms_accepted'] = data.terms_accepted
        if data.telemedicine_available is not None: doctor_data['telemedicine_available'] = data.telemedicine_available
        if data.telemedicine_platforms is not None: doctor_data['telemedicine_platforms'] = data.telemedicine_platforms
        
        # Update DoctorProfile
        if doctor_data:
            await db.execute(
                update(DoctorProfile)
                .where(DoctorProfile.profile_id == user_id)
                .values(**doctor_data)
            )

        await db.commit()
        
        # Debug: show updated speciality_id
        updated = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == user_id))
        updated_doc = updated.scalar_one_or_none()
        print(" Doctor profile after update (speciality_id):", getattr(updated_doc, 'speciality_id', None))
        
        return {"success": True, "message": "Profile updated successfully"}
        
    except Exception as e:
        await db.rollback()
        print(f"Error updating doctor profile: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


@router.patch("/doctor/schedule")
async def update_doctor_schedule(
    day_time_slots: dict[str, List[str]],  # NEW: per-day schedules
    appointment_duration: int,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Update doctor's schedule with per-day time slots.
    
    Args:
        day_time_slots: Dictionary mapping day names to arrays of time slot strings
                       Example: {"Friday": ["9:00 AM - 1:00 PM"], "Saturday": ["2:00 PM - 5:00 PM", "7:00 PM - 9:00 PM"]}
        appointment_duration: Minutes per appointment (15, 20, 30, 45, or 60)
    """
    user_id = user.id
    
    try:
        # Verify user is a doctor
        result = await db.execute(select(Profile).where(Profile.id == user_id))
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        role_str = str(profile.role).upper()
        if "DOCTOR" not in role_str:
            raise HTTPException(status_code=403, detail="Only doctors can update schedules")
        
        # Validate inputs
        if not day_time_slots or len(day_time_slots) == 0:
            raise HTTPException(status_code=400, detail="At least one day with time slots is required")
        
        if appointment_duration not in [15, 20, 30, 45, 60]:
            raise HTTPException(status_code=400, detail="Invalid appointment duration")
        
        # Extract available days from the keys
        available_days = list(day_time_slots.keys())
        
        # Normalize time slot strings in the dictionary
        def normalize_time_slots_str(s: str) -> str:
            if not s:
                return s
            s = s.strip()
            # Normalize comma spacing
            s = re.sub(r"\s*,\s*", ", ", s)
            # Ensure space before AM/PM if attached to digits (e.g., '12Pm' -> '12 Pm')
            s = re.sub(r"(\d)([AaPp][Mm])", r"\1 \2", s)
            # Uppercase AM/PM
            s = re.sub(r"(?i)\bam\b", "AM", s)
            s = re.sub(r"(?i)\bpm\b", "PM", s)
            return s.strip()

        normalized_day_slots = {}
        for day, slots in day_time_slots.items():
            normalized_day_slots[day] = [normalize_time_slots_str(slot) for slot in slots if slot]
        
        # Also maintain legacy time_slots field (first day's first slot for backwards compatibility)
        legacy_time_slots = ""
        if available_days and normalized_day_slots.get(available_days[0]):
            legacy_time_slots = ", ".join(normalized_day_slots[available_days[0]])

        # Update doctor profile with new day_time_slots structure
        await db.execute(
            update(DoctorProfile)
            .where(DoctorProfile.profile_id == user_id)
            .values(
                available_days=available_days,
                day_time_slots=normalized_day_slots,
                time_slots=legacy_time_slots,  # Legacy field
                normalized_time_slots=legacy_time_slots,  # Legacy field
                time_slots_needs_review=False,
                appointment_duration=appointment_duration
            )
        )
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Schedule updated successfully",
            "available_days": available_days,
            "day_time_slots": normalized_day_slots,
            "appointment_duration": appointment_duration,
            "needs_review": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error updating schedule: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to update schedule: {str(e)}")
