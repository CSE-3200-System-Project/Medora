"""
OAuth2 routes for external service integrations (Google Calendar).
"""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.services import google_calendar_service

logger = logging.getLogger(__name__)
router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


@router.get("/google/connect")
async def google_connect(
    user: any = Depends(get_current_user_token),
):
    """Initiate Google OAuth2 flow. Returns the authorization URL."""
    if not os.getenv("GOOGLE_CLIENT_ID"):
        raise HTTPException(
            status_code=503,
            detail="Google Calendar integration is not configured",
        )

    auth_url = await google_calendar_service.get_authorization_url(state=user.id)
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

    user_id = state
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user state")

    try:
        tokens = await google_calendar_service.exchange_code_for_tokens(code)
        await google_calendar_service.save_tokens(db, user_id, tokens)
        await db.commit()

        # Redirect to frontend settings page with success indicator
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?gcal=connected",
            status_code=302,
        )
    except Exception as e:
        logger.error(f"Google OAuth callback failed: {e}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?gcal=error",
            status_code=302,
        )


@router.get("/google/status")
async def google_status(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Check if the user has an active Google Calendar connection."""
    connected = await google_calendar_service.is_connected(db, user.id)
    return {"connected": connected, "provider": "google"}


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
