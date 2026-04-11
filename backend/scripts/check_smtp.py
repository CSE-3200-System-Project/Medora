from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
import smtplib
import ssl
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings
from app.services.email_service import send_smtp_diagnostic_email


def _run_handshake() -> tuple[bool, str]:
    if not settings.SMTP_HOST:
        return False, "SMTP_HOST is missing."

    timeout_seconds = max(5, int(settings.SMTP_TIMEOUT_SECONDS))
    context = ssl.create_default_context()

    try:
        if settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout_seconds, context=context) as server:
                server.ehlo()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout_seconds) as server:
                server.ehlo()
                if settings.SMTP_USE_TLS:
                    server.starttls(context=context)
                    server.ehlo()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        return True, "SMTP handshake/login succeeded."
    except Exception as exc:  # pragma: no cover - runtime diagnostic path
        return False, f"{type(exc).__name__}: {exc}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify Medora SMTP connectivity and optional send flow.")
    parser.add_argument("--send-to", dest="send_to", default="", help="Optional recipient for a real test email.")
    args = parser.parse_args()

    print("SMTP configuration summary:")
    print(f"- host configured: {bool(settings.SMTP_HOST)}")
    print(f"- port: {settings.SMTP_PORT}")
    print(f"- from email: {settings.SMTP_FROM_EMAIL}")
    print(f"- username configured: {bool(settings.SMTP_USERNAME)}")
    print(f"- password configured: {bool(settings.SMTP_PASSWORD)}")
    print(f"- use tls: {settings.SMTP_USE_TLS}")
    print(f"- use ssl: {settings.SMTP_USE_SSL}")
    print(f"- timeout seconds: {settings.SMTP_TIMEOUT_SECONDS}")

    ok, message = _run_handshake()
    print(f"Handshake/login: {'OK' if ok else 'FAILED'} - {message}")
    if not ok:
        return 1

    if not args.send_to:
        print("No --send-to provided. Skipping real email send.")
        return 0

    now_label = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    sent = send_smtp_diagnostic_email(
        to_email=args.send_to,
        subject=f"[Medora SMTP Test] {now_label}",
        body=(
            "This is a Medora SMTP diagnostic email.\n\n"
            f"Timestamp: {now_label}\n"
            "If you received this, SMTP send is working end-to-end."
        ),
    )

    print(f"Send test email: {'OK' if sent else 'FAILED'}")
    return 0 if sent else 2


if __name__ == "__main__":
    sys.exit(main())
