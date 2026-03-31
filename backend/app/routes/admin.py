from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, update
from sqlalchemy.orm import aliased
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import VerificationStatus, UserRole, AccountStatus
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

# Simple admin key for password-only access
ADMIN_PASSWORD = "admin123"

# Helper to check admin access (password-based, no account needed)
async def require_admin_access(
    x_admin_password: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Verify admin access via password (no account required)"""
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    return True

# Test endpoint
@router.get("/test")
async def test_admin(admin_access = Depends(require_admin_access)):
    """Test admin authentication"""
    return {"status": "ok", "message": "Admin authentication successful"}

# Helper to check if user is admin (legacy - for logged-in admins)
async def require_admin(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Verify that the current user is an admin"""
    result = await db.execute(
        select(Profile).where(Profile.id == user.id)
    )
    profile = result.scalar()
    
    if not profile or profile.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return profile

# Verification request model
class VerifyDoctorRequest(BaseModel):
    verification_method: str = "manual"
    notes: str | None = None
    approved: bool = True

@router.get("/pending-doctors")
async def get_pending_doctors(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Get all doctors pending verification"""
    result = await db.execute(
        select(Profile, DoctorProfile)
        .join(DoctorProfile, Profile.id == DoctorProfile.profile_id)
        .where(Profile.role == UserRole.DOCTOR)
        .where(Profile.verification_status == VerificationStatus.pending)
    )
    
    doctors = []
    for profile, doctor in result.all():
        doctors.append({
            "id": profile.id,
            "name": f"{profile.first_name} {profile.last_name}",
            "email": profile.email,
            "phone": profile.phone,
            "bmdc_number": doctor.bmdc_number,
            "specialization": doctor.specialization,
            "bmdc_document_url": doctor.bmdc_document_url,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
        })
    
    return {"doctors": doctors}

@router.post("/verify-doctor/{doctor_id}")
async def verify_doctor(
    doctor_id: str,
    request: VerifyDoctorRequest,
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Verify or reject a doctor"""
    async with db.begin():
        # Get profile and doctor
        profile_result = await db.execute(
            select(Profile).where(Profile.id == doctor_id)
        )
        profile = profile_result.scalar()
        
        doctor_result = await db.execute(
            select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id)
        )
        doctor = doctor_result.scalar()
        
        if not profile or not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        
        if profile.role != UserRole.DOCTOR:
            raise HTTPException(status_code=400, detail="User is not a doctor")
        
        # Update verification status
        if request.approved:
            profile.verification_status = VerificationStatus.verified
            profile.verified_at = datetime.utcnow()
            doctor.bmdc_verified = True
            doctor.verification_method = request.verification_method
            doctor.verification_notes = request.notes
        else:
            profile.verification_status = VerificationStatus.rejected
            doctor.bmdc_verified = False
            doctor.verification_notes = request.notes
        
        await db.commit()
    
    return {
        "status": "verified" if request.approved else "rejected",
        "doctor_id": doctor_id
    }

@router.get("/doctors")
async def get_all_doctors(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Get all doctors with their verification status"""
    result = await db.execute(
        select(Profile, DoctorProfile)
        .join(DoctorProfile, Profile.id == DoctorProfile.profile_id)
        .where(Profile.role == UserRole.DOCTOR)
    )
    
    doctors = []
    for profile, doctor in result.all():
        doctors.append({
            "id": profile.id,
            "name": f"{profile.first_name} {profile.last_name}",
            "email": profile.email,
            "bmdc_number": doctor.bmdc_number,
            "specialization": doctor.specialization,
            "verification_status": profile.verification_status.value,
            "verified_at": profile.verified_at.isoformat() if profile.verified_at else None,
            "account_status": profile.status.value if profile.status else "active",
        })
    
    return {"doctors": doctors}

@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Get comprehensive platform statistics"""
    try:
        from app.db.models.appointment import Appointment, AppointmentStatus
        from datetime import timedelta
        total_users_result = await db.execute(select(func.count(Profile.id)))
        total_users = total_users_result.scalar() or 0

        role_counts_result = await db.execute(
            select(Profile.role, func.count(Profile.id)).group_by(Profile.role)
        )
        role_counts = {row[0]: row[1] for row in role_counts_result.all()}

        doctor_verification_result = await db.execute(
            select(Profile.verification_status, func.count(Profile.id))
            .where(Profile.role == UserRole.DOCTOR)
            .group_by(Profile.verification_status)
        )
        verification_counts = {row[0]: row[1] for row in doctor_verification_result.all()}

        patients_with_onboarding_result = await db.execute(
            select(func.count(Profile.id)).where(
                Profile.role == UserRole.PATIENT,
                Profile.onboarding_completed.is_(True),
            )
        )
        patients_with_onboarding = patients_with_onboarding_result.scalar() or 0

        appointment_stats_result = await db.execute(
            select(
                func.count(Appointment.id).label("total"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.PENDING).label("pending"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.CONFIRMED).label("confirmed"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.COMPLETED).label("completed"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.CANCELLED).label("cancelled"),
            )
        )
        appointment_stats = appointment_stats_result.one()

        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_users_result = await db.execute(
            select(func.count(Profile.id)).where(Profile.created_at >= week_ago)
        )
        recent_registrations = recent_users_result.scalar() or 0

        return {
            "total_users": total_users,
            "total_doctors": role_counts.get(UserRole.DOCTOR, 0),
            "total_patients": role_counts.get(UserRole.PATIENT, 0),
            "verified_doctors": verification_counts.get(VerificationStatus.verified, 0),
            "pending_doctors": verification_counts.get(VerificationStatus.pending, 0),
            "rejected_doctors": verification_counts.get(VerificationStatus.rejected, 0),
            "patients_with_complete_profile": patients_with_onboarding,
            "total_appointments": appointment_stats.total or 0,
            "pending_appointments": appointment_stats.pending or 0,
            "confirmed_appointments": appointment_stats.confirmed or 0,
            "completed_appointments": appointment_stats.completed or 0,
            "cancelled_appointments": appointment_stats.cancelled or 0,
            "recent_registrations_7days": recent_registrations,
        }
        
    except Exception as e:
        # Return zeros if there's an error
        return {
            "total_users": 0,
            "total_doctors": 0,
            "total_patients": 0,
            "verified_doctors": 0,
            "pending_doctors": 0,
            "rejected_doctors": 0,
            "patients_with_complete_profile": 0,
            "total_appointments": 0,
            "pending_appointments": 0,
            "confirmed_appointments": 0,
            "completed_appointments": 0,
            "cancelled_appointments": 0,
            "recent_registrations_7days": 0,
        }


@router.get("/patients")
async def get_all_patients(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
    limit: int = 50,
    offset: int = 0
):
    """Get all patients with pagination"""
    try:
        from app.db.models.patient import PatientProfile
        
        result = await db.execute(
            select(Profile, PatientProfile)
            .join(PatientProfile, Profile.id == PatientProfile.profile_id, isouter=True)
            .where(Profile.role == UserRole.PATIENT)
            .limit(limit)
            .offset(offset)
        )
        
        patients = []
        for profile, patient in result.all():
            patients.append({
                "id": profile.id,
                "name": f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "No Name",
                "email": profile.email,
                "phone": profile.phone,
                "onboarding_completed": profile.onboarding_completed,
                "created_at": profile.created_at.isoformat() if profile.created_at else None,
                "blood_group": patient.blood_group if patient else None,
                "city": patient.city if patient else None,
                "account_status": profile.status.value if profile.status else "active",
            })
        
        # Get total count
        count_result = await db.execute(
            select(func.count(Profile.id)).where(Profile.role == UserRole.PATIENT)
        )
        total = count_result.scalar() or 0

        return {
            "patients": patients,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception:
        return {
            "patients": [],
            "total": 0,
            "limit": limit,
            "offset": offset
        }


@router.get("/appointments")
async def get_all_appointments(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    sort: str = "desc",
):
    """Get all appointments with doctor/patient info, server-side filtering & sorting."""
    from app.db.models.appointment import Appointment, AppointmentStatus as ApptStatus
    doctor_alias = aliased(Profile)
    patient_alias = aliased(Profile)

    base = (
        select(Appointment, doctor_alias, patient_alias)
        .join(doctor_alias, doctor_alias.id == Appointment.doctor_id, isouter=True)
        .join(patient_alias, patient_alias.id == Appointment.patient_id, isouter=True)
    )

    # --- filters ---
    if status and status != "all":
        # Support comma-separated multi-status (e.g. "pending_admin_review,reschedule_requested")
        statuses = [s.strip().upper() for s in status.split(",") if s.strip()]
        valid = []
        for s in statuses:
            try:
                valid.append(ApptStatus(s))
            except ValueError:
                pass
        if valid:
            base = base.where(Appointment.status.in_(valid))

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from)
            base = base.where(Appointment.appointment_date >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to)
            # Include the full day
            dt_to = dt_to.replace(hour=23, minute=59, second=59)
            base = base.where(Appointment.appointment_date <= dt_to)
        except ValueError:
            pass

    if search:
        term = f"%{search.strip().lower()}%"
        base = base.where(
            func.lower(
                func.concat(
                    func.coalesce(doctor_alias.first_name, ""), " ",
                    func.coalesce(doctor_alias.last_name, ""), " ",
                    func.coalesce(patient_alias.first_name, ""), " ",
                    func.coalesce(patient_alias.last_name, ""),
                )
            ).like(term)
        )

    # --- count (with same filters, before pagination) ---
    count_base = base.with_only_columns(func.count()).order_by(None)
    count_result = await db.execute(count_base)
    total = count_result.scalar() or 0

    # --- sort & paginate ---
    order = Appointment.appointment_date.asc() if sort == "asc" else Appointment.appointment_date.desc()
    result = await db.execute(base.order_by(order).limit(limit).offset(offset))

    appointments = []
    for appointment, doctor, patient in result.all():
        status_value = appointment.status.value if hasattr(appointment.status, "value") else str(appointment.status)
        appointments.append({
            "id": appointment.id,
            "appointment_date": appointment.appointment_date.isoformat(),
            "status": status_value.lower(),
            "reason": appointment.reason,
            "notes": appointment.notes,
            "duration_minutes": appointment.duration_minutes,
            "doctor": {
                "id": doctor.id if doctor else None,
                "name": f"{doctor.first_name} {doctor.last_name}" if doctor else "Unknown"
            },
            "patient": {
                "id": patient.id if patient else None,
                "name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown"
            }
        })

    return {
        "appointments": appointments,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/appointments/summary")
async def get_appointment_summary(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    """Aggregated appointment stats for the admin dashboard header cards."""
    from app.db.models.appointment import Appointment, AppointmentStatus as ApptStatus
    from datetime import timedelta

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)

    result = await db.execute(
        select(
            func.count(Appointment.id).label("total"),
            func.count(Appointment.id).filter(
                Appointment.status.in_([
                    ApptStatus.PENDING_ADMIN_REVIEW,
                    ApptStatus.RESCHEDULE_REQUESTED,
                    ApptStatus.CANCEL_REQUESTED,
                ])
            ).label("needs_attention"),
            func.count(Appointment.id).filter(
                Appointment.appointment_date >= today_start,
                Appointment.appointment_date < today_end,
                Appointment.status.notin_([ApptStatus.CANCELLED, ApptStatus.NO_SHOW]),
            ).label("today"),
            func.count(Appointment.id).filter(
                Appointment.appointment_date >= today_start,
                Appointment.appointment_date < week_end,
                Appointment.status.notin_([ApptStatus.CANCELLED, ApptStatus.NO_SHOW]),
            ).label("this_week"),
            func.count(Appointment.id).filter(Appointment.status == ApptStatus.CONFIRMED).label("confirmed"),
            func.count(Appointment.id).filter(Appointment.status == ApptStatus.PENDING).label("pending"),
            func.count(Appointment.id).filter(Appointment.status == ApptStatus.COMPLETED).label("completed"),
            func.count(Appointment.id).filter(Appointment.status == ApptStatus.CANCELLED).label("cancelled"),
            func.count(Appointment.id).filter(Appointment.status == ApptStatus.NO_SHOW).label("no_show"),
        )
    )
    row = result.one()

    return {
        "total": row.total or 0,
        "needs_attention": row.needs_attention or 0,
        "today": row.today or 0,
        "this_week": row.this_week or 0,
        "confirmed": row.confirmed or 0,
        "pending": row.pending or 0,
        "completed": row.completed or 0,
        "cancelled": row.cancelled or 0,
        "no_show": row.no_show or 0,
    }


# Schedule review endpoints
@router.get("/schedule-review")
async def get_schedules_needing_review(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
    limit: int = 100,
    offset: int = 0
):
    """List doctors whose time slots need review"""
    result = await db.execute(
        select(Profile, DoctorProfile)
        .join(DoctorProfile, Profile.id == DoctorProfile.profile_id)
        .where(Profile.role == UserRole.DOCTOR)
        .where(DoctorProfile.time_slots_needs_review == True)
        .limit(limit)
        .offset(offset)
    )

    rows = result.all()
    doctors = []
    for profile, doctor in rows:
        doctors.append({
            "profile_id": profile.id,
            "name": f"{profile.first_name} {profile.last_name}",
            "email": profile.email,
            "time_slots": doctor.time_slots,
            "normalized_time_slots": getattr(doctor, 'normalized_time_slots', None)
        })

    return {"doctors": doctors, "total": len(doctors)}


class ScheduleFixRequest(BaseModel):
    profile_id: str
    normalized_time_slots: str


@router.post("/schedule-review/fix")
async def fix_schedule_row(
    data: ScheduleFixRequest,
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Apply a normalized time_slots for a doctor's profile and clear the review flag"""
    # Ensure doctor exists
    result = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == data.profile_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    await db.execute(
        update(DoctorProfile)
        .where(DoctorProfile.profile_id == data.profile_id)
        .values(
            time_slots=data.normalized_time_slots,
            normalized_time_slots=data.normalized_time_slots,
            time_slots_needs_review=False
        )
    )
    await db.commit()

    return {"success": True, "profile_id": data.profile_id, "normalized_time_slots": data.normalized_time_slots}

# Ban/Unban User
class BanUserRequest(BaseModel):
    reason: str | None = None

@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    request: BanUserRequest,
    admin_access = Depends(require_admin_access),
    db: AsyncSession = Depends(get_db)
):
    """Ban a user by setting their account status to banned"""
    try:
        # Get user profile
        result = await db.execute(
            select(Profile).where(Profile.id == user_id)
        )
        profile = result.scalar()
        
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent banning admins
        if profile.role == UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Cannot ban admin users")
        
        # Update status to banned
        await db.execute(
            update(Profile)
            .where(Profile.id == user_id)
            .values(status=AccountStatus.banned, updated_at=datetime.utcnow())
        )
        await db.commit()
        
        return {
            "status": "success",
            "message": f"User {profile.first_name} {profile.last_name} has been banned",
            "user_id": user_id
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to ban user: {str(e)}")

@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    admin_access = Depends(require_admin_access),
    db: AsyncSession = Depends(get_db)
):
    """Unban a user by setting their account status back to active"""
    try:
        # Get user profile
        result = await db.execute(
            select(Profile).where(Profile.id == user_id)
        )
        profile = result.scalar()
        
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update status to active
        await db.execute(
            update(Profile)
            .where(Profile.id == user_id)
            .values(status=AccountStatus.active, updated_at=datetime.utcnow())
        )
        await db.commit()
        
        return {
            "status": "success",
            "message": f"User {profile.first_name} {profile.last_name} has been unbanned",
            "user_id": user_id
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to unban user: {str(e)}")


# ========== APPOINTMENT MANAGEMENT ==========


@router.get("/appointment-requests")
async def get_pending_appointment_requests(
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
    limit: int = 50,
    offset: int = 0,
):
    """Get all pending appointment requests for admin review."""
    from app.db.models.appointment_request import AppointmentRequest, AppointmentRequestStatus

    result = await db.execute(
        select(AppointmentRequest)
        .where(AppointmentRequest.status == AppointmentRequestStatus.PENDING)
        .order_by(AppointmentRequest.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    requests = result.scalars().all()

    # Get names
    profile_ids = set()
    for req in requests:
        profile_ids.add(req.doctor_id)
        profile_ids.add(req.patient_id)

    profiles_by_id = {}
    if profile_ids:
        profile_rows = await db.execute(
            select(Profile).where(Profile.id.in_(profile_ids))
        )
        profiles_by_id = {p.id: p for p in profile_rows.scalars().all()}

    count_result = await db.execute(
        select(func.count(AppointmentRequest.id)).where(
            AppointmentRequest.status == AppointmentRequestStatus.PENDING
        )
    )
    total = count_result.scalar() or 0

    return {
        "requests": [
            {
                "id": r.id,
                "doctor_id": r.doctor_id,
                "patient_id": r.patient_id,
                "doctor_name": f"{profiles_by_id[r.doctor_id].first_name} {profiles_by_id[r.doctor_id].last_name}"
                if r.doctor_id in profiles_by_id else "Unknown",
                "patient_name": f"{profiles_by_id[r.patient_id].first_name} {profiles_by_id[r.patient_id].last_name}"
                if r.patient_id in profiles_by_id else "Unknown",
                "requested_date": r.requested_date.isoformat(),
                "requested_time": r.requested_time.isoformat(),
                "requested_duration": r.requested_duration,
                "status": r.status.value,
                "admin_notes": r.admin_notes,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in requests
        ],
        "total": total,
    }


@router.post("/appointment-requests/{request_id}/approve")
async def approve_appointment_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin approves a booking request, creating the actual appointment."""
    from app.db.models.appointment_request import AppointmentRequest, AppointmentRequestStatus
    from app.db.models.appointment import Appointment, AppointmentStatus as ApptStatus
    from app.db.models.appointment_audit import AppointmentAuditLog
    from app.services import notification_service
    import uuid as uuid_mod

    result = await db.execute(
        select(AppointmentRequest).where(AppointmentRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.status != AppointmentRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is no longer pending")

    # Create the actual appointment
    appointment_date = datetime(
        request.requested_date.year,
        request.requested_date.month,
        request.requested_date.day,
        request.requested_time.hour,
        request.requested_time.minute,
    )

    appointment_id = str(uuid_mod.uuid4())
    appointment = Appointment(
        id=appointment_id,
        doctor_id=request.doctor_id,
        patient_id=request.patient_id,
        appointment_date=appointment_date,
        slot_time=request.requested_time,
        duration_minutes=request.requested_duration,
        reason="Approved by admin",
        status=ApptStatus.CONFIRMED,
    )
    db.add(appointment)

    # Update request status
    request.status = AppointmentRequestStatus.APPROVED

    # Audit log
    audit = AppointmentAuditLog(
        id=str(uuid_mod.uuid4()),
        appointment_id=appointment_id,
        action_type="admin_approved",
        performed_by_id="admin",
        performed_by_role="admin",
        previous_status=None,
        new_status=ApptStatus.CONFIRMED.value,
        notes=f"Approved from request {request_id}",
    )
    db.add(audit)

    # Notify both parties
    patient_profile = await db.execute(
        select(Profile).where(Profile.id == request.patient_id)
    )
    patient = patient_profile.scalar_one_or_none()
    doctor_profile = await db.execute(
        select(Profile).where(Profile.id == request.doctor_id)
    )
    doctor = doctor_profile.scalar_one_or_none()

    if patient and doctor:
        appt_date_str = appointment_date.strftime("%b %d, %Y at %I:%M %p")
        doctor_name = f"Dr. {doctor.first_name} {doctor.last_name}"
        patient_name = f"{patient.first_name} {patient.last_name}"

        await notification_service.notify_appointment_confirmed(
            db, request.patient_id, doctor_name, appointment_id,
            request.doctor_id, appt_date_str,
        )
        await notification_service.notify_appointment_created(
            db, request.doctor_id, patient_name, appointment_id,
            request.patient_id, appt_date_str,
        )

    await db.commit()

    return {"detail": "Appointment request approved", "appointment_id": appointment_id}


class RejectRequest(BaseModel):
    notes: str | None = None


@router.post("/appointment-requests/{request_id}/reject")
async def reject_appointment_request(
    request_id: str,
    data: RejectRequest,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin rejects a booking request with optional notes."""
    from app.db.models.appointment_request import AppointmentRequest, AppointmentRequestStatus

    result = await db.execute(
        select(AppointmentRequest).where(AppointmentRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.status != AppointmentRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is no longer pending")

    request.status = AppointmentRequestStatus.REJECTED
    request.admin_notes = data.notes

    await db.commit()
    return {"detail": "Appointment request rejected"}


@router.get("/audit-logs")
async def get_audit_logs(
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
    appointment_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """Get appointment audit logs with optional filters."""
    from app.services import appointment_service

    logs, total = await appointment_service.get_audit_logs(
        db, appointment_id=appointment_id, limit=limit, offset=offset
    )

    # Get performer names
    performer_ids = {log.performed_by_id for log in logs}
    performers_by_id = {}
    if performer_ids:
        performer_rows = await db.execute(
            select(Profile).where(Profile.id.in_(performer_ids))
        )
        performers_by_id = {p.id: p for p in performer_rows.scalars().all()}

    return {
        "logs": [
            {
                "id": log.id,
                "appointment_id": log.appointment_id,
                "action_type": log.action_type,
                "performed_by_id": log.performed_by_id,
                "performed_by_role": log.performed_by_role,
                "performed_by_name": f"{performers_by_id[log.performed_by_id].first_name} {performers_by_id[log.performed_by_id].last_name}"
                if log.performed_by_id in performers_by_id else "System",
                "previous_status": log.previous_status,
                "new_status": log.new_status,
                "notes": log.notes,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            }
            for log in logs
        ],
        "total": total,
    }


class OverrideStatusRequest(BaseModel):
    status: str
    notes: str | None = None


@router.post("/appointments/{appointment_id}/override-status")
async def admin_override_appointment_status(
    appointment_id: str,
    data: OverrideStatusRequest,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin force-sets an appointment status with audit trail."""
    from app.db.models.appointment import Appointment, AppointmentStatus as ApptStatus
    from app.services import appointment_service

    try:
        new_status = ApptStatus(data.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")

    try:
        appointment = await appointment_service.transition_status(
            db,
            appointment_id=appointment_id,
            new_status=new_status,
            performed_by_id="admin",
            performed_by_role="admin",
            notes=data.notes or "Admin override",
        )
        await db.commit()
        return {
            "detail": "Status updated",
            "appointment_id": appointment.id,
            "new_status": appointment.status.value,
        }
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
