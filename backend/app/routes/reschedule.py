"""Appointment reschedule negotiation endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.appointment import Appointment
from app.db.models.appointment_request import AppointmentRescheduleRequest
from app.db.models.profile import Profile
from app.services import appointment_service, notification_service
from app.schemas.availability import RescheduleRequestCreate, RescheduleRespondRequest

router = APIRouter()


@router.post("/request", status_code=status.HTTP_201_CREATED)
async def create_reschedule_request(
    data: RescheduleRequestCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient or doctor requests to reschedule an appointment."""
    user_id = user.id

    # Get user profile to determine role
    profile_result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        role = "patient"
    elif "DOCTOR" in role_str:
        role = "doctor"
    else:
        role = "admin"

    # Verify user is part of this appointment
    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == data.appointment_id)
    )
    appointment = appt_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.patient_id != user_id and appointment.doctor_id != user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to reschedule this appointment"
        )

    try:
        reschedule = await appointment_service.request_reschedule(
            db,
            appointment_id=data.appointment_id,
            requested_by_id=user_id,
            requested_by_role=role,
            proposed_date=data.proposed_date,
            proposed_time=data.proposed_time,
            reason=data.reason,
        )

        # Notify the other party
        requester_name = f"{profile.first_name} {profile.last_name}"
        notify_user_id = (
            appointment.doctor_id
            if appointment.patient_id == user_id
            else appointment.patient_id
        )
        proposed_date_str = f"{data.proposed_date} at {data.proposed_time.strftime('%I:%M %p')}"

        await notification_service.notify_reschedule_requested(
            db,
            notify_user_id=notify_user_id,
            requester_name=requester_name,
            appointment_id=appointment.id,
            proposed_date_str=proposed_date_str,
            reason=data.reason,
        )

        await db.commit()

        return {
            "id": reschedule.id,
            "appointment_id": reschedule.appointment_id,
            "requested_by_id": reschedule.requested_by_id,
            "requested_by_role": reschedule.requested_by_role.value,
            "proposed_date": reschedule.proposed_date.isoformat(),
            "proposed_time": reschedule.proposed_time.isoformat(),
            "reason": reschedule.reason,
            "status": reschedule.status.value,
        }
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{request_id}/respond")
async def respond_to_reschedule(
    request_id: str,
    data: RescheduleRespondRequest,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Accept or reject a reschedule proposal."""
    user_id = user.id

    # Get user profile
    profile_result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        role = "patient"
    elif "DOCTOR" in role_str:
        role = "doctor"
    else:
        role = "admin"

    try:
        reschedule = await appointment_service.respond_to_reschedule(
            db,
            reschedule_request_id=request_id,
            accept=data.accept,
            responded_by_id=user_id,
            responded_by_role=role,
        )

        # Notify the original requester
        responder_name = f"{profile.first_name} {profile.last_name}"
        await notification_service.notify_reschedule_responded(
            db,
            notify_user_id=reschedule.requested_by_id,
            responder_name=responder_name,
            appointment_id=reschedule.appointment_id,
            accepted=data.accept,
            new_date_str=f"{reschedule.proposed_date} at {reschedule.proposed_time.strftime('%I:%M %p')}"
            if data.accept
            else None,
        )

        await db.commit()

        return {
            "id": reschedule.id,
            "appointment_id": reschedule.appointment_id,
            "status": reschedule.status.value,
            "accepted": data.accept,
        }
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/appointment/{appointment_id}")
async def get_reschedule_history(
    appointment_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get all reschedule requests for an appointment."""
    user_id = user.id

    # Verify user is part of this appointment
    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = appt_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.patient_id != user_id and appointment.doctor_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view this appointment's reschedule history",
        )

    result = await db.execute(
        select(AppointmentRescheduleRequest)
        .where(AppointmentRescheduleRequest.appointment_id == appointment_id)
        .order_by(AppointmentRescheduleRequest.created_at.desc())
    )
    requests = result.scalars().all()

    return {
        "appointment_id": appointment_id,
        "reschedule_requests": [
            {
                "id": r.id,
                "requested_by_id": r.requested_by_id,
                "requested_by_role": r.requested_by_role.value,
                "proposed_date": r.proposed_date.isoformat(),
                "proposed_time": r.proposed_time.isoformat(),
                "reason": r.reason,
                "status": r.status.value,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in requests
        ],
    }
