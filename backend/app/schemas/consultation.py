"""
Pydantic schemas for Consultation and Prescription endpoints.
"""
from pydantic import BaseModel, Field
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
