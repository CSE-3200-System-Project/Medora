from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.patient import PatientProfile
from app.db.models.doctor import DoctorProfile
from app.db.models.speciality import Speciality
from app.db.models.profile import Profile
from app.db.models.enums import VerificationStatus, UserRole
from app.schemas.onboarding import PatientOnboardingUpdate, DoctorOnboardingUpdate
from app.services.geocoding import geocode_and_save_doctor_locations
from typing import Optional, List, Dict, Any
from datetime import datetime
import traceback
import re

router = APIRouter()

@router.get("/verification-status")
async def get_verification_status(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get user verification status"""
    result = await db.execute(
        select(Profile).where(Profile.id == user.id)
    )
    profile = result.scalar_one_or_none()
    
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
        if data.medical_tests is not None: patient_data['medical_tests'] = to_dict_list(data.medical_tests)
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
        if data.consent_ai is not None: patient_data['consent_ai'] = data.consent_ai
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
            def _normalize(s: str) -> str:
                s = (s or "").strip()
                s = re.sub(r"\s*,\s*", ", ", s)
                s = re.sub(r"(\d)(AM|PM|am|pm|Am|aM|Pm|pM)", r"\1 \2", s)
                s = re.sub(r"(?i)\bam\b", "AM", s)
                s = re.sub(r"(?i)\bpm\b", "PM", s)
                return s.strip()
            
            normalized_day_slots = {}
            for day, slots in data.day_time_slots.items():
                normalized_day_slots[day] = [_normalize(slot) for slot in slots if slot]
            
            doctor_data['day_time_slots'] = normalized_day_slots
            
            # Also set legacy fields for backwards compatibility
            if data.available_days and normalized_day_slots.get(data.available_days[0]):
                legacy_time_slots = ", ".join(normalized_day_slots[data.available_days[0]])
                doctor_data['time_slots'] = legacy_time_slots
        elif data.time_slots:
            # Legacy single time_slots field support
            def _normalize(s: str) -> str:
                s = (s or "").strip()
                s = re.sub(r"\s*,\s*", ", ", s)
                s = re.sub(r"(\d)(AM|PM|am|pm|Am|aM|Pm|pM)", r"\1 \2", s)
                s = re.sub(r"(?i)\bam\b", "AM", s)
                s = re.sub(r"(?i)\bpm\b", "PM", s)
                return s.strip()

            normalized = _normalize(data.time_slots)
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
        
        # Geocode addresses if they were provided in the update
        address_fields_updated = any([
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
    
    # Build response with all fields for pre-fill
    response = {
        # From Profile table
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": profile.email,
        "phone": profile.phone,
        "onboarding_completed": profile.onboarding_completed,
    }
    
    if patient:
        response.update({
            # Basic Identity
            "dob": str(patient.date_of_birth) if patient.date_of_birth else None,
            "gender": patient.gender,
            "profile_photo_url": patient.profile_photo_url,
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
            "medical_tests": getattr(patient, 'medical_tests', None) or [],
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
            "profile_photo_url": doctor.profile_photo_url,
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
            "profile_photo_url": doctor.profile_photo_url,
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
            
            # Consultation Setup
            "consultation_fee": doctor.consultation_fee,
            "follow_up_fee": doctor.follow_up_fee,
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
        if data.locations is not None: doctor_data['locations'] = to_dict_list(data.locations)
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
            "needs_review": needs_review
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error updating schedule: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to update schedule: {str(e)}")
