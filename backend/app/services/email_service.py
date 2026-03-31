from __future__ import annotations

from email.message import EmailMessage
import smtplib

from app.core.config import settings


def send_account_suspension_email(*, to_email: str, full_name: str, reason: str) -> bool:
    """Send account suspension email if SMTP is configured.

    Returns True when sent, otherwise False.
    """
    if not settings.SMTP_HOST or not to_email:
        return False

    message = EmailMessage()
    message["Subject"] = "Your Medora Account Has Been Suspended"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email

    support_email = settings.SUPPORT_EMAIL
    body = (
        f"Hello {full_name},\n\n"
        "Your Medora account has been suspended by an administrator.\n\n"
        f"Reason: {reason}\n\n"
        f"If you need help, please contact: {support_email}\n\n"
        "Regards,\n"
        "Medora Support"
    )
    message.set_content(body)

    try:
        if settings.SMTP_USE_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            with server:
                server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
        return True
    except Exception:
        return False
