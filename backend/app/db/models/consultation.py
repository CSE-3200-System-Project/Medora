"""
Consultation and Prescription models for doctor-patient interactions.
Includes: Consultation, Prescription, MedicationPrescription, TestPrescription, SurgeryRecommendation
"""
import uuid
from datetime import datetime, date
from sqlalchemy import String, ForeignKey, DateTime, Enum, Text, Boolean, JSON, Integer, Float, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.models.enums import (
    ConsultationStatus,
    PrescriptionType,
    PrescriptionStatus,
    MedicineType,
    TestUrgency,
    SurgeryUrgency,
    MealInstruction,
    DurationUnit,
)


class Consultation(Base):
    """
    Represents a doctor-patient consultation session.
    A consultation can have multiple prescriptions.
    """
    __tablename__ = "consultations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id: Mapped[str] = mapped_column(String, ForeignKey("doctor_profiles.profile_id"), nullable=False)
    patient_id: Mapped[str] = mapped_column(String, ForeignKey("patient_profiles.profile_id"), nullable=False)
    appointment_id: Mapped[str | None] = mapped_column(String, ForeignKey("appointments.id"), nullable=True)
    
    # Consultation details
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    status: Mapped[ConsultationStatus] = mapped_column(
        Enum(ConsultationStatus, values_callable=lambda x: [e.value for e in x]),
        default=ConsultationStatus.OPEN
    )
    
    consultation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    doctor = relationship("DoctorProfile", backref="consultations")
    patient = relationship("PatientProfile", backref="consultations")
    appointment = relationship("Appointment", backref="consultation")
    prescriptions = relationship("Prescription", back_populates="consultation", cascade="all, delete-orphan")


class Prescription(Base):
    """
    Parent prescription object linked to a consultation.
    Contains one or more medication/test/surgery items.
    """
    __tablename__ = "prescriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    consultation_id: Mapped[str] = mapped_column(String, ForeignKey("consultations.id"), nullable=False)
    doctor_id: Mapped[str] = mapped_column(String, ForeignKey("doctor_profiles.profile_id"), nullable=False)
    patient_id: Mapped[str] = mapped_column(String, ForeignKey("patient_profiles.profile_id"), nullable=False)
    
    # Prescription type
    type: Mapped[PrescriptionType] = mapped_column(
        Enum(PrescriptionType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    
    # Status for patient acceptance
    status: Mapped[PrescriptionStatus] = mapped_column(
        Enum(PrescriptionStatus, values_callable=lambda x: [e.value for e in x]),
        default=PrescriptionStatus.PENDING
    )
    
    # Rejection reason (if rejected)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # General notes for the prescription
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Added to medical history flag
    added_to_history: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    consultation = relationship("Consultation", back_populates="prescriptions")
    doctor = relationship("DoctorProfile", backref="prescriptions")
    patient = relationship("PatientProfile", backref="prescriptions")
    
    # Child prescription items
    medications = relationship("MedicationPrescription", back_populates="prescription", cascade="all, delete-orphan")
    tests = relationship("TestPrescription", back_populates="prescription", cascade="all, delete-orphan")
    surgeries = relationship("SurgeryRecommendation", back_populates="prescription", cascade="all, delete-orphan")


class MedicationPrescription(Base):
    """
    Detailed medication prescription with dosage schedule.
    Mirrors real-world prescription format.
    """
    __tablename__ = "medication_prescriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    prescription_id: Mapped[str] = mapped_column(String, ForeignKey("prescriptions.id"), nullable=False)
    
    # Medicine details
    medicine_name: Mapped[str] = mapped_column(String(255), nullable=False)
    generic_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    medicine_type: Mapped[MedicineType] = mapped_column(
        Enum(MedicineType, values_callable=lambda x: [e.value for e in x]),
        default=MedicineType.TABLET
    )
    strength: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "500mg", "10ml"
    
    # Dosage schedule (boolean for each time)
    dose_morning: Mapped[bool] = mapped_column(Boolean, default=False)
    dose_afternoon: Mapped[bool] = mapped_column(Boolean, default=False)
    dose_evening: Mapped[bool] = mapped_column(Boolean, default=False)
    dose_night: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Dosage amounts per time (e.g., "1", "1/2", "2")
    dose_morning_amount: Mapped[str | None] = mapped_column(String(20), nullable=True)
    dose_afternoon_amount: Mapped[str | None] = mapped_column(String(20), nullable=True)
    dose_evening_amount: Mapped[str | None] = mapped_column(String(20), nullable=True)
    dose_night_amount: Mapped[str | None] = mapped_column(String(20), nullable=True)
    
    # Frequency fallback
    frequency_per_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Duration
    duration_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_unit: Mapped[DurationUnit] = mapped_column(
        Enum(DurationUnit, values_callable=lambda x: [e.value for e in x]),
        default=DurationUnit.DAYS
    )
    
    # Instructions
    meal_instruction: Mapped[MealInstruction] = mapped_column(
        Enum(MealInstruction, values_callable=lambda x: [e.value for e in x]),
        default=MealInstruction.AFTER_MEAL
    )
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Date range
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    
    # Quantity to dispense
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refills: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    prescription = relationship("Prescription", back_populates="medications")


class TestPrescription(Base):
    """
    Medical test/lab work prescription.
    """
    __tablename__ = "test_prescriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    prescription_id: Mapped[str] = mapped_column(String, ForeignKey("prescriptions.id"), nullable=False)
    
    # Test details
    test_name: Mapped[str] = mapped_column(String(255), nullable=False)
    test_type: Mapped[str | None] = mapped_column(String(100), nullable=True)  # Blood, Imaging, Urine, etc.
    
    # Instructions
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)  # Fasting required, etc.
    
    # Urgency
    urgency: Mapped[TestUrgency] = mapped_column(
        Enum(TestUrgency, values_callable=lambda x: [e.value for e in x]),
        default=TestUrgency.NORMAL
    )
    
    # Preferred lab/facility
    preferred_lab: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Expected date
    expected_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    prescription = relationship("Prescription", back_populates="tests")


class SurgeryRecommendation(Base):
    """
    Surgery or medical procedure recommendation.
    """
    __tablename__ = "surgery_recommendations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    prescription_id: Mapped[str] = mapped_column(String, ForeignKey("prescriptions.id"), nullable=False)
    
    # Procedure details
    procedure_name: Mapped[str] = mapped_column(String(255), nullable=False)
    procedure_type: Mapped[str | None] = mapped_column(String(100), nullable=True)  # Major, Minor, Diagnostic
    
    # Reason
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Urgency
    urgency: Mapped[SurgeryUrgency] = mapped_column(
        Enum(SurgeryUrgency, values_callable=lambda x: [e.value for e in x]),
        default=SurgeryUrgency.SCHEDULED
    )
    
    # Recommended date
    recommended_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    
    # Estimated cost range
    estimated_cost_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_cost_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # Pre-operative instructions
    pre_op_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Preferred facility
    preferred_facility: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    prescription = relationship("Prescription", back_populates="surgeries")
