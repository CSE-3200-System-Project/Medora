from __future__ import annotations

from email.message import EmailMessage
import logging
import smtplib
import ssl

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_PORT and settings.SMTP_FROM_EMAIL)


def _send_email_message(message: EmailMessage) -> bool:
    if not is_smtp_configured():
        logger.warning("SMTP is not configured. Skipping email send.")
        return False

    timeout_seconds = max(5, int(settings.SMTP_TIMEOUT_SECONDS))
    smtp_context = ssl.create_default_context()

    try:
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout_seconds, context=smtp_context)
            with server:
                server.ehlo()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout_seconds) as server:
                server.ehlo()
                if settings.SMTP_USE_TLS:
                    server.starttls(context=smtp_context)
                    server.ehlo()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
        return True
    except Exception:
        logger.exception(
            "SMTP email send failed host=%s port=%s use_tls=%s use_ssl=%s to=%s subject=%s",
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.SMTP_USE_TLS,
            settings.SMTP_USE_SSL,
            message.get("To"),
            message.get("Subject"),
        )
        return False


def _build_email(*, to_email: str, subject: str, body: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(body)
    return message


def send_account_suspension_email(*, to_email: str, full_name: str, reason: str) -> bool:
    """Send account suspension email if SMTP is configured.

    Returns True when sent, otherwise False.
    """
    if not to_email:
        return False

    message = EmailMessage()
    support_email = settings.SUPPORT_EMAIL
    body = (
        f"Hello {full_name},\n\n"
        "Your Medora account has been suspended by an administrator.\n\n"
        f"Reason: {reason}\n\n"
        f"If you need help, please contact: {support_email}\n\n"
        "Regards,\n"
        "Medora Support"
    )
    message = _build_email(
        to_email=to_email,
        subject="Your Medora Account Has Been Suspended",
        body=body,
    )
    return _send_email_message(message)


def send_appointment_reminder_email(
    *,
    to_email: str,
    full_name: str,
    counterpart_name: str,
    appointment_time_text: str,
    role_label: str,
) -> bool:
    if not to_email:
        return False

    body = (
        f"Hello {full_name},\n\n"
        f"This is a 15-minute reminder for your upcoming appointment at {appointment_time_text}.\n"
        f"{counterpart_name} is scheduled with you as the {role_label}.\n\n"
        "Please join or arrive on time.\n\n"
        "Regards,\n"
        "Medora"
    )

    message = _build_email(
        to_email=to_email,
        subject="Medora Appointment Reminder (15 minutes)",
        body=body,
    )
    return _send_email_message(message)


def send_item_reminder_email(
    *,
    to_email: str,
    full_name: str,
    item_name: str,
    reminder_time_text: str,
    reminder_type_label: str,
    notes: str | None = None,
) -> bool:
    if not to_email:
        return False

    note_text = f"\nNotes: {notes}\n" if notes else "\n"
    body = (
        f"Hello {full_name},\n\n"
        f"This is your 15-minute reminder for {reminder_type_label} at {reminder_time_text}.\n"
        f"Item: {item_name}\n"
        f"{note_text}"
        "Please follow your care plan and contact your doctor if needed.\n\n"
        "Regards,\n"
        "Medora"
    )

    message = _build_email(
        to_email=to_email,
        subject=f"Medora {reminder_type_label.title()} Reminder (15 minutes)",
        body=body,
    )
    return _send_email_message(message)


def send_smtp_diagnostic_email(*, to_email: str, subject: str, body: str) -> bool:
    """Send a diagnostic message for operational SMTP verification."""
    if not to_email:
        return False
    message = _build_email(to_email=to_email, subject=subject, body=body)
    return _send_email_message(message)
