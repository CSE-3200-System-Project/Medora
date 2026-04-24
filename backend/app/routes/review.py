from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_review import DoctorReview
from app.db.models.enums import ReviewModerationStatus
from app.schemas.review import (
    ReviewCreate,
    ReviewUpdate,
    ReviewResponse,
    ReviewAuthor,
    ReviewListResponse,
    ReviewEligibilityResponse,
)
from app.services import review_service


router = APIRouter()


async def _ensure_patient(db: AsyncSession, user_id: str) -> Profile:
    profile = (
        await db.execute(select(Profile).where(Profile.id == user_id))
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if "PATIENT" not in str(profile.role).upper():
        raise HTTPException(status_code=403, detail="Only patients can perform this action")
    return profile


async def _serialize_review(db: AsyncSession, review: DoctorReview, *, include_author: bool = True) -> ReviewResponse:
    author: Optional[ReviewAuthor] = None
    if include_author:
        author_profile = (
            await db.execute(select(Profile).where(Profile.id == review.patient_id))
        ).scalar_one_or_none()
        if author_profile:
            author = ReviewAuthor(
                patient_id=author_profile.id,
                first_name=author_profile.first_name,
                last_name=author_profile.last_name,
                profile_photo_url=getattr(author_profile, "profile_photo_url", None),
            )
    return ReviewResponse(
        id=review.id,
        doctor_id=review.doctor_id,
        rating=review.rating,
        note=review.note,
        status=review.status,
        admin_feedback=review.admin_feedback,
        created_at=review.created_at,
        updated_at=review.updated_at,
        author=author,
    )


@router.get("/doctor/{doctor_id}", response_model=ReviewListResponse)
async def list_doctor_reviews(
    doctor_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(5, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Public: list approved reviews for a doctor, newest first."""
    doctor = (
        await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id))
    ).scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    rows, total, has_more = await review_service.list_approved_reviews(
        db, doctor_id=doctor_id, page=page, limit=limit
    )
    reviews = [await _serialize_review(db, r) for r in rows]

    return ReviewListResponse(
        reviews=reviews,
        total=total,
        rating_avg=float(doctor.rating_avg or 0.0),
        rating_count=doctor.rating_count or 0,
        page=page,
        limit=limit,
        has_more=has_more,
    )


@router.get("/doctor/{doctor_id}/eligibility", response_model=ReviewEligibilityResponse)
async def review_eligibility(
    doctor_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Tells the UI whether the current patient can leave a review (has a
    completed appointment) and surfaces any existing review so the dialog
    can open in edit mode."""
    profile = await _ensure_patient(db, user.id)

    can_review = await review_service.patient_has_completed_appointment(
        db, patient_id=profile.id, doctor_id=doctor_id
    )
    existing = await review_service.get_latest_patient_review(
        db, patient_id=profile.id, doctor_id=doctor_id
    )

    return ReviewEligibilityResponse(
        can_review=can_review,
        has_existing_review=existing is not None,
        existing_review=(await _serialize_review(db, existing, include_author=False)) if existing else None,
    )


@router.post("", response_model=ReviewResponse, status_code=201)
async def create_or_update_review(
    payload: ReviewCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient creates (or updates their existing) review for a doctor.
    Eligibility requires at least one COMPLETED appointment."""
    profile = await _ensure_patient(db, user.id)

    eligible = await review_service.patient_has_completed_appointment(
        db, patient_id=profile.id, doctor_id=payload.doctor_id
    )
    if not eligible:
        raise HTTPException(
            status_code=403,
            detail="You can only review a doctor after a completed appointment.",
        )

    # Upsert: one active review per (patient, doctor). Keeps it simple — if the
    # patient reviews again we treat it as an edit of the latest one.
    existing = await review_service.get_latest_patient_review(
        db, patient_id=profile.id, doctor_id=payload.doctor_id
    )

    if existing:
        existing.rating = payload.rating
        existing.note = payload.note
        existing.appointment_id = payload.appointment_id or existing.appointment_id
        existing.status = ReviewModerationStatus.PENDING
        existing.admin_feedback = None
        review = existing
    else:
        review = DoctorReview(
            doctor_id=payload.doctor_id,
            patient_id=profile.id,
            appointment_id=payload.appointment_id,
            rating=payload.rating,
            note=payload.note,
            status=ReviewModerationStatus.PENDING,
        )
        db.add(review)

    await db.flush()
    await review_service.recompute_doctor_rating(db, payload.doctor_id)
    await db.commit()
    await db.refresh(review)

    return await _serialize_review(db, review, include_author=False)


@router.patch("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: str,
    payload: ReviewUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    profile = await _ensure_patient(db, user.id)
    review = (
        await db.execute(select(DoctorReview).where(DoctorReview.id == review_id))
    ).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.patient_id != profile.id:
        raise HTTPException(status_code=403, detail="You can only edit your own review")
    eligible = await review_service.patient_has_completed_appointment(
        db, patient_id=profile.id, doctor_id=review.doctor_id
    )
    if not eligible:
        raise HTTPException(
            status_code=403,
            detail="You can only review a doctor after a completed appointment.",
        )

    if payload.rating is not None:
        review.rating = payload.rating
    if payload.note is not None:
        review.note = payload.note
    review.status = ReviewModerationStatus.PENDING
    review.admin_feedback = None

    await db.flush()
    await review_service.recompute_doctor_rating(db, review.doctor_id)
    await db.commit()
    await db.refresh(review)
    return await _serialize_review(db, review, include_author=False)


@router.delete("/{review_id}", status_code=204)
async def delete_review(
    review_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    profile = await _ensure_patient(db, user.id)
    review = (
        await db.execute(select(DoctorReview).where(DoctorReview.id == review_id))
    ).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.patient_id != profile.id:
        raise HTTPException(status_code=403, detail="You can only delete your own review")

    doctor_id = review.doctor_id
    await db.delete(review)
    await db.flush()
    await review_service.recompute_doctor_rating(db, doctor_id)
    await db.commit()
    return None
