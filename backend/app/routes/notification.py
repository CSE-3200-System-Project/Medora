from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, and_
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.notification import Notification, NotificationType, NotificationPriority, PushSubscription
from app.services.push_service import get_vapid_public_key
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    NotificationMarkRead,
    NotificationUpdate,
    UnreadCountResponse,
    PushSubscriptionRequest,
    PushUnsubscribeRequest,
)
from typing import List, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter()


@router.get("/vapid-key", response_model=dict)
async def get_web_push_vapid_key():
    public_key = get_vapid_public_key()
    if not public_key:
        raise HTTPException(status_code=503, detail="Web push is not configured")
    return {"public_key": public_key}


@router.post("/subscribe", response_model=dict)
async def subscribe_to_push(
    payload: PushSubscriptionRequest,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.user_id = user_id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
        existing.is_active = True
        existing.updated_at = datetime.now(timezone.utc)
        existing.failure_count = 0
    else:
        db.add(
            PushSubscription(
                user_id=user_id,
                endpoint=payload.endpoint,
                p256dh=payload.keys.p256dh,
                auth=payload.keys.auth,
                is_active=True,
            )
        )

    await db.commit()
    return {"subscribed": True}


@router.post("/unsubscribe", response_model=dict)
async def unsubscribe_from_push(
    payload: PushUnsubscribeRequest,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == payload.endpoint,
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        return {"unsubscribed": True}

    subscription.is_active = False
    subscription.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"unsubscribed": True}


# ========== HELPER FUNCTIONS ==========

async def create_notification(
    db: AsyncSession,
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    metadata: Optional[dict] = None,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
) -> Notification:
    """
    Helper function to create a notification.
    Can be imported and used in other routes (e.g., appointment, profile).
    """
    notification = Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=notification_type,
        priority=priority,
        title=title,
        message=message,
        action_url=action_url,
        data=metadata,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


# ========== API ROUTES ==========

@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    include_archived: bool = Query(False),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Get notifications for the current user with pagination.
    """
    user_id = user.id

    # Build base query
    base_conditions = [Notification.user_id == user_id]
    
    if unread_only:
        base_conditions.append(Notification.is_read == False)
    
    if not include_archived:
        base_conditions.append(Notification.is_archived == False)

    # Get notifications
    query = (
        select(Notification)
        .where(and_(*base_conditions))
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()

    # Get total count
    count_query = select(func.count(Notification.id)).where(and_(*base_conditions))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get unread count
    unread_query = select(func.count(Notification.id)).where(
        and_(
            Notification.user_id == user_id,
            Notification.is_read == False,
            Notification.is_archived == False,
        )
    )
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar() or 0

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                id=n.id,
                user_id=n.user_id,
                type=n.type,
                priority=n.priority,
                title=n.title,
                message=n.message,
                action_url=n.action_url,
                metadata=n.data,
                is_read=n.is_read,
                is_archived=n.is_archived,
                created_at=n.created_at,
                read_at=n.read_at,
            )
            for n in notifications
        ],
        total=total,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the count of unread notifications.
    """
    user_id = user.id

    query = select(func.count(Notification.id)).where(
        and_(
            Notification.user_id == user_id,
            Notification.is_read == False,
            Notification.is_archived == False,
        )
    )
    result = await db.execute(query)
    count = result.scalar() or 0

    return UnreadCountResponse(unread_count=count)


@router.patch("/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: str,
    data: NotificationUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Update a notification (mark as read, archive, etc.).
    """
    user_id = user.id

    # Get notification
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Update fields
    if data.is_read is not None:
        notification.is_read = data.is_read
        if data.is_read:
            notification.read_at = datetime.now(timezone.utc)
        else:
            notification.read_at = None

    if data.is_archived is not None:
        notification.is_archived = data.is_archived

    await db.commit()
    await db.refresh(notification)

    return NotificationResponse(
        id=notification.id,
        user_id=notification.user_id,
        type=notification.type,
        priority=notification.priority,
        title=notification.title,
        message=notification.message,
        action_url=notification.action_url,
        metadata=notification.data,
        is_read=notification.is_read,
        is_archived=notification.is_archived,
        created_at=notification.created_at,
        read_at=notification.read_at,
    )


@router.post("/mark-read", response_model=dict)
async def mark_notifications_read(
    data: NotificationMarkRead,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark multiple notifications as read.
    """
    user_id = user.id

    if not data.notification_ids:
        return {"marked_count": 0}

    # Update notifications
    stmt = (
        update(Notification)
        .where(
            and_(
                Notification.id.in_(data.notification_ids),
                Notification.user_id == user_id,
            )
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    result = await db.execute(stmt)
    await db.commit()

    return {"marked_count": result.rowcount}


@router.post("/mark-all-read", response_model=dict)
async def mark_all_notifications_read(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark all notifications as read.
    """
    user_id = user.id

    stmt = (
        update(Notification)
        .where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    result = await db.execute(stmt)
    await db.commit()

    return {"marked_count": result.rowcount}


@router.delete("/{notification_id}", response_model=dict)
async def delete_notification(
    notification_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a notification (or archive it).
    """
    user_id = user.id

    # Get notification
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Archive instead of hard delete
    notification.is_archived = True
    await db.commit()

    return {"deleted": True}


@router.delete("/", response_model=dict)
async def clear_all_notifications(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Archive all notifications for the current user.
    """
    user_id = user.id

    stmt = (
        update(Notification)
        .where(
            and_(
                Notification.user_id == user_id,
                Notification.is_archived == False,
            )
        )
        .values(is_archived=True)
    )
    result = await db.execute(stmt)
    await db.commit()

    return {"archived_count": result.rowcount}
