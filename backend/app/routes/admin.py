from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Header
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, update
from sqlalchemy.orm import aliased
from app.core.dependencies import get_db, resolve_profile
from app.routes.auth import get_current_user_token
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import VerificationStatus, UserRole, AccountStatus
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from typing import Any
import re
import uuid
import logging
from app.services.email_service import send_account_suspension_email

router = APIRouter()
logger = logging.getLogger(__name__)

# Simple admin key for password-only access
ADMIN_PASSWORD = "admin123"
SYSTEM_ADMIN_PROFILE_ID = "admin"


async def _get_admin_actor_profile_id(db: AsyncSession) -> str:
    """Return a profile-backed admin actor ID for audit and FK-safe writes."""
    result = await db.execute(
        select(Profile).where(Profile.id == SYSTEM_ADMIN_PROFILE_ID)
    )
    profile = result.scalar_one_or_none()
    if profile:
        return profile.id

    db.add(
        Profile(
            id=SYSTEM_ADMIN_PROFILE_ID,
            role=UserRole.ADMIN,
            status=AccountStatus.active,
            verification_status=VerificationStatus.verified,
            first_name="System",
            last_name="Admin",
            email=None,
            phone=None,
            onboarding_completed=True,
        )
    )
    await db.flush()
    return SYSTEM_ADMIN_PROFILE_ID

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
    """Verify that the current user is an admin (reuses cached profile)."""
    profile = await resolve_profile(db, user)

    if not profile or profile.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    return profile

# ---------------------------------------------------------------------------
# Admin notifications
# ---------------------------------------------------------------------------
from app.db.models.notification import Notification  # noqa: E402


@router.get("/notifications")
async def list_admin_notifications(
    limit: int = 50,
    unread_only: bool = False,
    admin_access = Depends(require_admin_access),
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent admin-targeted notifications."""
    query = (
        select(Notification)
        .where(Notification.target_role == "admin")
        .order_by(Notification.created_at.desc())
        .limit(max(1, min(limit, 200)))
    )
    if unread_only:
        query = query.where(Notification.is_read == False)  # noqa: E712

    result = await db.execute(query)
    rows = result.scalars().all()

    unread_result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.target_role == "admin",
            Notification.is_read == False,  # noqa: E712
            Notification.is_archived == False,  # noqa: E712
        )
    )
    unread_count = int(unread_result.scalar() or 0)

    return {
        "notifications": [
            {
                "id": n.id,
                "type": n.type.value if hasattr(n.type, "value") else str(n.type),
                "priority": n.priority.value if hasattr(n.priority, "value") else str(n.priority),
                "title": n.title,
                "message": n.message,
                "action_url": n.action_url,
                "data": n.data,
                "is_read": n.is_read,
                "is_archived": n.is_archived,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "read_at": n.read_at.isoformat() if n.read_at else None,
            }
            for n in rows
        ],
        "unread_count": unread_count,
    }


class AdminNotificationMarkRead(BaseModel):
    notification_ids: list[str] | None = None
    mark_all: bool = False


@router.post("/notifications/mark-read")
async def mark_admin_notifications_read(
    payload: AdminNotificationMarkRead,
    admin_access = Depends(require_admin_access),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    stmt = (
        update(Notification)
        .where(Notification.target_role == "admin")
        .values(is_read=True, read_at=now)
    )
    if not payload.mark_all:
        ids = payload.notification_ids or []
        if not ids:
            return {"updated": 0}
        stmt = stmt.where(Notification.id.in_(ids))

    result = await db.execute(stmt)
    await db.commit()
    return {"updated": result.rowcount or 0}


# Verification request model
class VerifyDoctorRequest(BaseModel):
    verification_method: str = "manual"
    notes: str | None = None
    approved: bool = True


class UpdatePatientRequest(BaseModel):
    action: str | None = None
    reason: str | None = None
    severity: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    city: str | None = None
    blood_group: str | None = None
    onboarding_completed: bool | None = None


class PatientBulkActionRequest(BaseModel):
    action: str
    patient_ids: list[str]
    reason: str | None = None
    severity: str | None = None


class BanPatientRequest(BaseModel):
    reason: str
    severity: str | None = None


class DeletePatientRequest(BaseModel):
    reason: str
    severity: str | None = None


def _sanitize_reason(reason: str | None) -> str:
    raw = (reason or "").strip()
    # Collapse excessive whitespace and strip control characters.
    sanitized = re.sub(r"[\x00-\x1f\x7f]+", " ", raw)
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    return sanitized[:1000]


def _to_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class CreatePatientRequest(BaseModel):
    name: str
    email: str
    phone: str | None = None
    status: str = "active"
    city: str | None = None
    blood_group: str | None = None

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

        # Profile breakdown: 4 queries → 1 with FILTER aggregates.
        week_ago = datetime.utcnow() - timedelta(days=7)
        profile_stats_row = (
            await db.execute(
                select(
                    func.count(Profile.id).label("total_users"),
                    func.count(Profile.id).filter(Profile.role == UserRole.DOCTOR).label("total_doctors"),
                    func.count(Profile.id).filter(Profile.role == UserRole.PATIENT).label("total_patients"),
                    func.count(Profile.id)
                    .filter(
                        Profile.role == UserRole.DOCTOR,
                        Profile.verification_status == VerificationStatus.verified,
                    )
                    .label("verified_doctors"),
                    func.count(Profile.id)
                    .filter(
                        Profile.role == UserRole.DOCTOR,
                        Profile.verification_status == VerificationStatus.pending,
                    )
                    .label("pending_doctors"),
                    func.count(Profile.id)
                    .filter(
                        Profile.role == UserRole.DOCTOR,
                        Profile.verification_status == VerificationStatus.rejected,
                    )
                    .label("rejected_doctors"),
                    func.count(Profile.id)
                    .filter(
                        Profile.role == UserRole.PATIENT,
                        Profile.onboarding_completed.is_(True),
                    )
                    .label("patients_with_onboarding"),
                    func.count(Profile.id)
                    .filter(Profile.created_at >= week_ago)
                    .label("recent_registrations"),
                )
            )
        ).one()

        total_users = int(profile_stats_row.total_users or 0)
        role_counts = {
            UserRole.DOCTOR: int(profile_stats_row.total_doctors or 0),
            UserRole.PATIENT: int(profile_stats_row.total_patients or 0),
        }
        verification_counts = {
            VerificationStatus.verified: int(profile_stats_row.verified_doctors or 0),
            VerificationStatus.pending: int(profile_stats_row.pending_doctors or 0),
            VerificationStatus.rejected: int(profile_stats_row.rejected_doctors or 0),
        }
        patients_with_onboarding = int(profile_stats_row.patients_with_onboarding or 0)
        recent_registrations = int(profile_stats_row.recent_registrations or 0)

        appointment_stats_result = await db.execute(
            select(
                func.count(Appointment.id).label("total"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.PENDING).label("pending"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.CONFIRMED).label("confirmed"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.COMPLETED).label("completed"),
                func.count(Appointment.id).filter(
                    Appointment.status.in_(
                        [
                            AppointmentStatus.CANCELLED,
                            AppointmentStatus.CANCELLED_BY_PATIENT,
                            AppointmentStatus.CANCELLED_BY_DOCTOR,
                        ]
                    )
                ).label("cancelled"),
            )
        )
        appointment_stats = appointment_stats_result.one()

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
        safe_limit = max(1, limit)
        safe_offset = max(0, offset)

        result = await db.execute(
            select(Profile)
            .where(Profile.role == UserRole.PATIENT, Profile.status != AccountStatus.deleted)
            .limit(safe_limit)
            .offset(safe_offset)
        )
        
        patients = []
        for profile in result.scalars().all():
            patients.append({
                "id": profile.id,
                "name": f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "No Name",
                "email": profile.email,
                "phone": profile.phone,
                "onboarding_completed": profile.onboarding_completed,
                "created_at": profile.created_at.isoformat() if profile.created_at else None,
                "blood_group": None,
                "city": None,
                "account_status": profile.status.value if profile.status else "active",
                "ban_reason": profile.ban_reason,
                "avatar_url": None,
                "medical_reports_count": 0,
            })
        
        # Get total count
        count_result = await db.execute(
            select(func.count(Profile.id)).where(Profile.role == UserRole.PATIENT, Profile.status != AccountStatus.deleted)
        )
        total = count_result.scalar() or 0

        return {
            "success": True,
            "message": "Patients fetched successfully",
            "data": patients,
            "patients": patients,
            "total": total,
            "limit": safe_limit,
            "offset": safe_offset
        }
    except Exception as error:
        logger.exception("Failed to fetch patients list", extra={"limit": limit, "offset": offset})
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to fetch patients",
                "data": [],
                "patients": [],
                "total": 0,
                "limit": max(1, limit),
                "offset": max(0, offset),
                "error": str(error),
            },
        )


@router.post("/patients")
async def create_patient(
    payload: CreatePatientRequest,
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    from app.db.models.patient import PatientProfile

    full_name = payload.name.strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Name is required")

    if not payload.email or not payload.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")

    email = payload.email.strip().lower()

    existing_result = await db.execute(select(Profile).where(Profile.email == email))
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")

    parts = [part for part in full_name.split() if part]
    first_name = parts[0]
    last_name = " ".join(parts[1:]) if len(parts) > 1 else "Patient"

    requested_status = (payload.status or "active").lower()
    if requested_status == "banned":
        account_status = AccountStatus.banned
    elif requested_status in {"suspended", "inactive"}:
        account_status = AccountStatus.suspended
    else:
        account_status = AccountStatus.active

    now = datetime.utcnow()
    profile_id = str(uuid.uuid4())

    profile = Profile(
        id=profile_id,
        role=UserRole.PATIENT,
        status=account_status,
        verification_status=VerificationStatus.verified,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=payload.phone.strip() if payload.phone else None,
        onboarding_completed=False,
        created_at=now,
        updated_at=now,
    )

    patient = PatientProfile(
        profile_id=profile_id,
        city=payload.city,
        blood_group=payload.blood_group,
        notifications=True,
        created_at=now,
        updated_at=now,
    )

    db.add(profile)
    db.add(patient)
    await db.commit()

    return {
        "id": profile_id,
        "name": f"{first_name} {last_name}".strip(),
        "email": email,
        "phone": profile.phone,
        "city": payload.city,
        "blood_group": payload.blood_group,
        "account_status": account_status.value,
    }


@router.get("/patients/{patient_id:uuid}")
async def get_patient_by_id(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    from app.db.models.patient import PatientProfile
    patient_id_str = str(patient_id)

    result = await db.execute(
        select(Profile, PatientProfile)
        .join(PatientProfile, Profile.id == PatientProfile.profile_id, isouter=True)
        .where(Profile.id == patient_id_str, Profile.role == UserRole.PATIENT)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")

    profile, patient = row
    tests = patient.medical_tests if patient and isinstance(patient.medical_tests, list) else []
    patient_data: dict[str, Any] = {}
    if patient is not None:
        for column in patient.__table__.columns:
            key = column.name
            value = getattr(patient, key)
            if isinstance(value, (datetime,)):
                patient_data[key] = value.isoformat()
            elif hasattr(value, "isoformat") and value is not None:
                patient_data[key] = value.isoformat()
            else:
                patient_data[key] = value

    return {
        "id": profile.id,
        "name": f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "No Name",
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": profile.email,
        "phone": profile.phone,
        "status": profile.status.value if profile.status else "active",
        "ban_reason": profile.ban_reason,
        "delete_reason": profile.delete_reason,
        "banned_at": profile.banned_at.isoformat() if profile.banned_at else None,
        "banned_by": profile.banned_by,
        "onboarding_completed": profile.onboarding_completed,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        "medical_reports_count": len(tests),
        "medical_tests": tests,
        **patient_data,
    }


@router.put("/patients/{patient_id:uuid}")
async def replace_patient_data(
    patient_id: uuid.UUID,
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    from app.db.models.patient import PatientProfile
    patient_id_str = str(patient_id)

    result = await db.execute(
        select(Profile, PatientProfile)
        .join(PatientProfile, Profile.id == PatientProfile.profile_id, isouter=True)
        .where(Profile.id == patient_id_str, Profile.role == UserRole.PATIENT)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")

    profile, patient = row
    if patient is None:
        patient = PatientProfile(profile_id=profile.id)
        db.add(patient)

    now = datetime.utcnow()

    profile_fields = {column.name for column in Profile.__table__.columns}
    patient_fields = {column.name for column in PatientProfile.__table__.columns}
    readonly_profile_fields = {"id", "role", "verification_status", "created_at"}
    readonly_patient_fields = {"profile_id", "created_at"}

    for key, value in payload.items():
        if key in profile_fields and key not in readonly_profile_fields:
            setattr(profile, key, value)
        if key in patient_fields and key not in readonly_patient_fields:
            setattr(patient, key, value)

    profile.updated_at = now
    patient.updated_at = now
    await db.commit()

    return {"status": "success", "patient_id": patient_id_str}


@router.get("/patients/stats")
async def get_patient_stats(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    total_result = await db.execute(
        select(func.count(Profile.id)).where(
            Profile.role == UserRole.PATIENT,
            Profile.status != AccountStatus.deleted,
        )
    )
    active_result = await db.execute(
        select(func.count(Profile.id)).where(
            Profile.role == UserRole.PATIENT,
            Profile.status == AccountStatus.active,
            Profile.onboarding_completed.is_(True),
        )
    )
    incomplete_result = await db.execute(
        select(func.count(Profile.id)).where(
            Profile.role == UserRole.PATIENT,
            Profile.status != AccountStatus.banned,
            Profile.onboarding_completed.is_(False),
        )
    )
    banned_result = await db.execute(
        select(func.count(Profile.id)).where(
            Profile.role == UserRole.PATIENT,
            Profile.status == AccountStatus.banned,
        )
    )

    return {
        "total": total_result.scalar() or 0,
        "active": active_result.scalar() or 0,
        "incomplete": incomplete_result.scalar() or 0,
        "banned": banned_result.scalar() or 0,
    }


@router.get("/patients/charts")
async def get_patient_charts(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    now = datetime.utcnow()
    month_cursor = datetime(now.year, now.month, 1)
    month_keys = []
    month_labels = []
    for step in range(5, -1, -1):
        dt = month_cursor - timedelta(days=step * 30)
        dt = datetime(dt.year, dt.month, 1)
        key = dt.strftime("%Y-%m")
        month_keys.append(key)
        month_labels.append(dt.strftime("%b"))

    created_rows = await db.execute(
        select(Profile.created_at).where(
            Profile.role == UserRole.PATIENT,
            Profile.created_at >= datetime.strptime(month_keys[0] + "-01", "%Y-%m-%d"),
        )
    )

    growth_map = {key: 0 for key in month_keys}
    for (created_at,) in created_rows.all():
        if not created_at:
            continue
        key = created_at.strftime("%Y-%m")
        if key in growth_map:
            growth_map[key] += 1

    stats = await get_patient_stats(db=db, admin_access=True)

    growth = []
    for index, key in enumerate(month_keys):
        growth.append({
            "key": key,
            "label": month_labels[index],
            "registrations": growth_map[key],
        })

    distribution = [
        {"name": "Active", "value": stats["active"], "color": "#1D63D6"},
        {"name": "Incomplete", "value": stats["incomplete"], "color": "#D97706"},
        {"name": "Banned", "value": stats["banned"], "color": "#DC2626"},
    ]

    return {
        "growth": growth,
        "distribution": distribution,
    }


@router.get("/patients/insights")
async def get_patient_insights(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    todays_registrations_result = await db.execute(
        select(func.count(Profile.id)).where(
            Profile.role == UserRole.PATIENT,
            Profile.created_at >= day_start,
        )
    )

    pending_reviews_result = await db.execute(
        select(func.count(Profile.id)).where(
            Profile.role == UserRole.PATIENT,
            Profile.status != AccountStatus.banned,
            Profile.onboarding_completed.is_(False),
        )
    )

    recent_result = await db.execute(
        select(Profile)
        .where(Profile.role == UserRole.PATIENT)
        .order_by(Profile.updated_at.desc())
        .limit(10)
    )
    recent_profiles = recent_result.scalars().all()

    activity = []
    for profile in recent_profiles:
        created_at = _to_utc(profile.created_at)
        updated_at = _to_utc(profile.updated_at)
        full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "Patient"
        if profile.status == AccountStatus.banned:
            event_type = "account_banned"
            message = f"{full_name} account was banned"
        elif created_at and (now - created_at) <= timedelta(hours=24):
            event_type = "registration"
            message = f"New patient registration: {full_name}"
        else:
            event_type = "profile_updated"
            message = f"{full_name} profile updated"

        activity.append({
            "id": profile.id,
            "type": event_type,
            "message": message,
            "timestamp": (updated_at or created_at or now).isoformat(),
        })

    return {
        "todaysRegistrations": todays_registrations_result.scalar() or 0,
        "pendingReviews": pending_reviews_result.scalar() or 0,
        "recentActivity": activity,
    }


@router.patch("/patients/{patient_id:uuid}")
async def update_patient(
    patient_id: uuid.UUID,
    data: UpdatePatientRequest,
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    from app.db.models.patient import PatientProfile
    patient_id_str = str(patient_id)

    result = await db.execute(
        select(Profile, PatientProfile)
        .join(PatientProfile, Profile.id == PatientProfile.profile_id, isouter=True)
        .where(Profile.id == patient_id_str, Profile.role == UserRole.PATIENT)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")

    profile, patient = row
    now = datetime.utcnow()

    if data.action:
        action = data.action.lower()
        reason = _sanitize_reason(data.reason)
        if action in {"activate", "unban"}:
            profile.status = AccountStatus.active
            profile.ban_reason = None
            profile.banned_at = None
            profile.banned_by = None
        elif action in {"deactivate", "suspend"}:
            profile.status = AccountStatus.suspended
        elif action == "ban":
            if not reason:
                raise HTTPException(status_code=400, detail="Reason is required for ban action")
            profile.status = AccountStatus.banned
            profile.ban_reason = reason
            profile.banned_at = now
            profile.banned_by = "admin_password_auth"

    if data.first_name is not None:
        profile.first_name = data.first_name
    if data.last_name is not None:
        profile.last_name = data.last_name
    if data.phone is not None:
        profile.phone = data.phone
    if data.onboarding_completed is not None:
        profile.onboarding_completed = data.onboarding_completed

    if patient is None and any(value is not None for value in [data.city, data.blood_group]):
        patient = PatientProfile(profile_id=profile.id)
        db.add(patient)

    if patient is not None:
        if data.city is not None:
            patient.city = data.city
        if data.blood_group is not None:
            patient.blood_group = data.blood_group
        patient.updated_at = now

    profile.updated_at = now
    await db.commit()

    return {"status": "success", "patient_id": patient_id_str}


@router.patch("/patients/{patient_id:uuid}/ban")
async def ban_patient(
    patient_id: uuid.UUID,
    payload: BanPatientRequest,
    background_tasks: BackgroundTasks,
    x_admin_user_id: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    patient_id_str = str(patient_id)
    result = await db.execute(
        select(Profile).where(Profile.id == patient_id_str, Profile.role == UserRole.PATIENT)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")

    reason = _sanitize_reason(payload.reason)
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    now = datetime.utcnow()
    profile.status = AccountStatus.banned
    profile.ban_reason = reason
    profile.banned_at = now
    profile.banned_by = (x_admin_user_id or "admin_password_auth").strip()[:128]
    profile.updated_at = now

    await db.commit()

    full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "Patient"
    # Dispatch SMTP off-request — smtplib is blocking and the admin should not
    # wait for mail server round-trips.
    background_tasks.add_task(
        send_account_suspension_email,
        to_email=profile.email or "",
        full_name=full_name,
        reason=reason,
    )

    return {"status": "banned", "patient_id": patient_id_str, "reason": reason}


@router.delete("/patients/{patient_id:uuid}")
async def delete_patient(
    patient_id: uuid.UUID,
    payload: DeletePatientRequest,
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    patient_id_str = str(patient_id)
    result = await db.execute(
        select(Profile).where(Profile.id == patient_id_str, Profile.role == UserRole.PATIENT)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")

    reason = _sanitize_reason(payload.reason)
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required for delete action")

    # Safe soft-delete/anonymize to avoid foreign key breakage with historical records.
    profile.status = AccountStatus.deleted
    profile.first_name = "Deleted"
    profile.last_name = "Patient"
    profile.email = f"deleted+{patient_id_str[:8]}@medora.local"
    profile.phone = None
    profile.onboarding_completed = False
    profile.delete_reason = reason
    profile.updated_at = datetime.utcnow()
    await db.commit()

    return {"status": "deleted", "patient_id": patient_id_str, "reason": reason}


@router.post("/patients/bulk-action")
async def bulk_patient_action(
    payload: PatientBulkActionRequest,
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
):
    if not payload.patient_ids:
        raise HTTPException(status_code=400, detail="No patient IDs provided")

    # Cap the batch to avoid massive IN clauses that can slow the planner.
    MAX_BULK_PATIENTS = 500
    if len(payload.patient_ids) > MAX_BULK_PATIENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Bulk action limited to {MAX_BULK_PATIENTS} patients per request",
        )

    result = await db.execute(
        select(Profile)
        .where(Profile.role == UserRole.PATIENT, Profile.id.in_(payload.patient_ids))
    )
    profiles = result.scalars().all()
    if not profiles:
        return {"status": "success", "updated": 0}

    now = datetime.utcnow()
    action = payload.action.lower()
    updated = 0

    for profile in profiles:
        reason = _sanitize_reason(payload.reason)
        if action in {"activate", "unban"}:
            profile.status = AccountStatus.active
            profile.ban_reason = None
            profile.banned_at = None
            profile.banned_by = None
        elif action in {"deactivate", "suspend"}:
            profile.status = AccountStatus.suspended
        elif action == "ban":
            if not reason:
                raise HTTPException(status_code=400, detail="Reason is required for bulk ban")
            profile.status = AccountStatus.banned
            profile.ban_reason = reason
            profile.banned_at = now
            profile.banned_by = "admin_password_auth"
        elif action == "delete":
            if not reason:
                raise HTTPException(status_code=400, detail="Reason is required for bulk delete")
            profile.status = AccountStatus.deleted
            profile.first_name = "Deleted"
            profile.last_name = "Patient"
            profile.email = f"deleted+{profile.id[:8]}@medora.local"
            profile.phone = None
            profile.onboarding_completed = False
            profile.delete_reason = reason
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported action: {payload.action}")

        profile.updated_at = now
        updated += 1

    await db.commit()
    return {"status": "success", "updated": updated, "action": payload.action}


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

    cancellation_statuses = [
        ApptStatus.CANCELLED,
        ApptStatus.CANCELLED_BY_PATIENT,
        ApptStatus.CANCELLED_BY_DOCTOR,
    ]

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
                Appointment.status.notin_([*cancellation_statuses, ApptStatus.NO_SHOW]),
            ).label("today"),
            func.count(Appointment.id).filter(
                Appointment.appointment_date >= today_start,
                Appointment.appointment_date < week_end,
                Appointment.status.notin_([*cancellation_statuses, ApptStatus.NO_SHOW]),
            ).label("this_week"),
            func.count(Appointment.id).filter(Appointment.status == ApptStatus.CONFIRMED).label("confirmed"),
            func.count(Appointment.id).filter(Appointment.status == ApptStatus.PENDING).label("pending"),
            func.count(Appointment.id).filter(Appointment.status == ApptStatus.COMPLETED).label("completed"),
            func.count(Appointment.id).filter(Appointment.status.in_(cancellation_statuses)).label("cancelled"),
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


@router.get("/appointments/pending-review")
async def get_pending_admin_review_appointments(
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
    limit: int = 50,
    offset: int = 0,
):
    """List appointments awaiting admin approval (new patient bookings)."""
    from app.db.models.appointment import Appointment, AppointmentStatus as ApptStatus

    doctor_alias = aliased(Profile)
    patient_alias = aliased(Profile)

    query = (
        select(Appointment, doctor_alias, patient_alias)
        .join(doctor_alias, doctor_alias.id == Appointment.doctor_id, isouter=True)
        .join(patient_alias, patient_alias.id == Appointment.patient_id, isouter=True)
        .where(Appointment.status == ApptStatus.PENDING_ADMIN_REVIEW)
        .order_by(Appointment.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)

    items = []
    for appt, doctor, patient in result.all():
        items.append({
            "id": appt.id,
            "appointment_date": appt.appointment_date.isoformat(),
            "slot_time": appt.slot_time.isoformat() if appt.slot_time else None,
            "duration_minutes": appt.duration_minutes,
            "reason": appt.reason,
            "notes": appt.notes,
            "status": appt.status.value,
            "doctor": {
                "id": doctor.id if doctor else None,
                "name": f"{doctor.first_name} {doctor.last_name}" if doctor else "Unknown",
            },
            "patient": {
                "id": patient.id if patient else None,
                "name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
            },
            "created_at": appt.created_at.isoformat() if appt.created_at else None,
        })

    count_result = await db.execute(
        select(func.count(Appointment.id)).where(Appointment.status == ApptStatus.PENDING_ADMIN_REVIEW)
    )
    total = count_result.scalar() or 0

    return {"appointments": items, "total": total, "limit": limit, "offset": offset}


class AdminAppointmentDecision(BaseModel):
    notes: str | None = None


@router.post("/appointments/{appointment_id}/approve")
async def admin_approve_appointment(
    appointment_id: str,
    data: AdminAppointmentDecision,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin approves a pending appointment booking."""
    from app.db.models.appointment import Appointment, AppointmentStatus as ApptStatus
    from app.services import appointment_service, notification_service
    from app.db.models.notification import NotificationType, NotificationPriority

    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.status != ApptStatus.PENDING_ADMIN_REVIEW:
        raise HTTPException(status_code=400, detail="Appointment is not pending admin review")

    admin_actor_id = await _get_admin_actor_profile_id(db)

    try:
        await appointment_service.transition_status(
            db,
            appointment_id=appointment_id,
            new_status=ApptStatus.PENDING_DOCTOR_CONFIRMATION,
            performed_by_id=admin_actor_id,
            performed_by_role="admin",
            notes=data.notes or "Approved by admin; awaiting doctor confirmation",
        )
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    # Notify doctor that a new request is awaiting their confirmation, and patient that admin approved.
    try:
        doctor_result = await db.execute(select(Profile).where(Profile.id == appt.doctor_id))
        doctor = doctor_result.scalar_one_or_none()
        patient_result = await db.execute(select(Profile).where(Profile.id == appt.patient_id))
        patient = patient_result.scalar_one_or_none()
        if doctor and patient:
            patient_name = f"{patient.first_name} {patient.last_name}"
            schedule_label = appt.appointment_date.strftime("%b %d, %Y at %I:%M %p")
            await notification_service.create_notification(
                db=db,
                user_id=appt.doctor_id,
                notification_type=NotificationType.APPOINTMENT_BOOKED,
                title="New Appointment Awaiting Your Confirmation",
                message=f"{patient_name} requested an appointment on {schedule_label}. Review and confirm or decline.",
                action_url="/doctor/appointments",
                metadata={"appointment_id": appt.id},
                priority=NotificationPriority.HIGH,
            )
            await notification_service.create_notification(
                db=db,
                user_id=appt.patient_id,
                notification_type=NotificationType.APPOINTMENT_BOOKED,
                title="Admin Approved — Awaiting Doctor",
                message=f"Your appointment request for {schedule_label} has been approved by admin and is waiting for the doctor to confirm.",
                action_url="/patient/appointments",
                metadata={"appointment_id": appt.id},
                priority=NotificationPriority.MEDIUM,
            )
    except Exception as exc:
        logger.warning("Failed to notify on admin approval: %s", exc)

    await db.commit()
    return {
        "detail": "Appointment approved; awaiting doctor confirmation",
        "appointment_id": appointment_id,
        "status": ApptStatus.PENDING_DOCTOR_CONFIRMATION.value,
    }


@router.post("/appointments/{appointment_id}/reject")
async def admin_reject_appointment(
    appointment_id: str,
    data: AdminAppointmentDecision,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin rejects a pending appointment booking."""
    from app.db.models.appointment import Appointment, AppointmentStatus as ApptStatus
    from app.services import appointment_service

    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.status != ApptStatus.PENDING_ADMIN_REVIEW:
        raise HTTPException(status_code=400, detail="Appointment is not pending admin review")

    admin_actor_id = await _get_admin_actor_profile_id(db)

    try:
        await appointment_service.transition_status(
            db,
            appointment_id=appointment_id,
            new_status=ApptStatus.CANCELLED,
            performed_by_id=admin_actor_id,
            performed_by_role="admin",
            notes=data.notes or "Rejected by admin",
            cancellation_reason_key="ADMIN_REJECTED",
            cancellation_reason_note=data.notes or "Rejected by admin during review",
        )
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    await db.commit()
    return {"detail": "Appointment rejected", "appointment_id": appointment_id, "status": ApptStatus.CANCELLED.value}


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

    admin_actor_id = await _get_admin_actor_profile_id(db)

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
        performed_by_id=admin_actor_id,
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


@router.get("/reschedule-requests")
async def get_pending_reschedule_requests(
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
    limit: int = 50,
    offset: int = 0,
):
    """List reschedule requests awaiting admin approval."""
    from app.db.models.appointment_request import (
        AppointmentRescheduleRequest,
        AdminApprovalStatus,
        RescheduleRequestStatus,
    )
    from app.db.models.appointment import Appointment

    query = (
        select(AppointmentRescheduleRequest, Appointment)
        .join(Appointment, Appointment.id == AppointmentRescheduleRequest.appointment_id)
        .where(
            AppointmentRescheduleRequest.admin_approval_status == AdminApprovalStatus.PENDING,
            AppointmentRescheduleRequest.status == RescheduleRequestStatus.PENDING,
        )
        .order_by(AppointmentRescheduleRequest.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    rows = result.all()

    profile_ids: set[str] = set()
    for req, appt in rows:
        profile_ids.add(req.requested_by_id)
        profile_ids.add(appt.doctor_id)
        profile_ids.add(appt.patient_id)

    profiles_by_id: dict[str, Profile] = {}
    if profile_ids:
        p_result = await db.execute(select(Profile).where(Profile.id.in_(profile_ids)))
        profiles_by_id = {p.id: p for p in p_result.scalars().all()}

    def name_of(pid: str) -> str:
        p = profiles_by_id.get(pid)
        if not p:
            return "Unknown"
        return f"{p.first_name or ''} {p.last_name or ''}".strip() or "Unknown"

    items = []
    for req, appt in rows:
        items.append({
            "id": req.id,
            "appointment_id": req.appointment_id,
            "requested_by_id": req.requested_by_id,
            "requested_by_role": req.requested_by_role.value,
            "requested_by_name": name_of(req.requested_by_id),
            "patient_id": appt.patient_id,
            "patient_name": name_of(appt.patient_id),
            "doctor_id": appt.doctor_id,
            "doctor_name": name_of(appt.doctor_id),
            "current_date": appt.appointment_date.isoformat(),
            "current_slot": appt.slot_time.isoformat() if appt.slot_time else None,
            "proposed_date": req.proposed_date.isoformat(),
            "proposed_time": req.proposed_time.isoformat(),
            "reason": req.reason,
            "created_at": req.created_at.isoformat() if req.created_at else None,
        })

    count_result = await db.execute(
        select(func.count(AppointmentRescheduleRequest.id)).where(
            AppointmentRescheduleRequest.admin_approval_status == AdminApprovalStatus.PENDING,
            AppointmentRescheduleRequest.status == RescheduleRequestStatus.PENDING,
        )
    )
    total = count_result.scalar() or 0
    return {"requests": items, "total": total, "limit": limit, "offset": offset}


@router.post("/reschedule-requests/{request_id}/approve")
async def admin_approve_reschedule(
    request_id: str,
    data: AdminAppointmentDecision,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin approves a reschedule request so the other party can respond."""
    from app.services import appointment_service
    admin_actor_id = await _get_admin_actor_profile_id(db)
    try:
        await appointment_service.admin_approve_reschedule_request(
            db,
            reschedule_request_id=request_id,
            admin_id=admin_actor_id,
            notes=data.notes,
        )
        await db.commit()
        return {"detail": "Reschedule request approved", "request_id": request_id}
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reschedule-requests/{request_id}/reject")
async def admin_reject_reschedule(
    request_id: str,
    data: AdminAppointmentDecision,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin rejects a reschedule request; appointment returns to confirmed."""
    from app.services import appointment_service
    admin_actor_id = await _get_admin_actor_profile_id(db)
    try:
        await appointment_service.admin_reject_reschedule_request(
            db,
            reschedule_request_id=request_id,
            admin_id=admin_actor_id,
            notes=data.notes,
        )
        await db.commit()
        return {"detail": "Reschedule request rejected", "request_id": request_id}
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/cancellation-requests")
async def get_pending_cancellation_requests(
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
    limit: int = 50,
    offset: int = 0,
):
    """List cancellation requests awaiting admin approval."""
    from app.db.models.appointment_request import (
        AppointmentCancellationRequest,
        AdminApprovalStatus,
    )
    from app.db.models.appointment import Appointment

    query = (
        select(AppointmentCancellationRequest, Appointment)
        .join(Appointment, Appointment.id == AppointmentCancellationRequest.appointment_id)
        .where(AppointmentCancellationRequest.admin_approval_status == AdminApprovalStatus.PENDING)
        .order_by(AppointmentCancellationRequest.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(query)).all()

    profile_ids: set[str] = set()
    for req, appt in rows:
        profile_ids.add(req.requested_by_id)
        profile_ids.add(appt.doctor_id)
        profile_ids.add(appt.patient_id)

    profiles_by_id: dict[str, Profile] = {}
    if profile_ids:
        p_result = await db.execute(select(Profile).where(Profile.id.in_(profile_ids)))
        profiles_by_id = {p.id: p for p in p_result.scalars().all()}

    def name_of(pid: str) -> str:
        p = profiles_by_id.get(pid)
        if not p:
            return "Unknown"
        return f"{p.first_name or ''} {p.last_name or ''}".strip() or "Unknown"

    items = []
    for req, appt in rows:
        items.append({
            "id": req.id,
            "appointment_id": req.appointment_id,
            "requested_by_id": req.requested_by_id,
            "requested_by_role": req.requested_by_role.value,
            "requested_by_name": name_of(req.requested_by_id),
            "patient_id": appt.patient_id,
            "patient_name": name_of(appt.patient_id),
            "doctor_id": appt.doctor_id,
            "doctor_name": name_of(appt.doctor_id),
            "appointment_date": appt.appointment_date.isoformat(),
            "slot_time": appt.slot_time.isoformat() if appt.slot_time else None,
            "reason_key": req.reason_key,
            "reason_note": req.reason_note,
            "created_at": req.created_at.isoformat() if req.created_at else None,
        })

    count_result = await db.execute(
        select(func.count(AppointmentCancellationRequest.id)).where(
            AppointmentCancellationRequest.admin_approval_status == AdminApprovalStatus.PENDING,
        )
    )
    total = count_result.scalar() or 0
    return {"requests": items, "total": total, "limit": limit, "offset": offset}


@router.post("/cancellation-requests/{request_id}/approve")
async def admin_approve_cancellation(
    request_id: str,
    data: AdminAppointmentDecision,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin approves cancellation; slot is freed."""
    from app.services import appointment_service
    admin_actor_id = await _get_admin_actor_profile_id(db)
    try:
        await appointment_service.admin_approve_cancellation_request(
            db,
            cancellation_request_id=request_id,
            admin_id=admin_actor_id,
            notes=data.notes,
        )
        await db.commit()
        return {"detail": "Cancellation approved", "request_id": request_id}
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancellation-requests/{request_id}/reject")
async def admin_reject_cancellation(
    request_id: str,
    data: AdminAppointmentDecision,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin rejects cancellation; appointment returns to confirmed."""
    from app.services import appointment_service
    admin_actor_id = await _get_admin_actor_profile_id(db)
    try:
        await appointment_service.admin_reject_cancellation_request(
            db,
            cancellation_request_id=request_id,
            admin_id=admin_actor_id,
            notes=data.notes,
        )
        await db.commit()
        return {"detail": "Cancellation rejected", "request_id": request_id}
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


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
    status: str | None = None
    new_status: str | None = None
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
    from app.db.models.appointment_request import (
        AdminApprovalStatus,
        AppointmentRescheduleRequest,
        RescheduleRequestStatus,
    )
    from app.services import appointment_service

    requested_status = (data.status or data.new_status or "").strip()
    if not requested_status:
        raise HTTPException(status_code=400, detail="status is required")

    try:
        new_status = ApptStatus(requested_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {requested_status}")

    try:
        admin_actor_id = await _get_admin_actor_profile_id(db)

        # Backward-compatible admin flow: approving a reschedule from the generic
        # override panel must update the reschedule request admin status and emit
        # reschedule-specific notifications, not generic appointment confirmation.
        if new_status == ApptStatus.CONFIRMED:
            appointment_result = await db.execute(
                select(Appointment)
                .where(Appointment.id == appointment_id)
                .with_for_update()
            )
            appointment_row = appointment_result.scalar_one_or_none()
            if not appointment_row:
                raise HTTPException(status_code=404, detail="Appointment not found")

            if appointment_row.status == ApptStatus.RESCHEDULE_REQUESTED:
                request_result = await db.execute(
                    select(AppointmentRescheduleRequest)
                    .where(
                        AppointmentRescheduleRequest.appointment_id == appointment_id,
                        AppointmentRescheduleRequest.status == RescheduleRequestStatus.PENDING,
                    )
                    .order_by(AppointmentRescheduleRequest.created_at.desc())
                    .with_for_update()
                )
                reschedule_request = request_result.scalars().first()

                if not reschedule_request:
                    raise HTTPException(
                        status_code=400,
                        detail="No pending reschedule request found for this appointment",
                    )

                if reschedule_request.admin_approval_status == AdminApprovalStatus.PENDING:
                    await appointment_service.admin_approve_reschedule_request(
                        db,
                        reschedule_request_id=reschedule_request.id,
                        admin_id=admin_actor_id,
                        notes=data.notes or "Approved via admin status override",
                    )
                    await db.commit()
                    return {
                        "detail": "Reschedule request approved",
                        "appointment_id": appointment_row.id,
                        "new_status": appointment_row.status.value,
                        "reschedule_request_id": reschedule_request.id,
                        "admin_approval_status": reschedule_request.admin_approval_status.value,
                    }

                if reschedule_request.admin_approval_status == AdminApprovalStatus.APPROVED:
                    await db.commit()
                    return {
                        "detail": "Reschedule request is already approved",
                        "appointment_id": appointment_row.id,
                        "new_status": appointment_row.status.value,
                        "reschedule_request_id": reschedule_request.id,
                        "admin_approval_status": reschedule_request.admin_approval_status.value,
                    }

                raise HTTPException(
                    status_code=400,
                    detail="Reschedule request was already rejected by admin",
                )

        appointment = await appointment_service.transition_status(
            db,
            appointment_id=appointment_id,
            new_status=new_status,
            performed_by_id=admin_actor_id,
            performed_by_role="admin",
            notes=data.notes or "Admin override",
        )
        await db.commit()
        return {
            "detail": "Status updated",
            "appointment_id": appointment.id,
            "new_status": appointment.status.value,
        }
    except HTTPException:
        await db.rollback()
        raise
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


class AdminApproveAppointmentRequest(BaseModel):
    notes: str | None = None


@router.post("/appointments/{appointment_id}/approve")
async def admin_approve_new_appointment(
    appointment_id: str,
    data: AdminApproveAppointmentRequest,
    db: AsyncSession = Depends(get_db),
    admin_access=Depends(require_admin_access),
):
    """Admin approves a new appointment request.

    Instead of flipping straight to CONFIRMED, this moves the appointment into
    PENDING_DOCTOR_CONFIRMATION so the doctor still has a chance to opt in.
    The doctor and patient each confirm separately through their own endpoints.
    """
    from app.db.models.appointment import AppointmentStatus as ApptStatus
    from app.services import appointment_service

    admin_actor_id = await _get_admin_actor_profile_id(db)

    try:
        appointment = await appointment_service.transition_status(
            db,
            appointment_id=appointment_id,
            new_status=ApptStatus.PENDING_DOCTOR_CONFIRMATION,
            performed_by_id=admin_actor_id,
            performed_by_role="admin",
            notes=data.notes or "Approved by admin; awaiting doctor confirmation",
        )
        await db.commit()
        return {
            "detail": "Admin approved. Awaiting doctor confirmation.",
            "appointment_id": appointment.id,
            "new_status": appointment.status.value,
        }
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
