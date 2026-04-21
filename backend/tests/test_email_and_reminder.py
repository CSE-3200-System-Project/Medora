from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from app.core.config import settings
from app.services import email_service
from app.services.reminder_dispatcher import _compute_due_slots_utc


class _FakeSMTP:
    def __init__(self, *args, **kwargs):
        self.started_tls = False
        self.logged_in = False
        self.sent = False
        self.ehlo_count = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False

    def ehlo(self):
        self.ehlo_count += 1

    def starttls(self, context=None):
        self.started_tls = True

    def login(self, username, password):
        self.logged_in = True

    def send_message(self, message):
        self.sent = True


def test_email_service_uses_starttls_when_configured(monkeypatch):
    fake = _FakeSMTP()

    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_FROM_EMAIL", "no-reply@example.com")
    monkeypatch.setattr(settings, "SMTP_USERNAME", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pass")
    monkeypatch.setattr(settings, "SMTP_USE_TLS", True)
    monkeypatch.setattr(settings, "SMTP_USE_SSL", False)
    monkeypatch.setattr(settings, "SMTP_TIMEOUT_SECONDS", 20)
    monkeypatch.setattr(email_service.smtplib, "SMTP", lambda *args, **kwargs: fake)

    sent = email_service.send_smtp_diagnostic_email(
        to_email="recipient@example.com",
        subject="SMTP test",
        body="Hello",
    )

    assert sent is True
    assert fake.started_tls is True
    assert fake.logged_in is True
    assert fake.sent is True
    assert fake.ehlo_count >= 2


def test_compute_due_slots_includes_start_boundary(monkeypatch):
    monkeypatch.setattr(settings, "REMINDER_LEAD_MINUTES", 15)
    reminder = SimpleNamespace(
        days_of_week=[4],  # Friday
        reminder_times=["00:15"],
    )

    start_utc = datetime(2026, 4, 10, 0, 0, tzinfo=timezone.utc)
    end_utc = datetime(2026, 4, 10, 0, 1, tzinfo=timezone.utc)

    slots = _compute_due_slots_utc(
        reminder=reminder,
        reminder_tz=timezone.utc,
        start_utc=start_utc,
        end_utc=end_utc,
    )

    assert len(slots) == 1
    assert slots[0] == datetime(2026, 4, 10, 0, 15, tzinfo=timezone.utc)
