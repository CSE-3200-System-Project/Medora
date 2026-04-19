"""
OAuth2 routes for external service integrations (Google Calendar, Google Sign-In).

Supports:
- Google Calendar connection/disconnection
- Google Sign-In (OpenID Connect) for account linking
- Calendar event management (appointments, reminders)
"""

import logging
import uuid
from datetime import datetime
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Body
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.config import settings
from app.routes.auth import get_current_user_token
from app.services import google_calendar_service

logger = logging.getLogger(__name__)
router = APIRouter()

FRONTEND_URL = settings.FRONTEND_URL


@router.get("/google/connect")
async def google_connect(
    user: any = Depends(get_current_user_token),
):
    """Initiate Google OAuth2 flow. Returns the authorization URL."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar integration is not configured",
        )

    oauth_state = f"{user.id}:{uuid.uuid4().hex}"
    auth_url = await google_calendar_service.get_authorization_url(state=oauth_state)
    return {"authorization_url": auth_url}


@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth2 callback. Exchanges code for tokens and saves them."""
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    user_id = state.split(":", 1)[0] if ":" in state else state
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user state")

    try:
        # Exchange code for tokens
        tokens = await google_calendar_service.exchange_code_for_tokens(code, state=state)

        # Get Google user info from OpenID Connect (if openid scope is present)
        google_info = None
        if tokens.get("access_token"):
            google_info = await google_calendar_service.get_google_user_info(
                tokens["access_token"]
            )

        # Save tokens and Google account info
        await google_calendar_service.save_tokens(db, user_id, tokens, google_info)

        # Sync Google account info to user profile if available
        if google_info:
            await google_calendar_service.sync_google_user_to_profile(
                db, user_id, google_info
            )

        await db.commit()

        # Redirect to frontend settings page with success indicator
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?gcal=connected",
            status_code=302,
        )
    except Exception as e:
        logger.exception("Google OAuth callback failed")
        error_text = str(e).lower()
        if "invalid_grant" in error_text:
            reason = "invalid_grant"
        elif "redirect_uri_mismatch" in error_text:
            reason = "redirect_uri_mismatch"
        elif "access_denied" in error_text:
            reason = "access_denied"
        else:
            reason = "callback_failed"

        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?gcal=error&reason={quote(reason)}",
            status_code=302,
        )


@router.get("/google/status")
async def google_status(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Check if the user has an active Google Calendar connection and get account info."""
    from sqlalchemy import select, and_
    from app.db.models.oauth_token import UserOAuthToken

    result = await db.execute(
        select(UserOAuthToken).where(
            and_(
                UserOAuthToken.user_id == user.id,
                UserOAuthToken.provider == "google",
                UserOAuthToken.is_active == True,
            )
        )
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        return {
            "connected": False,
            "provider": "google",
            "google_email": None,
            "google_name": None,
            "google_picture": None,
        }

    # Extract Google account info
    google_email = token_record.google_email
    google_name = None
    google_picture = None

    if token_record.google_profile:
        google_name = token_record.google_profile.get("name")
        google_picture = token_record.google_profile.get("picture")

    return {
        "connected": True,
        "provider": "google",
        "google_email": google_email,
        "google_name": google_name,
        "google_picture": google_picture,
        "scopes": token_record.scopes,
    }


@router.delete("/google/disconnect")
async def google_disconnect(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect Google Calendar integration."""
    result = await google_calendar_service.disconnect(db, user.id)
    await db.commit()
    if not result:
        raise HTTPException(status_code=404, detail="No Google Calendar connection found")
    return {"message": "Google Calendar disconnected successfully"}


@router.post("/google/sync/medication/{reminder_id}")
async def sync_medication_reminder(
    reminder_id: str,
    request: Request,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Sync a medication reminder to Google Calendar as a recurring event.

    Body should contain:
    - item_name: str
    - reminder_times: list[str] (e.g., ["08:00", "14:00", "20:00"])
    - days_of_week: list[int] (0=Monday, 6=Sunday)
    - start_date: datetime
    - end_date: datetime (optional)
    - notes: str (optional)
    """
    body = await request.json()

    item_name = body.get("item_name")
    reminder_times = body.get("reminder_times", [])
    days_of_week = body.get("days_of_week", [0, 1, 2, 3, 4, 5, 6])
    start_date_str = body.get("start_date")
    end_date_str = body.get("end_date")
    notes = body.get("notes")

    if not item_name or not reminder_times or not start_date_str:
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: item_name, reminder_times, start_date",
        )

    try:
        start_date = datetime.fromisoformat(start_date_str)
        end_date = datetime.fromisoformat(end_date_str) if end_date_str else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    event_id = await google_calendar_service.sync_medication_reminders_to_calendar(
        db=db,
        user_id=user.id,
        reminder_id=reminder_id,
        item_name=item_name,
        reminder_times=reminder_times,
        days_of_week=days_of_week,
        start_date=start_date,
        end_date=end_date,
        notes=notes,
    )

    if not event_id:
        raise HTTPException(
            status_code=503,
            detail="Failed to sync medication reminder to Google Calendar",
        )

    return {
        "message": "Medication reminder synced to Google Calendar",
        "event_id": event_id,
    }


@router.post("/google/sync/appointment/{appointment_id}")
async def sync_appointment(
    appointment_id: str,
    request: Request,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Sync an appointment to Google Calendar.

    Body should contain:
    - summary: str
    - description: str
    - start_datetime: datetime
    - duration_minutes: int (default: 30)
    - location: str (optional)
    """
    body = await request.json()

    summary = body.get("summary")
    description = body.get("description", "")
    start_datetime_str = body.get("start_datetime")
    duration_minutes = body.get("duration_minutes", 30)
    location = body.get("location")

    if not summary or not start_datetime_str:
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: summary, start_datetime",
        )

    try:
        start_datetime = datetime.fromisoformat(start_datetime_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")

    event_id = await google_calendar_service.sync_appointment_to_calendar(
        db=db,
        user_id=user.id,
        appointment_id=appointment_id,
        summary=summary,
        description=description,
        start_datetime=start_datetime,
        duration_minutes=duration_minutes,
        location=location,
    )

    if not event_id:
        raise HTTPException(
            status_code=503,
            detail="Failed to sync appointment to Google Calendar",
        )

    return {
        "message": "Appointment synced to Google Calendar",
        "event_id": event_id,
    }
