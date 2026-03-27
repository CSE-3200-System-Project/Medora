"""
Patient Data Sharing Preference endpoints.

Patients control what each doctor can see: profile, conditions, medications,
allergies, medical history, family history, lifestyle, vaccinations,
lab reports, health metrics, and prescriptions.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.db.models.appointment import Appointment
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import UserRole
from app.db.models.patient_data_sharing import (
    SHARING_CATEGORY_FIELDS,
    PatientDataSharingPreference,
)
from app.db.models.profile import Profile
from app.routes.auth import get_current_user_token
from app.schemas.patient_data_sharing import (
    DoctorSharingSummary,
    PatientDoctorListItem,
    SharingBulkUpdate,
    SharingCategoryResponse,
    SharingCategoryUpdate,
)

router = APIRouter()
logger = logging.getLogger(__name__)


async def _require_patient(user, db: AsyncSession) -> Profile:
    """Verify the current user is a patient."""
    profile = (
        await db.execute(select(Profile).where(Profile.id == user.id))
    ).scalar_one_or_none()
    if not profile or profile.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can manage data sharing preferences",
        )
    return profile


def _build_doctor_name(profile: Profile) -> str:
    first = getattr(profile, "first_name", "") or ""
    last = getattr(profile, "last_name", "") or ""
    return f"{first} {last}".strip() or "Doctor"


# ── List all doctors the patient has interacted with ─────────────────────────


@router.get("/doctors", response_model=list[PatientDoctorListItem])
async def list_patient_doctors(
    user=Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Return all doctors the patient has had appointments with,
    plus whether a sharing-preference record exists for each."""
    await _require_patient(user, db)

    # Distinct doctor IDs from appointments
    stmt = (
        select(distinct(Appointment.doctor_id))
        .where(Appointment.patient_id == user.id)
    )
    result = await db.execute(stmt)
    doctor_profile_ids: list[str] = [row[0] for row in result.all()]

    if not doctor_profile_ids:
        return []

    # Fetch doctor profiles + main profiles
    doctors = (
        await db.execute(
            select(DoctorProfile, Profile)
            .join(Profile, Profile.id == DoctorProfile.profile_id)
            .where(DoctorProfile.profile_id.in_(doctor_profile_ids))
        )
    ).all()

    # Check which doctors already have a sharing record
    existing_sharing = (
        await db.execute(
            select(PatientDataSharingPreference.doctor_id).where(
                PatientDataSharingPreference.patient_id == user.id,
                PatientDataSharingPreference.doctor_id.in_(doctor_profile_ids),
            )
        )
    )
    has_sharing = {row[0] for row in existing_sharing.all()}

    items = []
    for doc, prof in doctors:
        items.append(
            PatientDoctorListItem(
                doctor_id=prof.id,
                doctor_name=_build_doctor_name(prof),
                doctor_photo_url=getattr(doc, "profile_photo_url", None),
                specialization=getattr(doc, "specialization", None),
                has_sharing_record=prof.id in has_sharing,
            )
        )
    return items


# ── Get sharing preferences for a specific doctor ────────────────────────────


@router.get(
    "/doctors/{doctor_id}",
    response_model=DoctorSharingSummary,
)
async def get_sharing_for_doctor(
    doctor_id: str,
    user=Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get the patient's current sharing preferences for a specific doctor."""
    await _require_patient(user, db)

    pref = (
        await db.execute(
            select(PatientDataSharingPreference).where(
                PatientDataSharingPreference.patient_id == user.id,
                PatientDataSharingPreference.doctor_id == doctor_id,
            )
        )
    ).scalar_one_or_none()

    # Fetch doctor info
    doc_profile = (
        await db.execute(
            select(DoctorProfile, Profile)
            .join(Profile, Profile.id == DoctorProfile.profile_id)
            .where(DoctorProfile.profile_id == doctor_id)
        )
    ).first()

    if not doc_profile:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doc, prof = doc_profile

    if pref:
        sharing = SharingCategoryResponse.model_validate(pref)
    else:
        # All defaults to False
        sharing = SharingCategoryResponse(
            **{f: False for f in SHARING_CATEGORY_FIELDS}
        )

    return DoctorSharingSummary(
        doctor_id=prof.id,
        doctor_name=_build_doctor_name(prof),
        doctor_photo_url=getattr(doc, "profile_photo_url", None),
        specialization=getattr(doc, "specialization", None),
        sharing=sharing,
        created_at=pref.created_at if pref else None,
        updated_at=pref.updated_at if pref else None,
    )


# ── Get all sharing preferences (all doctors at once) ────────────────────────


@router.get("", response_model=list[DoctorSharingSummary])
async def list_all_sharing_preferences(
    user=Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Return sharing preferences for every doctor the patient has a record for."""
    await _require_patient(user, db)

    prefs = (
        await db.execute(
            select(PatientDataSharingPreference).where(
                PatientDataSharingPreference.patient_id == user.id
            )
        )
    ).scalars().all()

    if not prefs:
        return []

    doctor_ids = [p.doctor_id for p in prefs]
    docs = (
        await db.execute(
            select(DoctorProfile, Profile)
            .join(Profile, Profile.id == DoctorProfile.profile_id)
            .where(DoctorProfile.profile_id.in_(doctor_ids))
        )
    ).all()
    doc_map = {prof.id: (doc, prof) for doc, prof in docs}

    results = []
    for pref in prefs:
        doc_info = doc_map.get(pref.doctor_id)
        doc_name = "Doctor"
        doc_photo = None
        doc_spec = None
        if doc_info:
            doc, prof = doc_info
            doc_name = _build_doctor_name(prof)
            doc_photo = getattr(doc, "profile_photo_url", None)
            doc_spec = getattr(doc, "specialization", None)

        results.append(
            DoctorSharingSummary(
                doctor_id=pref.doctor_id,
                doctor_name=doc_name,
                doctor_photo_url=doc_photo,
                specialization=doc_spec,
                sharing=SharingCategoryResponse.model_validate(pref),
                created_at=pref.created_at,
                updated_at=pref.updated_at,
            )
        )
    return results


# ── Update sharing preferences (partial — toggle individual categories) ──────


@router.patch(
    "/doctors/{doctor_id}",
    response_model=SharingCategoryResponse,
)
async def update_sharing_for_doctor(
    doctor_id: str,
    body: SharingCategoryUpdate,
    user=Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Toggle individual sharing categories for a specific doctor.
    Creates the preference record if it doesn't exist yet."""
    await _require_patient(user, db)

    # Validate doctor exists
    doc_exists = (
        await db.execute(
            select(DoctorProfile.profile_id).where(
                DoctorProfile.profile_id == doctor_id
            )
        )
    ).scalar_one_or_none()
    if not doc_exists:
        raise HTTPException(status_code=404, detail="Doctor not found")

    pref = (
        await db.execute(
            select(PatientDataSharingPreference).where(
                PatientDataSharingPreference.patient_id == user.id,
                PatientDataSharingPreference.doctor_id == doctor_id,
            )
        )
    ).scalar_one_or_none()

    if not pref:
        pref = PatientDataSharingPreference(
            id=str(uuid.uuid4()),
            patient_id=user.id,
            doctor_id=doctor_id,
        )
        db.add(pref)

    # Apply only the fields the caller sent
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field in SHARING_CATEGORY_FIELDS:
            setattr(pref, field, value)

    await db.commit()
    await db.refresh(pref)
    return SharingCategoryResponse.model_validate(pref)


# ── Bulk share / revoke all categories for a doctor ──────────────────────────


@router.put(
    "/doctors/{doctor_id}/bulk",
    response_model=SharingCategoryResponse,
)
async def bulk_update_sharing(
    doctor_id: str,
    body: SharingBulkUpdate,
    user=Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Set ALL sharing categories for a doctor to the same value (share/revoke all)."""
    await _require_patient(user, db)

    doc_exists = (
        await db.execute(
            select(DoctorProfile.profile_id).where(
                DoctorProfile.profile_id == doctor_id
            )
        )
    ).scalar_one_or_none()
    if not doc_exists:
        raise HTTPException(status_code=404, detail="Doctor not found")

    pref = (
        await db.execute(
            select(PatientDataSharingPreference).where(
                PatientDataSharingPreference.patient_id == user.id,
                PatientDataSharingPreference.doctor_id == doctor_id,
            )
        )
    ).scalar_one_or_none()

    if not pref:
        pref = PatientDataSharingPreference(
            id=str(uuid.uuid4()),
            patient_id=user.id,
            doctor_id=doctor_id,
        )
        db.add(pref)

    for field in SHARING_CATEGORY_FIELDS:
        setattr(pref, field, body.share_all)

    await db.commit()
    await db.refresh(pref)
    return SharingCategoryResponse.model_validate(pref)


# ── Delete sharing record (revokes all and removes the record) ───────────────


@router.delete("/doctors/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sharing_for_doctor(
    doctor_id: str,
    user=Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Remove all sharing preferences for a doctor (revoke everything)."""
    await _require_patient(user, db)

    pref = (
        await db.execute(
            select(PatientDataSharingPreference).where(
                PatientDataSharingPreference.patient_id == user.id,
                PatientDataSharingPreference.doctor_id == doctor_id,
            )
        )
    ).scalar_one_or_none()

    if pref:
        await db.delete(pref)
        await db.commit()


# ── Helper: check if a doctor can view a specific category ───────────────────


async def can_doctor_view_category(
    db: AsyncSession,
    patient_id: str,
    doctor_id: str,
    category: str,
) -> bool:
    """Reusable check for other routes to enforce sharing preferences.

    Returns True only if the patient has explicitly granted access for
    the given category to the given doctor.
    """
    if category not in SHARING_CATEGORY_FIELDS:
        return False

    pref = (
        await db.execute(
            select(PatientDataSharingPreference).where(
                PatientDataSharingPreference.patient_id == patient_id,
                PatientDataSharingPreference.doctor_id == doctor_id,
            )
        )
    ).scalar_one_or_none()

    if not pref:
        return False

    return bool(getattr(pref, category, False))
