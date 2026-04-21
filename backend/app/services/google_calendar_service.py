"""
Google Calendar integration service.

Handles OAuth2 token management and calendar event CRUD for appointment sync,
medication reminders, and recurring events. Supports Google Sign-In (OpenID Connect)
for user authentication and account linking.

Requires: google-auth, google-auth-oauthlib, google-api-python-client
"""

import os

# Google always returns "userinfo.email"/"userinfo.profile" in token response
# even when "email"/"profile" aliases were requested. oauthlib treats this as
# a fatal scope mismatch unless we relax the check. Must be set BEFORE oauthlib imports.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", os.environ.get("OAUTHLIB_INSECURE_TRANSPORT", "0"))

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.oauth_token import UserOAuthToken

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID or ""
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET or ""
GOOGLE_REDIRECT_URI = settings.GOOGLE_REDIRECT_URI
# Scopes for Calendar access + OpenID Connect (Google Sign-In)
GOOGLE_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.events",
]
# Scopes for full calendar management (including calendar list access)
GOOGLE_SCOPES_FULL = GOOGLE_SCOPES + ["https://www.googleapis.com/auth/calendar.readonly"]


def _get_google_flow():
    """Create Google OAuth2 flow. Lazy import to avoid hard dependency."""
    from google_auth_oauthlib.flow import Flow

    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI],
        }
    }
    return Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
        autogenerate_code_verifier=False,
    )


def _build_calendar_service(access_token: str):
    """Build Google Calendar API service from an access token."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=access_token,
        refresh_token=None,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
    )
    return build("calendar", "v3", credentials=creds)


async def get_authorization_url(state: str | None = None) -> str:
    """Generate Google OAuth2 authorization URL."""
    flow = _get_google_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state or "",
    )
    return auth_url


async def exchange_code_for_tokens(code: str, state: str | None = None) -> dict:
    """Exchange authorization code for access + refresh tokens.

    Defensively tolerates scope-change warnings from oauthlib (Google returns
    userinfo.* URIs instead of the short email/profile aliases we request).
    """
    # Ensure relaxed scope checking even if env wasn't set at import time.
    os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

    flow = _get_google_flow()
    try:
        flow.fetch_token(code=code)
    except Warning as w:  # oauthlib.oauth2.rfc6749.errors.Warning is Exception-based
        # Only swallow the well-known scope-change warning; re-raise anything else.
        if "scope has changed" not in str(w).lower():
            raise
        logger.warning("Ignoring Google OAuth scope-change warning: %s", w)
    credentials = flow.credentials
    return {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_expiry": credentials.expiry,
        "scopes": " ".join(credentials.scopes or GOOGLE_SCOPES),
    }


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh an expired access token using the refresh token."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
    )
    creds.refresh(Request())
    return {
        "access_token": creds.token,
        "token_expiry": creds.expiry,
    }


async def save_tokens(
    db: AsyncSession,
    user_id: str,
    tokens: dict,
    google_info: Optional[dict] = None,
) -> UserOAuthToken:
    """Save or update OAuth tokens for a user, optionally with Google account info."""
    result = await db.execute(
        select(UserOAuthToken).where(
            and_(
                UserOAuthToken.user_id == user_id,
                UserOAuthToken.provider == "google",
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.access_token = tokens["access_token"]
        if tokens.get("refresh_token"):
            existing.refresh_token = tokens["refresh_token"]
        existing.token_expiry = tokens.get("token_expiry")
        existing.scopes = tokens.get("scopes")
        existing.is_active = True

        # Update Google account info if provided
        if google_info:
            existing.google_email = google_info.get("email")
            existing.google_sub = google_info.get("sub")
            existing.google_profile = google_info

        await db.flush()
        return existing

    token_record = UserOAuthToken(
        user_id=user_id,
        provider="google",
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token"),
        token_expiry=tokens.get("token_expiry"),
        scopes=tokens.get("scopes"),
        is_active=True,
        google_email=google_info.get("email") if google_info else None,
        google_sub=google_info.get("sub") if google_info else None,
        google_profile=google_info,
    )
    db.add(token_record)
    await db.flush()
    return token_record


async def get_valid_access_token(db: AsyncSession, user_id: str) -> Optional[str]:
    """Get a valid access token for the user, refreshing if necessary."""
    result = await db.execute(
        select(UserOAuthToken).where(
            and_(
                UserOAuthToken.user_id == user_id,
                UserOAuthToken.provider == "google",
                UserOAuthToken.is_active == True,
            )
        )
    )
    token_record = result.scalar_one_or_none()
    if not token_record:
        return None

    # Check if token is expired (with 5 min buffer)
    if token_record.token_expiry and token_record.token_expiry < datetime.utcnow() + timedelta(minutes=5):
        if not token_record.refresh_token:
            token_record.is_active = False
            await db.flush()
            return None

        try:
            new_tokens = await refresh_access_token(token_record.refresh_token)
            token_record.access_token = new_tokens["access_token"]
            token_record.token_expiry = new_tokens.get("token_expiry")
            await db.flush()
        except Exception as e:
            logger.error(f"Failed to refresh Google token for user {user_id}: {e}")
            token_record.is_active = False
            await db.flush()
            return None

    return token_record.access_token


async def is_connected(db: AsyncSession, user_id: str) -> bool:
    """Check if a user has an active Google Calendar connection."""
    result = await db.execute(
        select(UserOAuthToken.id).where(
            and_(
                UserOAuthToken.user_id == user_id,
                UserOAuthToken.provider == "google",
                UserOAuthToken.is_active == True,
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def disconnect(db: AsyncSession, user_id: str) -> bool:
    """Disconnect Google Calendar (deactivate tokens)."""
    result = await db.execute(
        select(UserOAuthToken).where(
            and_(
                UserOAuthToken.user_id == user_id,
                UserOAuthToken.provider == "google",
            )
        )
    )
    token_record = result.scalar_one_or_none()
    if not token_record:
        return False

    token_record.is_active = False
    await db.flush()
    return True


async def create_calendar_event(
    db: AsyncSession,
    user_id: str,
    summary: str,
    description: str,
    start_datetime: datetime,
    duration_minutes: int = 30,
    location: Optional[str] = None,
) -> Optional[str]:
    """Create a Google Calendar event. Returns the event ID or None if not connected."""
    access_token = await get_valid_access_token(db, user_id)
    if not access_token:
        return None

    try:
        service = _build_calendar_service(access_token)
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)

        event_body = {
            "summary": summary,
            "description": description,
            "start": {
                "dateTime": start_datetime.isoformat(),
                "timeZone": "Asia/Dhaka",
            },
            "end": {
                "dateTime": end_datetime.isoformat(),
                "timeZone": "Asia/Dhaka",
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 30},
                    {"method": "popup", "minutes": 60 * 24},
                ],
            },
        }
        if location:
            event_body["location"] = location

        event = service.events().insert(calendarId="primary", body=event_body).execute()
        logger.info(f"Created Google Calendar event {event['id']} for user {user_id}")
        return event.get("id")
    except Exception as e:
        logger.error(f"Failed to create Google Calendar event for user {user_id}: {e}")
        return None


async def update_calendar_event(
    db: AsyncSession,
    user_id: str,
    event_id: str,
    summary: Optional[str] = None,
    description: Optional[str] = None,
    start_datetime: Optional[datetime] = None,
    duration_minutes: int = 30,
    location: Optional[str] = None,
) -> bool:
    """Update an existing Google Calendar event. Returns True on success."""
    access_token = await get_valid_access_token(db, user_id)
    if not access_token:
        return False

    try:
        service = _build_calendar_service(access_token)
        update_body = {}

        if summary:
            update_body["summary"] = summary
        if description:
            update_body["description"] = description
        if start_datetime:
            end_datetime = start_datetime + timedelta(minutes=duration_minutes)
            update_body["start"] = {
                "dateTime": start_datetime.isoformat(),
                "timeZone": "Asia/Dhaka",
            }
            update_body["end"] = {
                "dateTime": end_datetime.isoformat(),
                "timeZone": "Asia/Dhaka",
            }
        if location:
            update_body["location"] = location

        service.events().patch(
            calendarId="primary", eventId=event_id, body=update_body
        ).execute()
        logger.info(f"Updated Google Calendar event {event_id} for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to update Google Calendar event {event_id}: {e}")
        return False


async def delete_calendar_event(
    db: AsyncSession,
    user_id: str,
    event_id: str,
) -> bool:
    """Delete a Google Calendar event. Returns True on success."""
    access_token = await get_valid_access_token(db, user_id)
    if not access_token:
        return False

    try:
        service = _build_calendar_service(access_token)
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        logger.info(f"Deleted Google Calendar event {event_id} for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete Google Calendar event {event_id}: {e}")
        return False


async def get_google_user_info(access_token: str) -> Optional[dict]:
    """Get Google user info from OpenID Connect userinfo endpoint."""
    try:
        import requests
        response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        logger.error(f"Failed to get Google user info: {e}")
        return None


async def sync_google_user_to_profile(
    db: AsyncSession,
    user_id: str,
    google_info: dict,
) -> None:
    """Sync Google account info to user profile (name, email, picture)."""
    try:
        from app.db.models.profile import Profile

        result = await db.execute(select(Profile).where(Profile.id == user_id))
        profile = result.scalar_one_or_none()
        if not profile:
            return

        # Update from Google info if fields are empty
        if google_info.get("given_name") and not profile.first_name:
            profile.first_name = google_info["given_name"]
        if google_info.get("family_name") and not profile.last_name:
            profile.last_name = google_info["family_name"]
        if google_info.get("picture") and not profile.avatar_url:
            profile.avatar_url = google_info["picture"]

        await db.flush()
        logger.info(f"Synced Google profile info for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to sync Google user info to profile: {e}")


async def create_recurring_calendar_event(
    db: AsyncSession,
    user_id: str,
    summary: str,
    description: str,
    start_datetime: datetime,
    duration_minutes: int = 30,
    recurrence_rule: Optional[list[str]] = None,
    location: Optional[str] = None,
    reminder_minutes: list[int] = [30],
) -> Optional[str]:
    """
    Create a recurring Google Calendar event.

    Args:
        recurrence_rule: List of RRULE strings (e.g., ["RRULE:FREQ=DAILY;COUNT=30"])
        reminder_minutes: Minutes before event to trigger reminders

    Returns:
        The Google event ID or None if failed
    """
    access_token = await get_valid_access_token(db, user_id)
    if not access_token:
        return None

    try:
        service = _build_calendar_service(access_token)
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)

        event_body = {
            "summary": summary,
            "description": description,
            "start": {
                "dateTime": start_datetime.isoformat(),
                "timeZone": "Asia/Dhaka",
            },
            "end": {
                "dateTime": end_datetime.isoformat(),
                "timeZone": "Asia/Dhaka",
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": mins} for mins in reminder_minutes
                ],
            },
        }

        if location:
            event_body["location"] = location

        if recurrence_rule:
            event_body["recurrence"] = recurrence_rule

        event = service.events().insert(calendarId="primary", body=event_body).execute()
        logger.info(f"Created recurring Google Calendar event {event['id']} for user {user_id}")
        return event.get("id")
    except Exception as e:
        logger.error(f"Failed to create recurring Google Calendar event: {e}")
        return None


async def sync_medication_reminders_to_calendar(
    db: AsyncSession,
    user_id: str,
    reminder_id: str,
    item_name: str,
    reminder_times: list[str],
    days_of_week: list[int],
    start_date: datetime,
    end_date: Optional[datetime] = None,
    notes: Optional[str] = None,
) -> Optional[str]:
    """
    Sync a medication reminder to Google Calendar as a recurring event.

    Args:
        reminder_times: List of HH:MM time strings (e.g., ["08:00", "14:00", "20:00"])
        days_of_week: List of weekday ints (0=Monday, 6=Sunday)
        start_date: First date of medication
        end_date: Optional end date (None for ongoing)

    Returns:
        The Google event ID or None if failed
    """
    # Build RRULE based on days_of_week and reminder_times
    day_abbrevs = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
    selected_days = ",".join([day_abbrevs[d] for d in days_of_week])

    # If all days selected, use FREQ=DAILY, otherwise use BYDAY
    if len(days_of_week) == 7:
        rrule = "FREQ=DAILY"
    else:
        rrule = f"FREQ=WEEKLY;BYDAY={selected_days}"

    # Add end date if specified
    if end_date:
        end_date_str = end_date.strftime("%Y%m%d")
        rrule += f";UNTIL={end_date_str}T235959Z"

    recurrence = [f"RRULE:{rrule}"]

    # Create event for the first reminder time (Google Calendar doesn't support multiple times per day in one event)
    # For multiple daily reminders, we'll create separate events
    first_time = reminder_times[0] if reminder_times else "08:00"
    hour, minute = map(int, first_time.split(":"))

    start_dt = start_date.replace(hour=hour, minute=minute)

    description_parts = [
        f"Medication Reminder: {item_name}",
        f"Schedule: {', '.join(reminder_times)} daily",
    ]
    if notes:
        description_parts.append(f"Notes: {notes}")

    description = "\n".join(description_parts)

    event_id = await create_recurring_calendar_event(
        db=db,
        user_id=user_id,
        summary=f"💊 {item_name}",
        description=description,
        start_datetime=start_dt,
        duration_minutes=5,  # Quick reminder
        recurrence_rule=recurrence,
        reminder_minutes=[15, 0],  # 15 min and at-time reminders
    )

    if event_id:
        logger.info(f"Synced medication reminder {reminder_id} to Google Calendar as {event_id}")

    return event_id


async def sync_appointment_to_calendar(
    db: AsyncSession,
    user_id: str,
    appointment_id: str,
    summary: str,
    description: str,
    start_datetime: datetime,
    duration_minutes: int = 30,
    location: Optional[str] = None,
) -> Optional[str]:
    """
    Sync an appointment to Google Calendar with full details.

    This is the enhanced version that includes appointment ID in description for tracking.
    """
    # Add appointment ID to description for reference
    full_description = f"{description}\n\n---\nMedora Appointment ID: {appointment_id}\nManage at: https://medora.app/appointments"

    event_id = await create_calendar_event(
        db=db,
        user_id=user_id,
        summary=summary,
        description=full_description,
        start_datetime=start_datetime,
        duration_minutes=duration_minutes,
        location=location,
    )

    return event_id
