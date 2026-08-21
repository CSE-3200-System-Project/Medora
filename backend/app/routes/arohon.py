"""Arohon surfaces: what the ladder looks like, and what happened at the top of it.

Two endpoints, both small on purpose.

`GET /arohon/policy` publishes the tier ladder and the ceiling table. It is the
specification as data rather than as prose, so the interface, the benchmark, and anyone
auditing the claim all read the same source instead of three transcriptions of it.

`POST /arohon/escalation-events` records the outcome of an L3 surface. A dismissal is a
labelled false positive for Lokkhon axis A, which is a number that can only come from the
live surface. The request carries no utterance and no subject identifier, and the route
stores none.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.arohon import (
    FEATURE_TIERS,
    L4_ELIGIBLE_RISK_CLASSES,
    RISK_CEILINGS,
    TIER_ORDER,
)
from app.core.dependencies import get_db
from app.db.models.arohon_escalation import ArohonEscalationEvent
from app.db.models.enums import RiskClass
from app.services.helpline_registry import HELPLINES, resolve_helplines

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Policy
# ---------------------------------------------------------------------------

_TIER_DESCRIPTIONS: dict[str, dict[str, str]] = {
    "L0_abstain": {"human_gate": "none", "constraint": "supported claims only"},
    "L1_inform": {"human_gate": "reads", "constraint": "source-linked"},
    "L2_suggest": {"human_gate": "confirms", "constraint": "before effect"},
    "L3_escalate": {"human_gate": "acts", "constraint": "recall-first"},
    "L4_break_glass": {"human_gate": "notified", "constraint": "prior revocable grant"},
}


@router.get("/policy")
async def get_arohon_policy() -> dict[str, Any]:
    """The tier ladder, the ceilings, and the declared tier of every AI feature.

    Unauthenticated on purpose. This is a published specification, not patient data, and
    a control layer nobody can inspect is a control layer nobody can check.
    """
    return {
        "tiers": [
            {"tier": tier.value, "rank": rank, **_TIER_DESCRIPTIONS[tier.value]}
            for rank, tier in enumerate(TIER_ORDER)
        ],
        "ceilings": [
            {
                "risk_class": risk_class.value,
                "ceiling": ceiling.value,
                "l4_eligible_with_grant": risk_class in L4_ELIGIBLE_RISK_CLASSES,
            }
            for risk_class, ceiling in RISK_CEILINGS.items()
        ],
        "feature_tiers": [
            {"feature": feature, "declared_tier": tier.value}
            for feature, tier in FEATURE_TIERS.items()
        ],
        "notes": {
            "self_harm": (
                "Capped at L3. L4 is structurally unreachable for this class, not disabled "
                "by configuration, because notifying a third party without the person in the "
                "loop removes their agency."
            ),
            "not_a_medical_device": (
                "Arohon bounds an assistive workflow. It does not diagnose, prescribe, or "
                "dispatch, and it is an engineering specification rather than a clinical "
                "guideline."
            ),
        },
    }


@router.get("/helplines")
async def get_helplines(risk_class: RiskClass = RiskClass.SELF_HARM) -> dict[str, Any]:
    """Human services relevant to `risk_class`, resolved against the current time.

    Closed entries are returned with their hours rather than hidden, so the interface can
    say when a line opens instead of silently showing a shorter list.
    """
    return {
        "risk_class": risk_class.value,
        "helplines": resolve_helplines(risk_class),
        "registry_size": len(HELPLINES),
    }


# ---------------------------------------------------------------------------
# Escalation outcomes
# ---------------------------------------------------------------------------

class EscalationEventRequest(BaseModel):
    """The outcome of one L3 surface.

    `correlation_id` comes from the search response that produced the surface. Nothing
    here identifies a person or repeats what they typed.
    """

    correlation_id: str = Field(min_length=4, max_length=64)
    risk_class: RiskClass
    autonomy_tier: str = Field(max_length=24)
    escalation_mode: Literal["emergency_takeover", "crisis_support"]
    outcome: Literal["dismissed", "acted", "expired"]
    locale: str = Field(default="en", max_length=8)
    surfaced_at: Optional[datetime] = None


class EscalationEventResponse(BaseModel):
    recorded: bool
    event_id: Optional[str] = None
    duplicate: bool = False


@router.post("/escalation-events", response_model=EscalationEventResponse)
async def record_escalation_event(
    payload: EscalationEventRequest,
    db: AsyncSession = Depends(get_db),
) -> EscalationEventResponse:
    """Record how an L3 surface resolved.

    Unauthenticated, because the emergency surface itself is reachable without a session
    and an outcome that only gets recorded for signed-in users would bias axis A toward
    whoever happened to be logged in. There is nothing sensitive in the payload to
    protect, and the unique constraint on `correlation_id` means a replay updates nothing
    and inflates nothing.
    """
    event = ArohonEscalationEvent(
        id=str(uuid.uuid4()),
        correlation_id=payload.correlation_id,
        risk_class=payload.risk_class.value,
        autonomy_tier=payload.autonomy_tier,
        escalation_mode=payload.escalation_mode,
        outcome=payload.outcome,
        locale=payload.locale,
        surfaced_at=payload.surfaced_at,
    )
    db.add(event)
    try:
        await db.commit()
    except IntegrityError:
        # One outcome per surface. A retry, a double-tap, or a restored page arriving
        # second is expected, not an error.
        await db.rollback()
        return EscalationEventResponse(recorded=False, duplicate=True)
    except Exception as exc:  # pragma: no cover - defensive
        await db.rollback()
        logger.warning("Failed to record Arohon escalation event: %s", exc)
        raise HTTPException(status_code=503, detail="Could not record escalation outcome")

    return EscalationEventResponse(recorded=True, event_id=event.id)
