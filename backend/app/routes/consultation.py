"""
Consultation and Prescription API routes.
Handles doctor-patient consultations and prescription management.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.consultation import (
    Consultation,
    Prescription,
    MedicationPrescription,
    TestPrescription,
    SurgeryRecommendation,
)
from app.db.models.enums import (
    ConsultationStatus,
    PrescriptionType,
    PrescriptionStatus,
    UserRole,
)
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.patient import PatientProfile
from app.db.models.notification import Notification, NotificationType, NotificationPriority
from app.schemas.consultation import (
    ConsultationCreate,
    ConsultationUpdate,
    ConsultationResponse,
    ConsultationListResponse,
    ConsultationWithPrescriptions,
    PrescriptionCreate,
    PrescriptionResponse,
    PrescriptionListResponse,
    MedicationPrescriptionCreate,
    MedicationPrescriptionResponse,
    TestPrescriptionCreate,
    TestPrescriptionResponse,
    SurgeryRecommendationCreate,
    SurgeryRecommendationResponse,
    PrescriptionReject,
)

router = APIRouter()


# ========== HELPER FUNCTIONS ==========

async def get_doctor_profile(db: AsyncSession, user_id: str) -> DoctorProfile:
    """Get doctor profile and verify user is a doctor."""
    result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile or profile.role != UserRole.DOCTOR:
        raise HTTPException(status_code=403, detail="Only doctors can access this resource")
    
    result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.profile_id == user_id)
    )
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    
    return doctor


async def get_patient_profile(db: AsyncSession, user_id: str) -> PatientProfile:
    """Get patient profile and verify user is a patient."""
    result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile or profile.role != UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="Only patients can access this resource")
    
    result = await db.execute(
        select(PatientProfile).where(PatientProfile.profile_id == user_id)
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    return patient


async def create_notification(
    db: AsyncSession,
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    metadata: Optional[dict] = None,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
) -> Notification:
    """Create a notification for a user."""
    notification = Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=notification_type,
        priority=priority,
        title=title,
        message=message,
        action_url=action_url,
        data=metadata,
    )
    db.add(notification)
    return notification


def build_consultation_response(
    consultation: Consultation,
    doctor_profile: Optional[Profile] = None,
    patient_profile: Optional[Profile] = None,
) -> dict:
    """Build consultation response with doctor/patient info."""
    response = {
        "id": consultation.id,
        "doctor_id": consultation.doctor_id,
        "patient_id": consultation.patient_id,
        "appointment_id": consultation.appointment_id,
        "chief_complaint": consultation.chief_complaint,
        "diagnosis": consultation.diagnosis,
        "notes": consultation.notes,
        "status": consultation.status.value if consultation.status else "open",
        "consultation_date": consultation.consultation_date,
        "completed_at": consultation.completed_at,
        "created_at": consultation.created_at,
    }
    
    if doctor_profile:
        response["doctor_name"] = f"{doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip()
        response["doctor_photo"] = getattr(consultation.doctor, 'profile_photo_url', None) if consultation.doctor else None
        response["doctor_specialization"] = getattr(consultation.doctor, 'specialization', None) if consultation.doctor else None
    
    if patient_profile:
        response["patient_name"] = f"{patient_profile.first_name or ''} {patient_profile.last_name or ''}".strip()
        response["patient_photo"] = getattr(consultation.patient, 'profile_photo_url', None) if consultation.patient else None
    
    return response


def build_prescription_response(prescription: Prescription, doctor_profile: Optional[Profile] = None) -> dict:
    """Build prescription response with all items."""
    response = {
        "id": prescription.id,
        "consultation_id": prescription.consultation_id,
        "doctor_id": prescription.doctor_id,
        "patient_id": prescription.patient_id,
        "type": prescription.type.value if prescription.type else "medication",
        "status": prescription.status.value if prescription.status else "pending",
        "rejection_reason": prescription.rejection_reason,
        "notes": prescription.notes,
        "created_at": prescription.created_at,
        "accepted_at": prescription.accepted_at,
        "rejected_at": prescription.rejected_at,
        "added_to_history": prescription.added_to_history,
        "medications": [],
        "tests": [],
        "surgeries": [],
    }
    
    if doctor_profile:
        response["doctor_name"] = f"{doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip()
        response["doctor_photo"] = None  # Not available in this context
        response["doctor_specialization"] = None  # Not available in this context
    
    # Add medications
    if prescription.medications:
        for med in prescription.medications:
            response["medications"].append({
                "id": med.id,
                "prescription_id": med.prescription_id,
                "medicine_name": med.medicine_name,
                "generic_name": med.generic_name,
                "medicine_type": med.medicine_type.value if med.medicine_type else "tablet",
                "strength": med.strength,
                "dose_morning": med.dose_morning,
                "dose_afternoon": med.dose_afternoon,
                "dose_evening": med.dose_evening,
                "dose_night": med.dose_night,
                "dose_morning_amount": med.dose_morning_amount,
                "dose_afternoon_amount": med.dose_afternoon_amount,
                "dose_evening_amount": med.dose_evening_amount,
                "dose_night_amount": med.dose_night_amount,
                "frequency_per_day": med.frequency_per_day,
                "duration_value": med.duration_value,
                "duration_unit": med.duration_unit.value if med.duration_unit else "days",
                "meal_instruction": med.meal_instruction.value if med.meal_instruction else "after_meal",
                "special_instructions": med.special_instructions,
                "start_date": med.start_date,
                "end_date": med.end_date,
                "quantity": med.quantity,
                "refills": med.refills,
                "created_at": med.created_at,
            })
    
    # Add tests
    if prescription.tests:
        for test in prescription.tests:
            response["tests"].append({
                "id": test.id,
                "prescription_id": test.prescription_id,
                "test_name": test.test_name,
                "test_type": test.test_type,
                "instructions": test.instructions,
                "urgency": test.urgency.value if test.urgency else "normal",
                "preferred_lab": test.preferred_lab,
                "expected_date": test.expected_date,
                "created_at": test.created_at,
            })
    
    # Add surgeries
    if prescription.surgeries:
        for surgery in prescription.surgeries:
            response["surgeries"].append({
                "id": surgery.id,
                "prescription_id": surgery.prescription_id,
                "procedure_name": surgery.procedure_name,
                "procedure_type": surgery.procedure_type,
                "reason": surgery.reason,
                "urgency": surgery.urgency.value if surgery.urgency else "scheduled",
                "recommended_date": surgery.recommended_date,
                "estimated_cost_min": surgery.estimated_cost_min,
                "estimated_cost_max": surgery.estimated_cost_max,
                "pre_op_instructions": surgery.pre_op_instructions,
                "notes": surgery.notes,
                "preferred_facility": surgery.preferred_facility,
                "created_at": surgery.created_at,
            })
    
    return response


# ========== CONSULTATION ROUTES (DOCTOR) ==========

@router.post("/", response_model=ConsultationResponse)
async def start_consultation(
    data: ConsultationCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Start a new consultation with a patient.
    Only doctors can start consultations.
    """
    import traceback
    try:
        doctor = await get_doctor_profile(db, user.id)
        
        # Verify patient exists
        result = await db.execute(
            select(PatientProfile).where(PatientProfile.profile_id == data.patient_id)
        )
        patient = result.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Check if there's an active consultation with this patient
        result = await db.execute(
            select(Consultation).where(
                and_(
                    Consultation.doctor_id == user.id,
                    Consultation.patient_id == data.patient_id,
                    Consultation.status == ConsultationStatus.OPEN
                )
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Active consultation already exists with this patient")
        
        # Create consultation
        consultation = Consultation(
            id=str(uuid.uuid4()),
            doctor_id=user.id,
            patient_id=data.patient_id,
            appointment_id=data.appointment_id,
            chief_complaint=data.chief_complaint,
            notes=data.notes,
            status=ConsultationStatus.OPEN,
        )
        db.add(consultation)
        
        # Get doctor profile info for notification
        result = await db.execute(
            select(Profile).where(Profile.id == user.id)
        )
        doctor_profile = result.scalar_one_or_none()
        doctor_name = f"Dr. {doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip() if doctor_profile else "Your doctor"
        
        # Create notification for patient
        await create_notification(
            db=db,
            user_id=data.patient_id,
            notification_type=NotificationType.CONSULTATION_STARTED,
            title="Consultation Started",
            message=f"{doctor_name} has started a consultation session with you.",
            action_url=f"/patient/prescriptions",
            metadata={"consultation_id": consultation.id, "doctor_id": user.id},
            priority=NotificationPriority.HIGH,
        )
        
        await db.commit()
        await db.refresh(consultation)
        
        return build_consultation_response(consultation, doctor_profile)
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in start_consultation: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/doctor/active", response_model=ConsultationListResponse)
async def get_doctor_active_consultations(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get all active consultations for the current doctor."""
    await get_doctor_profile(db, user.id)
    
    result = await db.execute(
        select(Consultation)
        .options(
            selectinload(Consultation.patient),
            selectinload(Consultation.prescriptions)
        )
        .where(
            and_(
                Consultation.doctor_id == user.id,
                Consultation.status == ConsultationStatus.OPEN
            )
        )
        .order_by(Consultation.created_at.desc())
    )
    consultations = result.scalars().all()
    
    # Get patient profiles
    patient_ids = [c.patient_id for c in consultations]
    result = await db.execute(
        select(Profile).where(Profile.id.in_(patient_ids))
    )
    patient_profiles = {p.id: p for p in result.scalars().all()}
    
    response_list = []
    for consultation in consultations:
        patient_profile = patient_profiles.get(consultation.patient_id)
        response = build_consultation_response(consultation, patient_profile=patient_profile)
        response_list.append(response)
    
    return {"consultations": response_list, "total": len(response_list)}


@router.get("/doctor/history", response_model=ConsultationListResponse)
async def get_doctor_consultation_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get consultation history for the current doctor."""
    await get_doctor_profile(db, user.id)
    
    result = await db.execute(
        select(Consultation)
        .options(selectinload(Consultation.patient))
        .where(Consultation.doctor_id == user.id)
        .order_by(Consultation.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    consultations = result.scalars().all()
    
    # Get total count
    count_result = await db.execute(
        select(func.count(Consultation.id)).where(Consultation.doctor_id == user.id)
    )
    total = count_result.scalar() or 0
    
    # Get patient profiles
    patient_ids = [c.patient_id for c in consultations]
    result = await db.execute(
        select(Profile).where(Profile.id.in_(patient_ids))
    )
    patient_profiles = {p.id: p for p in result.scalars().all()}
    
    response_list = []
    for consultation in consultations:
        patient_profile = patient_profiles.get(consultation.patient_id)
        response = build_consultation_response(consultation, patient_profile=patient_profile)
        response_list.append(response)
    
    return {"consultations": response_list, "total": total}


@router.get("/{consultation_id}", response_model=ConsultationWithPrescriptions)
async def get_consultation(
    consultation_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific consultation with all prescriptions."""
    result = await db.execute(
        select(Consultation)
        .options(
            selectinload(Consultation.doctor),
            selectinload(Consultation.patient),
            selectinload(Consultation.prescriptions).selectinload(Prescription.medications),
            selectinload(Consultation.prescriptions).selectinload(Prescription.tests),
            selectinload(Consultation.prescriptions).selectinload(Prescription.surgeries),
        )
        .where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    # Verify access
    if consultation.doctor_id != user.id and consultation.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this consultation")
    
    # Get profiles
    result = await db.execute(
        select(Profile).where(Profile.id.in_([consultation.doctor_id, consultation.patient_id]))
    )
    profiles = {p.id: p for p in result.scalars().all()}
    
    doctor_profile = profiles.get(consultation.doctor_id)
    patient_profile = profiles.get(consultation.patient_id)
    
    response = build_consultation_response(consultation, doctor_profile, patient_profile)
    
    # Add prescriptions
    response["prescriptions"] = []
    for prescription in consultation.prescriptions:
        response["prescriptions"].append(build_prescription_response(prescription, doctor_profile))
    
    return response


@router.patch("/{consultation_id}", response_model=ConsultationResponse)
async def update_consultation(
    consultation_id: str,
    data: ConsultationUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Update consultation notes/diagnosis. Only the doctor can update."""
    result = await db.execute(
        select(Consultation).where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    if consultation.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the consultation doctor can update")
    
    if consultation.status == ConsultationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot update a completed consultation")
    
    # Update fields
    if data.chief_complaint is not None:
        consultation.chief_complaint = data.chief_complaint
    if data.diagnosis is not None:
        consultation.diagnosis = data.diagnosis
    if data.notes is not None:
        consultation.notes = data.notes
    
    await db.commit()
    await db.refresh(consultation)
    
    return build_consultation_response(consultation)


@router.patch("/{consultation_id}/complete", response_model=ConsultationResponse)
async def complete_consultation(
    consultation_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Complete a consultation. Only the doctor can complete."""
    result = await db.execute(
        select(Consultation).where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    if consultation.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the consultation doctor can complete")
    
    if consultation.status == ConsultationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Consultation already completed")
    
    consultation.status = ConsultationStatus.COMPLETED
    consultation.completed_at = datetime.now(timezone.utc)
    
    # Get doctor profile info
    result = await db.execute(
        select(Profile).where(Profile.id == user.id)
    )
    doctor_profile = result.scalar_one_or_none()
    doctor_name = f"Dr. {doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip() if doctor_profile else "Your doctor"
    
    # Notify patient
    await create_notification(
        db=db,
        user_id=consultation.patient_id,
        notification_type=NotificationType.CONSULTATION_COMPLETED,
        title="Consultation Completed",
        message=f"Your consultation with {doctor_name} has been completed. Please review any prescriptions.",
        action_url=f"/patient/prescriptions",
        metadata={"consultation_id": consultation.id, "doctor_id": user.id},
        priority=NotificationPriority.MEDIUM,
    )
    
    await db.commit()
    await db.refresh(consultation)
    
    return build_consultation_response(consultation, doctor_profile)


# ========== PRESCRIPTION ROUTES (DOCTOR) ==========

@router.post("/{consultation_id}/prescription", response_model=PrescriptionResponse)
async def add_prescription(
    consultation_id: str,
    data: PrescriptionCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Add a prescription to a consultation.
    Only the consultation doctor can add prescriptions.
    """
    import traceback
    try:
        result = await db.execute(
            select(Consultation).where(Consultation.id == consultation_id)
        )
        consultation = result.scalar_one_or_none()
        
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")
        
        if consultation.doctor_id != user.id:
            raise HTTPException(status_code=403, detail="Only the consultation doctor can add prescriptions")
        
        if consultation.status == ConsultationStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Cannot add prescriptions to a completed consultation")
        
        # Validate that items match the type
        if data.type == PrescriptionType.MEDICATION and (not data.medications or len(data.medications) == 0):
            raise HTTPException(status_code=400, detail="Medication prescription requires at least one medication")
        
        if data.type == PrescriptionType.TEST and (not data.tests or len(data.tests) == 0):
            raise HTTPException(status_code=400, detail="Test prescription requires at least one test")
        
        if data.type == PrescriptionType.SURGERY and (not data.surgeries or len(data.surgeries) == 0):
            raise HTTPException(status_code=400, detail="Surgery prescription requires at least one surgery")
        
        # Create prescription
        prescription = Prescription(
            id=str(uuid.uuid4()),
            consultation_id=consultation_id,
            doctor_id=user.id,
            patient_id=consultation.patient_id,
            type=data.type,
            notes=data.notes,
            status=PrescriptionStatus.PENDING,
        )
        db.add(prescription)
        
        # Add medications
        if data.medications:
            for med_data in data.medications:
                medication = MedicationPrescription(
                    id=str(uuid.uuid4()),
                    prescription_id=prescription.id,
                    medicine_name=med_data.medicine_name,
                    generic_name=med_data.generic_name,
                    medicine_type=med_data.medicine_type,
                    strength=med_data.strength,
                    dose_morning=med_data.dose_morning,
                    dose_afternoon=med_data.dose_afternoon,
                    dose_evening=med_data.dose_evening,
                    dose_night=med_data.dose_night,
                    dose_morning_amount=med_data.dose_morning_amount,
                    dose_afternoon_amount=med_data.dose_afternoon_amount,
                    dose_evening_amount=med_data.dose_evening_amount,
                    dose_night_amount=med_data.dose_night_amount,
                    frequency_per_day=med_data.frequency_per_day,
                    duration_value=med_data.duration_value,
                    duration_unit=med_data.duration_unit,
                    meal_instruction=med_data.meal_instruction,
                    special_instructions=med_data.special_instructions,
                    start_date=med_data.start_date,
                    end_date=med_data.end_date,
                    quantity=med_data.quantity,
                    refills=med_data.refills,
                )
                db.add(medication)
        
        # Add tests
        if data.tests:
            for test_data in data.tests:
                test = TestPrescription(
                    id=str(uuid.uuid4()),
                    prescription_id=prescription.id,
                    test_name=test_data.test_name,
                    test_type=test_data.test_type,
                    instructions=test_data.instructions,
                    urgency=test_data.urgency,
                    preferred_lab=test_data.preferred_lab,
                    expected_date=test_data.expected_date,
                )
                db.add(test)
        
        # Add surgeries
        if data.surgeries:
            for surgery_data in data.surgeries:
                surgery = SurgeryRecommendation(
                    id=str(uuid.uuid4()),
                    prescription_id=prescription.id,
                    procedure_name=surgery_data.procedure_name,
                    procedure_type=surgery_data.procedure_type,
                    reason=surgery_data.reason,
                    urgency=surgery_data.urgency,
                    recommended_date=surgery_data.recommended_date,
                    estimated_cost_min=surgery_data.estimated_cost_min,
                    estimated_cost_max=surgery_data.estimated_cost_max,
                    pre_op_instructions=surgery_data.pre_op_instructions,
                    notes=surgery_data.notes,
                    preferred_facility=surgery_data.preferred_facility,
                )
                db.add(surgery)
        
        # Flush to get IDs before creating notification
        await db.flush()
        
        # Get doctor profile for notification
        result = await db.execute(
            select(Profile).where(Profile.id == user.id)
        )
        doctor_profile = result.scalar_one_or_none()
        doctor_name = f"Dr. {doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip() if doctor_profile else "Your doctor"
        
        # Create notification for patient
        type_label = data.type.value.replace("_", " ").title()
        print(f"\n{'='*60}")
        print(f"CREATING PRESCRIPTION NOTIFICATION")
        print(f"  - Patient ID: {consultation.patient_id}")
        print(f"  - Doctor ID: {user.id}")
        print(f"  - Prescription ID: {prescription.id}")
        print(f"  - Type: {type_label}")
        print(f"{'='*60}\n")
        
        notification = await create_notification(
            db=db,
            user_id=consultation.patient_id,
            notification_type=NotificationType.PRESCRIPTION_CREATED,
            title=f"New {type_label} Prescription",
            message=f"{doctor_name} has prescribed {type_label.lower()} for you. Please review and accept.",
            action_url=f"/patient/prescriptions/{prescription.id}",
            metadata={
                "prescription_id": prescription.id,
                "consultation_id": consultation_id,
                "doctor_id": user.id,
                "type": data.type.value,
            },
            priority=NotificationPriority.HIGH,
        )
        print(f"Notification created with ID: {notification.id}")
        print(f"Notification user_id: {notification.user_id}")
        print(f"Notification type: {notification.type}")
        
        await db.commit()
        print(f"Notification committed to database\n")
        
        # Reload with relationships
        result = await db.execute(
            select(Prescription)
            .options(
                selectinload(Prescription.medications),
                selectinload(Prescription.tests),
                selectinload(Prescription.surgeries),
            )
            .where(Prescription.id == prescription.id)
        )
        prescription = result.scalar_one()
        
        return build_prescription_response(prescription, doctor_profile)
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in add_prescription: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/{consultation_id}/prescriptions", response_model=PrescriptionListResponse)
async def get_consultation_prescriptions(
    consultation_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get all prescriptions for a consultation."""
    result = await db.execute(
        select(Consultation).where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    if consultation.doctor_id != user.id and consultation.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this consultation")
    
    result = await db.execute(
        select(Prescription)
        .options(
            selectinload(Prescription.medications),
            selectinload(Prescription.tests),
            selectinload(Prescription.surgeries),
        )
        .where(Prescription.consultation_id == consultation_id)
        .order_by(Prescription.created_at.desc())
    )
    prescriptions = result.scalars().all()
    
    # Get doctor profile
    result = await db.execute(
        select(Profile).where(Profile.id == consultation.doctor_id)
    )
    doctor_profile = result.scalar_one_or_none()
    
    response_list = [build_prescription_response(p, doctor_profile) for p in prescriptions]
    
    return {"prescriptions": response_list, "total": len(response_list)}


@router.delete("/prescription/{prescription_id}")
async def delete_prescription(
    prescription_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Delete a prescription. Only if pending and by the doctor who created it."""
    result = await db.execute(
        select(Prescription).where(Prescription.id == prescription_id)
    )
    prescription = result.scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the prescribing doctor can delete")
    
    if prescription.status != PrescriptionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only delete pending prescriptions")
    
    await db.delete(prescription)
    await db.commit()
    
    return {"message": "Prescription deleted successfully"}


# ========== PATIENT PRESCRIPTION ROUTES ==========

@router.get("/patient/prescriptions", response_model=PrescriptionListResponse)
async def get_patient_prescriptions(
    status_filter: Optional[str] = Query(None, description="Filter by status: pending, accepted, rejected"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get all prescriptions for the current patient."""
    await get_patient_profile(db, user.id)
    
    query = select(Prescription).options(
        selectinload(Prescription.medications),
        selectinload(Prescription.tests),
        selectinload(Prescription.surgeries),
        selectinload(Prescription.doctor),
    ).where(Prescription.patient_id == user.id)
    
    if status_filter:
        query = query.where(Prescription.status == status_filter)
    
    query = query.order_by(Prescription.created_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    prescriptions = result.scalars().all()
    
    # Get total count
    count_query = select(func.count(Prescription.id)).where(Prescription.patient_id == user.id)
    if status_filter:
        count_query = count_query.where(Prescription.status == status_filter)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Get doctor profiles
    doctor_ids = list(set([p.doctor_id for p in prescriptions]))
    result = await db.execute(
        select(Profile).where(Profile.id.in_(doctor_ids))
    )
    doctor_profiles = {p.id: p for p in result.scalars().all()}
    
    response_list = []
    for prescription in prescriptions:
        doctor_profile = doctor_profiles.get(prescription.doctor_id)
        response_list.append(build_prescription_response(prescription, doctor_profile))
    
    return {"prescriptions": response_list, "total": total}


@router.get("/patient/prescription/{prescription_id}", response_model=PrescriptionResponse)
async def get_patient_prescription(
    prescription_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific prescription for the current patient."""
    result = await db.execute(
        select(Prescription)
        .options(
            selectinload(Prescription.medications),
            selectinload(Prescription.tests),
            selectinload(Prescription.surgeries),
            selectinload(Prescription.doctor),
        )
        .where(Prescription.id == prescription_id)
    )
    prescription = result.scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this prescription")
    
    # Get doctor profile
    result = await db.execute(
        select(Profile).where(Profile.id == prescription.doctor_id)
    )
    doctor_profile = result.scalar_one_or_none()
    
    return build_prescription_response(prescription, doctor_profile)


@router.post("/patient/prescription/{prescription_id}/accept")
async def accept_prescription(
    prescription_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Accept a prescription and add to medical history."""
    result = await db.execute(
        select(Prescription)
        .options(
            selectinload(Prescription.medications),
            selectinload(Prescription.tests),
            selectinload(Prescription.surgeries),
        )
        .where(Prescription.id == prescription_id)
    )
    prescription = result.scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this prescription")
    
    if prescription.status != PrescriptionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Prescription already processed")
    
    # Update prescription status
    prescription.status = PrescriptionStatus.ACCEPTED
    prescription.accepted_at = datetime.now(timezone.utc)
    prescription.added_to_history = True
    
    # Get patient profile for notification
    result = await db.execute(
        select(Profile).where(Profile.id == user.id)
    )
    patient_profile = result.scalar_one_or_none()
    patient_name = f"{patient_profile.first_name or ''} {patient_profile.last_name or ''}".strip() if patient_profile else "Your patient"
    
    # Notify doctor
    await create_notification(
        db=db,
        user_id=prescription.doctor_id,
        notification_type=NotificationType.PRESCRIPTION_ACCEPTED,
        title="Prescription Accepted",
        message=f"{patient_name} has accepted your prescription.",
        action_url=f"/doctor/patients",
        metadata={
            "prescription_id": prescription.id,
            "patient_id": user.id,
        },
        priority=NotificationPriority.MEDIUM,
    )
    
    await db.commit()
    
    return {"message": "Prescription accepted successfully", "status": "accepted"}


@router.post("/patient/prescription/{prescription_id}/reject")
async def reject_prescription(
    prescription_id: str,
    data: PrescriptionReject,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Reject a prescription with optional reason."""
    result = await db.execute(
        select(Prescription).where(Prescription.id == prescription_id)
    )
    prescription = result.scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this prescription")
    
    if prescription.status != PrescriptionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Prescription already processed")
    
    # Update prescription status
    prescription.status = PrescriptionStatus.REJECTED
    prescription.rejected_at = datetime.now(timezone.utc)
    prescription.rejection_reason = data.reason
    
    # Get patient profile for notification
    result = await db.execute(
        select(Profile).where(Profile.id == user.id)
    )
    patient_profile = result.scalar_one_or_none()
    patient_name = f"{patient_profile.first_name or ''} {patient_profile.last_name or ''}".strip() if patient_profile else "Your patient"
    
    # Notify doctor
    await create_notification(
        db=db,
        user_id=prescription.doctor_id,
        notification_type=NotificationType.PRESCRIPTION_REJECTED,
        title="Prescription Rejected",
        message=f"{patient_name} has rejected your prescription." + (f" Reason: {data.reason}" if data.reason else ""),
        action_url=f"/doctor/patients",
        metadata={
            "prescription_id": prescription.id,
            "patient_id": user.id,
            "reason": data.reason,
        },
        priority=NotificationPriority.HIGH,
    )
    
    await db.commit()
    
    return {"message": "Prescription rejected", "status": "rejected"}


# ========== MEDICAL HISTORY INTEGRATION ==========

@router.get("/patient/medical-history/prescriptions", response_model=PrescriptionListResponse)
async def get_medical_history_prescriptions(
    prescription_type: Optional[str] = Query(None, description="Filter by type: medication, test, surgery"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get accepted prescriptions for medical history."""
    await get_patient_profile(db, user.id)
    
    query = select(Prescription).options(
        selectinload(Prescription.medications),
        selectinload(Prescription.tests),
        selectinload(Prescription.surgeries),
    ).where(
        and_(
            Prescription.patient_id == user.id,
            Prescription.status == PrescriptionStatus.ACCEPTED,
        )
    )
    
    if prescription_type:
        query = query.where(Prescription.type == prescription_type)
    
    query = query.order_by(Prescription.accepted_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    prescriptions = result.scalars().all()
    
    # Get total count
    count_query = select(func.count(Prescription.id)).where(
        and_(
            Prescription.patient_id == user.id,
            Prescription.status == PrescriptionStatus.ACCEPTED,
        )
    )
    if prescription_type:
        count_query = count_query.where(Prescription.type == prescription_type)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Get doctor profiles
    doctor_ids = list(set([p.doctor_id for p in prescriptions]))
    result = await db.execute(
        select(Profile).where(Profile.id.in_(doctor_ids))
    )
    doctor_profiles = {p.id: p for p in result.scalars().all()}
    
    response_list = []
    for prescription in prescriptions:
        doctor_profile = doctor_profiles.get(prescription.doctor_id)
        response_list.append(build_prescription_response(prescription, doctor_profile))
    
    return {"prescriptions": response_list, "total": total}
