"""
Google Calendar integration service.

Handles OAuth2 token management and calendar event CRUD for appointment sync.
Requires: google-auth, google-auth-oauthlib, google-api-python-client
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.oauth_token import UserOAuthToken

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/oauth/google/callback")
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


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


async def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code for access + refresh tokens."""
    flow = _get_google_flow()
    flow.fetch_token(code=code)
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
) -> UserOAuthToken:
    """Save or update OAuth tokens for a user."""
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
