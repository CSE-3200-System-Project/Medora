from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_review import DoctorReview
from app.db.models.enums import ReviewModerationStatus


async def patient_has_completed_appointment(
    db: AsyncSession, *, patient_id: str, doctor_id: str
) -> bool:
    """Patient is eligible to review the doctor iff they have at least one
    COMPLETED appointment with that doctor."""
    stmt = (
        select(func.count(Appointment.id))
        .where(
            Appointment.patient_id == patient_id,
            Appointment.doctor_id == doctor_id,
            Appointment.status == AppointmentStatus.COMPLETED,
        )
    )
    result = await db.execute(stmt)
    return (result.scalar() or 0) > 0


async def get_latest_patient_review(
    db: AsyncSession, *, patient_id: str, doctor_id: str
) -> DoctorReview | None:
    result = await db.execute(
        select(DoctorReview)
        .where(
            DoctorReview.doctor_id == doctor_id,
            DoctorReview.patient_id == patient_id,
        )
        .order_by(desc(DoctorReview.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_approved_reviews(
    db: AsyncSession, *, doctor_id: str, page: int, limit: int
) -> tuple[list[DoctorReview], int, bool]:
    safe_page = max(1, page)
    safe_limit = max(1, min(limit, 100))
    offset = (safe_page - 1) * safe_limit

    rows = (
        await db.execute(
            select(DoctorReview)
            .where(
                DoctorReview.doctor_id == doctor_id,
                DoctorReview.status == ReviewModerationStatus.APPROVED,
            )
            .order_by(desc(DoctorReview.created_at))
            .limit(safe_limit + 1)
            .offset(offset)
        )
    ).scalars().all()

    has_more = len(rows) > safe_limit
    reviews = rows[:safe_limit]
    total = int(
        (
            await db.execute(
                select(func.count(DoctorReview.id)).where(
                    DoctorReview.doctor_id == doctor_id,
                    DoctorReview.status == ReviewModerationStatus.APPROVED,
                )
            )
        ).scalar()
        or 0
    )
    return reviews, total, has_more


async def recompute_doctor_rating(db: AsyncSession, doctor_id: str) -> tuple[float, int]:
    """Recompute rating_avg / rating_count on DoctorProfile from doctor_reviews.

    Called after create/update/delete. Returns the new (avg, count).
    """
    stmt = select(
        func.coalesce(func.avg(DoctorReview.rating), 0.0),
        func.count(DoctorReview.id),
    ).where(
        DoctorReview.doctor_id == doctor_id,
        DoctorReview.status == ReviewModerationStatus.APPROVED,
    )
    row = (await db.execute(stmt)).one()
    avg = float(row[0] or 0.0)
    count = int(row[1] or 0)

    doctor = (
        await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id))
    ).scalar_one_or_none()
    if doctor is not None:
        doctor.rating_avg = round(avg, 2)
        doctor.rating_count = count
        await db.flush()
    return avg, count
