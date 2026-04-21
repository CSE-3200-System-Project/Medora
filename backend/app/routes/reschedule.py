"""Appointment reschedule negotiation endpoints (compatibility wrappers)."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.appointment import Appointment
from app.db.models.appointment_request import AppointmentRescheduleRequest
from app.db.models.profile import Profile
from app.schemas.availability import RescheduleRequestCreate, RescheduleRespondRequest
from app.services import appointment_service

router = APIRouter()


class RescheduleWithdrawRequest(BaseModel):
    response_note: str | None = Field(default=None, max_length=1000)


@router.post("/request", status_code=status.HTTP_201_CREATED)
async def create_reschedule_request(
    data: RescheduleRequestCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Compatibility wrapper for creating reschedule requests."""
    user_id = user.id

    profile_result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    appointment_result = await db.execute(
        select(Appointment).where(Appointment.id == data.appointment_id)
    )
    appointment = appointment_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.patient_id != user_id and appointment.doctor_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to reschedule this appointment")

    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        role = "patient"
    elif "DOCTOR" in role_str:
        role = "doctor"
    else:
        raise HTTPException(status_code=403, detail="Only doctor or patient can request reschedule")

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
    except ValueError as error:
        detail = str(error)
        status_code = 409 if ("not available" in detail.lower() or "held by another pending" in detail.lower()) else 400
        raise HTTPException(status_code=status_code, detail=detail)

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
        "expires_at": reschedule.expires_at.isoformat() if reschedule.expires_at else None,
    }


@router.post("/{request_id}/respond")
async def respond_to_reschedule(
    request_id: str,
    data: RescheduleRespondRequest,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Compatibility wrapper for accepting/rejecting reschedule requests."""
    user_id = user.id

    profile_result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        role = "patient"
    elif "DOCTOR" in role_str:
        role = "doctor"
    else:
        raise HTTPException(status_code=403, detail="Only doctor or patient can respond")

    try:
        reschedule = await appointment_service.respond_to_reschedule(
            db,
            reschedule_request_id=request_id,
            accept=data.accept,
            responded_by_id=user_id,
            responded_by_role=role,
        )
    except ValueError as error:
        detail = str(error)
        status_code = 409 if "slot" in detail.lower() else 400
        raise HTTPException(status_code=status_code, detail=detail)

    await db.commit()

    return {
        "id": reschedule.id,
        "appointment_id": reschedule.appointment_id,
        "status": reschedule.status.value,
        "accepted": data.accept,
        "responded_at": reschedule.responded_at.isoformat() if reschedule.responded_at else None,
        "response_note": reschedule.response_note,
    }


@router.post("/{request_id}/withdraw")
async def withdraw_reschedule_request(
    request_id: str,
    data: RescheduleWithdrawRequest,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Compatibility wrapper for requester-withdrawal of pending reschedule requests."""
    user_id = user.id

    profile_result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        requester_role = "patient"
    elif "DOCTOR" in role_str:
        requester_role = "doctor"
    else:
        raise HTTPException(status_code=403, detail="Only doctor or patient can withdraw")

    try:
        reschedule = await appointment_service.withdraw_reschedule_request(
            db,
            reschedule_request_id=request_id,
            requester_id=user_id,
            requester_role=requester_role,
            response_note=data.response_note,
        )
    except ValueError as error:
        detail = str(error)
        if "not found" in detail.lower():
            raise HTTPException(status_code=404, detail=detail)
        if "only the requester" in detail.lower() or "not authorized" in detail.lower():
            raise HTTPException(status_code=403, detail=detail)
        raise HTTPException(status_code=400, detail=detail)

    await db.commit()

    return {
        "id": reschedule.id,
        "appointment_id": reschedule.appointment_id,
        "status": reschedule.status.value,
        "responded_at": reschedule.responded_at.isoformat() if reschedule.responded_at else None,
        "response_note": reschedule.response_note,
    }


@router.get("/appointment/{appointment_id}")
async def get_reschedule_history(
    appointment_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get all reschedule requests for an appointment."""
    user_id = user.id

    appointment_result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = appointment_result.scalar_one_or_none()
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
                "id": req.id,
                "requested_by_id": req.requested_by_id,
                "requested_by_role": req.requested_by_role.value,
                "proposed_date": req.proposed_date.isoformat(),
                "proposed_time": req.proposed_time.isoformat(),
                "reason": req.reason,
                "status": req.status.value,
                "admin_approval_status": req.admin_approval_status.value if req.admin_approval_status else None,
                "created_at": req.created_at.isoformat() if req.created_at else None,
                "responded_by_id": req.responded_by_id,
                "responded_at": req.responded_at.isoformat() if req.responded_at else None,
                "response_note": req.response_note,
                "expires_at": req.expires_at.isoformat() if req.expires_at else None,
            }
            for req in requests
        ],
    }
