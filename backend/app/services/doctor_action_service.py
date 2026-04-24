from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.appointment import Appointment
from app.db.models.consultation import Consultation, Prescription
from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_action import DoctorAction
from app.db.models.enums import DoctorActionPriority, DoctorActionStatus, DoctorActionType


def _safe_amount(value: float | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


async def create_doctor_action(
    db: AsyncSession,
    *,
    doctor_id: str,
    action_type: DoctorActionType,
    title: str,
    description: str | None = None,
    priority: DoctorActionPriority = DoctorActionPriority.MEDIUM,
    status: DoctorActionStatus = DoctorActionStatus.PENDING,
    related_patient_id: str | None = None,
    related_appointment_id: str | None = None,
    revenue_amount: float | None = None,
    due_date: datetime | None = None,
    completed_at: datetime | None = None,
) -> DoctorAction:
    action = DoctorAction(
        doctor_id=doctor_id,
        action_type=action_type,
        title=title,
        description=description,
        priority=priority,
        status=status,
        related_patient_id=related_patient_id,
        related_appointment_id=related_appointment_id,
        revenue_amount=_safe_amount(revenue_amount),
        due_date=due_date,
        completed_at=completed_at,
    )
    db.add(action)
    return action


async def create_appointment_completed_action(
    db: AsyncSession,
    *,
    appointment: Appointment,
) -> DoctorAction:
    existing = (
        await db.execute(
            select(DoctorAction).where(
                DoctorAction.doctor_id == appointment.doctor_id,
                DoctorAction.action_type == DoctorActionType.APPOINTMENT_COMPLETED,
                DoctorAction.related_appointment_id == appointment.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    doctor_profile = (
        await db.get(DoctorProfile, appointment.doctor_id)
    )
    consultation_fee = _safe_amount(getattr(doctor_profile, "consultation_fee", None))
    revenue_amount = _safe_amount(getattr(appointment, "revenue_amount", None))
    return await create_doctor_action(
        db,
        doctor_id=appointment.doctor_id,
        action_type=DoctorActionType.APPOINTMENT_COMPLETED,
        title="Appointment completed",
        description=f"Completed appointment for patient {appointment.patient_id}",
        priority=DoctorActionPriority.MEDIUM,
        status=DoctorActionStatus.COMPLETED,
        related_patient_id=appointment.patient_id,
        related_appointment_id=appointment.id,
        revenue_amount=revenue_amount if revenue_amount is not None else consultation_fee,
        completed_at=appointment.completed_at or datetime.now(timezone.utc),
    )


async def create_consultation_completed_action(
    db: AsyncSession,
    *,
    consultation: Consultation,
) -> DoctorAction:
    return await create_doctor_action(
        db,
        doctor_id=consultation.doctor_id,
        action_type=DoctorActionType.CONSULTATION_COMPLETED,
        title="Consultation completed",
        description=f"Completed consultation {consultation.id}",
        priority=DoctorActionPriority.MEDIUM,
        status=DoctorActionStatus.COMPLETED,
        related_patient_id=consultation.patient_id,
        related_appointment_id=consultation.appointment_id,
        completed_at=datetime.now(timezone.utc),
    )


async def create_prescription_issued_action(
    db: AsyncSession,
    *,
    prescription: Prescription,
) -> DoctorAction:
    return await create_doctor_action(
        db,
        doctor_id=prescription.doctor_id,
        action_type=DoctorActionType.PRESCRIPTION_ISSUED,
        title="Prescription issued",
        description=f"Issued prescription {prescription.id}",
        priority=DoctorActionPriority.MEDIUM,
        status=DoctorActionStatus.COMPLETED,
        related_patient_id=prescription.patient_id,
        completed_at=datetime.now(timezone.utc),
    )
