from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.db.models.appointment import AppointmentStatus
from app.services import appointment_service


def _build_appointment(
    *,
    status: AppointmentStatus = AppointmentStatus.PENDING,
    start_in_minutes: int = 180,
    hold_expires_delta_minutes: int | None = 15,
) -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    hold_expires_at = None
    if hold_expires_delta_minutes is not None:
        hold_expires_at = now + timedelta(minutes=hold_expires_delta_minutes)

    return SimpleNamespace(
        id="appt-1",
        doctor_id="doctor-1",
        patient_id="patient-1",
        status=status,
        appointment_date=now + timedelta(minutes=start_in_minutes),
        reason="Follow-up",
        hold_expires_at=hold_expires_at,
    )


def test_get_role_based_cancel_status() -> None:
    assert appointment_service.get_role_based_cancel_status("patient") == AppointmentStatus.CANCELLED_BY_PATIENT
    assert appointment_service.get_role_based_cancel_status("doctor") == AppointmentStatus.CANCELLED_BY_DOCTOR
    assert appointment_service.get_role_based_cancel_status("admin") == AppointmentStatus.CANCELLED


def test_validate_cancellation_window_blocks_late_cancel() -> None:
    appointment = _build_appointment(start_in_minutes=30)
    with pytest.raises(ValueError, match="at least 60 minutes"):
        appointment_service.validate_cancellation_window(appointment)


def test_validate_cancellation_window_allows_safe_cancel() -> None:
    appointment = _build_appointment(start_in_minutes=240)
    appointment_service.validate_cancellation_window(appointment)


def test_is_pending_hold_expired_detects_expiration() -> None:
    appointment = _build_appointment(hold_expires_delta_minutes=-1)
    assert appointment_service.is_pending_hold_expired(appointment) is True


def test_is_pending_hold_expired_ignores_non_pending_statuses() -> None:
    appointment = _build_appointment(status=AppointmentStatus.CONFIRMED, hold_expires_delta_minutes=-1)
    assert appointment_service.is_pending_hold_expired(appointment) is False


def test_replace_slot_note_updates_existing_slot_reference() -> None:
    updated = appointment_service._replace_slot_note("Patient notes. Slot: 8:00 PM", datetime.strptime("9:30 PM", "%I:%M %p").time())  # noqa: SLF001
    assert updated is not None
    assert "Slot: 9:30 PM" in updated


def test_transition_table_allows_pending_to_confirmed() -> None:
    allowed = appointment_service.ALLOWED_TRANSITIONS[AppointmentStatus.PENDING]
    assert AppointmentStatus.CONFIRMED in allowed


def test_transition_table_disallows_completed_to_pending() -> None:
    allowed = appointment_service.ALLOWED_TRANSITIONS[AppointmentStatus.COMPLETED]
    assert AppointmentStatus.PENDING not in allowed
