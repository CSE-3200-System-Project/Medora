from sqlalchemy import String, Date, Float, Boolean, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date, datetime
from app.db.base import Base

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    profile_id: Mapped[str] = mapped_column(String, primary_key=True)

    # === BASIC IDENTITY (Step 1) ===
    date_of_birth: Mapped[date | None]
    gender: Mapped[str | None]
    profile_photo_url: Mapped[str | None]
    profile_banner_url: Mapped[str | None]
    nid_number: Mapped[str | None]  # National ID
    
    # === CONTACT & ADDRESS (Step 2) ===
    address: Mapped[str | None]
    city: Mapped[str | None]
    district: Mapped[str | None]  # For Bangladesh context
    postal_code: Mapped[str | None]
    country: Mapped[str | None] = mapped_column(String, default="Bangladesh")
    
    # === PHYSICAL & DEMOGRAPHIC (Step 2) ===
    height: Mapped[float | None]  # in cm
    weight: Mapped[float | None]  # in kg
    blood_group: Mapped[str | None]
    marital_status: Mapped[str | None]  # single, married, divorced, widowed
    occupation: Mapped[str | None]
    medical_summary_url: Mapped[str | None]

    # === KNOWN CONDITIONS (Step 3) ===
    has_conditions: Mapped[bool] = mapped_column(Boolean, default=False)
    # Structured conditions: [{name, year, treating, notes}]
    conditions: Mapped[list | None] = mapped_column(JSON)
    
    # Chronic conditions checkboxes (common conditions)
    has_diabetes: Mapped[bool] = mapped_column(Boolean, default=False)
    has_hypertension: Mapped[bool] = mapped_column(Boolean, default=False)
    has_heart_disease: Mapped[bool] = mapped_column(Boolean, default=False)
    has_asthma: Mapped[bool] = mapped_column(Boolean, default=False)
    has_kidney_disease: Mapped[bool] = mapped_column(Boolean, default=False)
    has_liver_disease: Mapped[bool] = mapped_column(Boolean, default=False)
    has_thyroid: Mapped[bool] = mapped_column(Boolean, default=False)
    has_neurological: Mapped[bool] = mapped_column(Boolean, default=False)
    has_cancer: Mapped[bool] = mapped_column(Boolean, default=False)
    has_arthritis: Mapped[bool] = mapped_column(Boolean, default=False)
    has_stroke: Mapped[bool] = mapped_column(Boolean, default=False)
    has_epilepsy: Mapped[bool] = mapped_column(Boolean, default=False)
    has_mental_health: Mapped[bool] = mapped_column(Boolean, default=False)
    chronic_conditions_notes: Mapped[str | None] = mapped_column(Text)
    other_conditions: Mapped[str | None] = mapped_column(Text)
    condition_details: Mapped[str | None] = mapped_column(Text)

    # === MEDICATIONS & ALLERGIES (Step 4) ===
    taking_meds: Mapped[bool] = mapped_column(Boolean, default=False)
    # Medications: [{name, dosage, frequency, duration, generic_name, prescribing_doctor}]
    medications: Mapped[list | None] = mapped_column(JSON)
    
    allergies: Mapped[str | None]
    allergy_reaction: Mapped[str | None]
    # Drug allergies list: [{drug_name, reaction, severity}]
    drug_allergies: Mapped[list | None] = mapped_column(JSON)
    food_allergies: Mapped[str | None]
    environmental_allergies: Mapped[str | None]

    # === MEDICAL HISTORY (Step 5) ===
    past_surgeries: Mapped[bool] = mapped_column(Boolean, default=False)
    surgery_description: Mapped[str | None] = mapped_column(Text)
    # Surgeries: [{name, year, hospital, reason, document_url}]
    surgeries: Mapped[list | None] = mapped_column(JSON)
    
    ongoing_treatments: Mapped[bool] = mapped_column(Boolean, default=False)
    treatment_description: Mapped[str | None] = mapped_column(Text)
    ongoing_treatment_details: Mapped[str | None] = mapped_column(Text)
    
    # Hospitalizations: [{reason, hospital, year, duration_days}]
    hospitalizations: Mapped[list | None] = mapped_column(JSON)
    
    # Medical Tests/Lab Reports: [{test_name, test_id, test_date, result, prescribing_doctor, hospital_lab, notes, document_url}]
    has_medical_tests: Mapped[bool] = mapped_column(Boolean, default=False)
    medical_tests: Mapped[list | None] = mapped_column(JSON)
    
    previous_doctors: Mapped[str | None]
    last_checkup_date: Mapped[str | None]

    # === FAMILY HISTORY (Step 6) ===
    family_has_diabetes: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_hypertension: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_heart_disease: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_cancer: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_stroke: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_asthma: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_thalassemia: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_blood_disorders: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_mental_health: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_kidney_disease: Mapped[bool] = mapped_column(Boolean, default=False)
    family_has_thyroid: Mapped[bool] = mapped_column(Boolean, default=False)
    family_history_notes: Mapped[str | None] = mapped_column(Text)

    # === LIFESTYLE & HEALTH (Step 7) ===
    smoking: Mapped[str | None]  # never, former, current
    smoking_details: Mapped[str | None]  # packs per day, years
    smoking_amount: Mapped[str | None]
    alcohol: Mapped[str | None]  # never, occasional, frequent
    alcohol_details: Mapped[str | None]
    alcohol_frequency: Mapped[str | None]
    tobacco_use: Mapped[str | None]  # paan, jorda, etc.
    drug_use: Mapped[str | None]
    caffeine: Mapped[str | None]  # none, low, moderate, high
    
    activity_level: Mapped[str | None]  # sedentary, moderate, active, very_active
    exercise_type: Mapped[str | None]
    exercise_frequency: Mapped[str | None]
    
    sleep_duration: Mapped[str | None]
    sleep_quality: Mapped[str | None]  # good, fair, poor
    
    diet: Mapped[str | None]  # omnivore, vegetarian, vegan, etc.
    diet_restrictions: Mapped[str | None]
    dietary_restrictions: Mapped[str | None]
    water_intake: Mapped[str | None]  # glasses per day
    
    # Mental health
    stress_level: Mapped[str | None]  # low, moderate, high
    mental_health_history: Mapped[str | None]
    mental_health_concerns: Mapped[str | None] = mapped_column(Text)
    currently_in_therapy: Mapped[bool] = mapped_column(Boolean, default=False)

    # === VACCINATION (Step 7 continued) ===
    vaccination_status: Mapped[str | None]  # up-to-date, partial, unknown
    # Vaccinations: [{name, date, doses}]
    vaccinations: Mapped[list | None] = mapped_column(JSON)
    has_epi_vaccination: Mapped[bool] = mapped_column(Boolean, default=False)
    has_covid_vaccination: Mapped[bool] = mapped_column(Boolean, default=False)
    covid_vaccine_doses: Mapped[int | None]
    has_hepatitis_vaccination: Mapped[bool] = mapped_column(Boolean, default=False)
    has_tb_vaccination: Mapped[bool] = mapped_column(Boolean, default=False)
    has_tt_vaccination: Mapped[bool] = mapped_column(Boolean, default=False)

    # === PREFERENCES & CONSENT (Step 8) ===
    language: Mapped[str | None]
    preferred_language: Mapped[str | None]
    languages_spoken: Mapped[list | None] = mapped_column(JSON)
    preferred_contact_method: Mapped[str | None]  # phone, email, sms, whatsapp
    notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_preferences: Mapped[list | None] = mapped_column(JSON)  # email, sms, push
    
    # Primary Emergency contact
    emergency_name: Mapped[str | None]
    emergency_relation: Mapped[str | None]
    emergency_phone: Mapped[str | None]
    emergency_address: Mapped[str | None]
    
    # Secondary Emergency contact
    secondary_emergency_name: Mapped[str | None]
    secondary_emergency_phone: Mapped[str | None]
    
    # Consent flags
    consent_storage: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_doctor: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_research: Mapped[bool] = mapped_column(Boolean, default=False)

    ai_interactions: Mapped[list["AIInteraction"]] = relationship("AIInteraction", back_populates="patient")
    
    # Timestamps
    created_at: Mapped[datetime | None]
    updated_at: Mapped[datetime | None]

