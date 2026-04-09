"""
Pydantic schemas for Consultation and Prescription endpoints.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


# ========== ENUMS ==========

class ConsultationStatus(str, Enum):
    OPEN = "open"
    COMPLETED = "completed"


class PrescriptionType(str, Enum):
    MEDICATION = "medication"
    TEST = "test"
    SURGERY = "surgery"


class PrescriptionStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class MedicineType(str, Enum):
    TABLET = "tablet"
    CAPSULE = "capsule"
    SYRUP = "syrup"
    INJECTION = "injection"
    CREAM = "cream"
    OINTMENT = "ointment"
    DROPS = "drops"
    INHALER = "inhaler"
    POWDER = "powder"
    GEL = "gel"
    SUPPOSITORY = "suppository"
    OTHER = "other"


class TestUrgency(str, Enum):
    NORMAL = "normal"
    URGENT = "urgent"


class SurgeryUrgency(str, Enum):
    IMMEDIATE = "immediate"
    SCHEDULED = "scheduled"


class MealInstruction(str, Enum):
    BEFORE_MEAL = "before_meal"
    AFTER_MEAL = "after_meal"
    WITH_MEAL = "with_meal"
    EMPTY_STOMACH = "empty_stomach"
    ANY_TIME = "any_time"


class DurationUnit(str, Enum):
    DAYS = "days"
    WEEKS = "weeks"
    MONTHS = "months"


class DosageType(str, Enum):
    PATTERN = "pattern"
    FREQUENCY = "frequency"


# ========== CONSULTATION SCHEMAS ==========

class ConsultationCreate(BaseModel):
    patient_id: str
    appointment_id: Optional[str] = None
    chief_complaint: Optional[str] = None
    notes: Optional[str] = None


class ConsultationUpdate(BaseModel):
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None


class ConsultationResponse(BaseModel):
    id: str
    doctor_id: str
    patient_id: str
    patient_ref: Optional[str] = None
    appointment_id: Optional[str] = None
    draft_id: Optional[str] = None
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    status: ConsultationStatus
    consultation_date: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    
    # Doctor info
    doctor_name: Optional[str] = None
    doctor_photo: Optional[str] = None
    doctor_specialization: Optional[str] = None
    
    # Patient info
    patient_name: Optional[str] = None
    patient_photo: Optional[str] = None

    class Config:
        from_attributes = True


# ========== MEDICATION PRESCRIPTION SCHEMAS ==========

class MedicationPrescriptionCreate(BaseModel):
    medicine_name: str = Field(..., min_length=1, max_length=255)
    generic_name: Optional[str] = None
    medicine_type: MedicineType = MedicineType.TABLET
    strength: Optional[str] = None
    
    # Dosage schedule
    dose_morning: bool = False
    dose_afternoon: bool = False
    dose_evening: bool = False
    dose_night: bool = False
    
    # Dosage amounts
    dose_morning_amount: Optional[str] = "1"
    dose_afternoon_amount: Optional[str] = "1"
    dose_evening_amount: Optional[str] = "1"
    dose_night_amount: Optional[str] = "1"
    
    frequency_per_day: Optional[int] = None
    dosage_type: Optional[DosageType] = None
    dosage_pattern: Optional[str] = None
    frequency_text: Optional[str] = None
    
    # Duration
    duration_value: Optional[int] = None
    duration_unit: DurationUnit = DurationUnit.DAYS
    
    # Instructions
    meal_instruction: MealInstruction = MealInstruction.AFTER_MEAL
    special_instructions: Optional[str] = None
    
    # Dates
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    
    quantity: Optional[int] = None
    refills: int = 0

    @field_validator("medicine_name", mode="before")
    @classmethod
    def normalize_medicine_name(cls, value):
        if value is None:
            return value
        text = str(value).strip()
        if not text:
            raise ValueError("medicine_name is required")
        return text

    @field_validator("generic_name", "strength", "dosage_pattern", "frequency_text", "special_instructions", mode="before")
    @classmethod
    def normalize_optional_text_fields(cls, value):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def normalize_optional_date_fields(cls, value):
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value


class MedicationPrescriptionResponse(BaseModel):
    id: str
    prescription_id: str
    medicine_name: str
    generic_name: Optional[str] = None
    medicine_type: MedicineType
    strength: Optional[str] = None
    
    dose_morning: bool
    dose_afternoon: bool
    dose_evening: bool
    dose_night: bool
    
    dose_morning_amount: Optional[str] = None
    dose_afternoon_amount: Optional[str] = None
    dose_evening_amount: Optional[str] = None
    dose_night_amount: Optional[str] = None
    
    frequency_per_day: Optional[int] = None
    dosage_type: Optional[DosageType] = None
    dosage_pattern: Optional[str] = None
    frequency_text: Optional[str] = None
    
    duration_value: Optional[int] = None
    duration_unit: DurationUnit
    
    meal_instruction: MealInstruction
    special_instructions: Optional[str] = None
    
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    
    quantity: Optional[int] = None
    refills: int
    
    created_at: datetime

    class Config:
        from_attributes = True


# ========== TEST PRESCRIPTION SCHEMAS ==========

class TestPrescriptionCreate(BaseModel):
    test_name: str = Field(..., min_length=1, max_length=255)
    test_type: Optional[str] = None  # Blood, Imaging, Urine, etc.
    instructions: Optional[str] = None
    urgency: TestUrgency = TestUrgency.NORMAL
    preferred_lab: Optional[str] = None
    expected_date: Optional[date] = None

    @field_validator("test_name", mode="before")
    @classmethod
    def normalize_test_name(cls, value):
        if value is None:
            return value
        text = str(value).strip()
        if not text:
            raise ValueError("test_name is required")
        return text

    @field_validator("test_type", "instructions", "preferred_lab", mode="before")
    @classmethod
    def normalize_optional_text_fields(cls, value):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("expected_date", mode="before")
    @classmethod
    def normalize_expected_date(cls, value):
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value


class TestPrescriptionResponse(BaseModel):
    id: str
    prescription_id: str
    test_name: str
    test_type: Optional[str] = None
    instructions: Optional[str] = None
    urgency: TestUrgency
    preferred_lab: Optional[str] = None
    expected_date: Optional[date] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ========== SURGERY RECOMMENDATION SCHEMAS ==========

class SurgeryRecommendationCreate(BaseModel):
    procedure_name: str = Field(..., min_length=1, max_length=255)
    procedure_type: Optional[str] = None  # Major, Minor, Diagnostic
    reason: Optional[str] = None
    urgency: SurgeryUrgency = SurgeryUrgency.SCHEDULED
    recommended_date: Optional[date] = None
    estimated_cost_min: Optional[float] = None
    estimated_cost_max: Optional[float] = None
    pre_op_instructions: Optional[str] = None
    notes: Optional[str] = None
    preferred_facility: Optional[str] = None

    @field_validator("procedure_name", mode="before")
    @classmethod
    def normalize_procedure_name(cls, value):
        if value is None:
            return value
        text = str(value).strip()
        if not text:
            raise ValueError("procedure_name is required")
        return text

    @field_validator(
        "procedure_type",
        "reason",
        "pre_op_instructions",
        "notes",
        "preferred_facility",
        mode="before",
    )
    @classmethod
    def normalize_optional_text_fields(cls, value):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("recommended_date", mode="before")
    @classmethod
    def normalize_recommended_date(cls, value):
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value


class SurgeryRecommendationResponse(BaseModel):
    id: str
    prescription_id: str
    procedure_name: str
    procedure_type: Optional[str] = None
    reason: Optional[str] = None
    urgency: SurgeryUrgency
    recommended_date: Optional[date] = None
    estimated_cost_min: Optional[float] = None
    estimated_cost_max: Optional[float] = None
    pre_op_instructions: Optional[str] = None
    notes: Optional[str] = None
    preferred_facility: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ========== PRESCRIPTION SCHEMAS ==========

class PrescriptionCreate(BaseModel):
    type: PrescriptionType
    notes: Optional[str] = None
    rendered_prescription_html: Optional[str] = None
    rendered_prescription_snapshot: Optional[dict] = None
    rendered_prescription_generated_at: Optional[datetime] = None
    
    # Items to add (at least one should be provided based on type)
    medications: Optional[List[MedicationPrescriptionCreate]] = None
    tests: Optional[List[TestPrescriptionCreate]] = None
    surgeries: Optional[List[SurgeryRecommendationCreate]] = None


class PrescriptionResponse(BaseModel):
    id: str
    consultation_id: str
    doctor_id: str
    patient_id: str
    patient_ref: Optional[str] = None
    type: PrescriptionType
    status: PrescriptionStatus
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    added_to_history: bool
    rendered_prescription_html: Optional[str] = None
    rendered_prescription_snapshot: Optional[dict] = None
    rendered_prescription_generated_at: Optional[datetime] = None
    
    # Doctor info
    doctor_name: Optional[str] = None
    doctor_photo: Optional[str] = None
    doctor_specialization: Optional[str] = None
    
    # Items
    medications: List[MedicationPrescriptionResponse] = []
    tests: List[TestPrescriptionResponse] = []
    surgeries: List[SurgeryRecommendationResponse] = []

    class Config:
        from_attributes = True


# ========== PATIENT ACTION SCHEMAS ==========

class PrescriptionAccept(BaseModel):
    pass  # No additional data needed


class PrescriptionReject(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


# ========== LIST RESPONSE SCHEMAS ==========

class ConsultationListResponse(BaseModel):
    consultations: List[ConsultationResponse]
    total: int


class PrescriptionListResponse(BaseModel):
    prescriptions: List[PrescriptionResponse]
    total: int


# ========== FULL CONSULTATION WITH PRESCRIPTIONS ==========

class ConsultationWithPrescriptions(ConsultationResponse):
    prescriptions: List[PrescriptionResponse] = []


# ========== CONSULTATION DRAFT SCHEMAS ==========

class ConsultationDraftUpdate(BaseModel):
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    prescription_type: Optional[PrescriptionType] = None
    prescription_notes: Optional[str] = None
    medications: Optional[List[MedicationPrescriptionCreate]] = None
    tests: Optional[List[TestPrescriptionCreate]] = None
    surgeries: Optional[List[SurgeryRecommendationCreate]] = None


class ConsultationDraftPatientInfo(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None


class ConsultationDraftDoctorInfo(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    chamber_info: Optional[str] = None


class ConsultationDraftResponse(BaseModel):
    consultation_id: str
    draft_id: Optional[str] = None
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    prescription_type: Optional[PrescriptionType] = None
    prescription_notes: Optional[str] = None
    medications: List[MedicationPrescriptionCreate] = []
    tests: List[TestPrescriptionCreate] = []
    surgeries: List[SurgeryRecommendationCreate] = []
    patient_info: Optional[ConsultationDraftPatientInfo] = None
    doctor_info: Optional[ConsultationDraftDoctorInfo] = None
    updated_at: Optional[datetime] = None


# ========== PRESCRIPTION FULL PREVIEW SCHEMAS ==========

class PrescriptionPreviewDoctor(BaseModel):
    name: str
    qualification: Optional[str] = None
    specialization: Optional[str] = None
    chamber_info: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    registration_number: Optional[str] = None
    signature_url: Optional[str] = None


class PrescriptionPreviewPatient(BaseModel):
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    patient_id: str


class PrescriptionPreviewConsultation(BaseModel):
    date: datetime
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None


class PrescriptionPreviewMedication(BaseModel):
    medicine_name: str
    strength: Optional[str] = None
    dosage_type: DosageType
    dosage_pattern: Optional[str] = None
    frequency_text: Optional[str] = None
    duration: Optional[str] = None
    route: Optional[str] = None
    meal_instruction: Optional[str] = None
    quantity: Optional[int] = None


class PrescriptionPreviewTest(BaseModel):
    test_name: str
    instructions: Optional[str] = None
    urgency: Optional[str] = None


class PrescriptionPreviewProcedure(BaseModel):
    procedure_name: str
    notes: Optional[str] = None
    reason: Optional[str] = None
    urgency: Optional[str] = None


class PrescriptionFullResponse(BaseModel):
    data_source: Optional[str] = None
    snapshot_generated_at: Optional[datetime] = None
    doctor: PrescriptionPreviewDoctor
    patient: PrescriptionPreviewPatient
    consultation: PrescriptionPreviewConsultation
    medications: List[PrescriptionPreviewMedication] = []
    tests: List[PrescriptionPreviewTest] = []
    procedures: List[PrescriptionPreviewProcedure] = []
