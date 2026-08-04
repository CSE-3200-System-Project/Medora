from sqlalchemy import Date, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class SlotChangeEvent(Base):
    """PHI-free change feed that the browser is allowed to subscribe to.

    The booking UI needs to know only that availability for a doctor on a date moved,
    then it refetches through the backend like every other read. Publishing this table
    instead of ``appointments`` keeps patient rows out of the realtime stream.

    Written exclusively by the ``trg_appointments_slot_change`` trigger (migration
    ``sec_001``); no application code inserts here. The model exists so Alembic
    autogenerate does not propose dropping the table.
    """

    __tablename__ = "slot_change_events"

    # String, not UUID: `appointments.doctor_id` is a varchar and the types must match
    # or the trigger's implicit cast fails the booking write (see migration sec_002).
    doctor_id: Mapped[str] = mapped_column(String, primary_key=True)
    appointment_date: Mapped[Date] = mapped_column(Date, primary_key=True)
    changed_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
