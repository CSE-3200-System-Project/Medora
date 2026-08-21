"""The Arohon surfaces: the published policy and the escalation-outcome record.

The policy endpoint is checked against `app.core.arohon` rather than against a copied
literal, because a published specification that drifts from the code it describes is worse
than no published specification. The escalation endpoint is checked for what it refuses to
store as much as for what it stores.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.arohon import FEATURE_TIERS, L4_ELIGIBLE_RISK_CLASSES, RISK_CEILINGS, TIER_ORDER
from app.db.models.enums import RiskClass
from app.routes.arohon import (
    EscalationEventRequest,
    get_arohon_policy,
    get_helplines,
    record_escalation_event,
)


# ---------------------------------------------------------------------------
# Published policy
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_policy_publishes_the_ladder_in_order() -> None:
    policy = await get_arohon_policy()
    assert [entry["tier"] for entry in policy["tiers"]] == [tier.value for tier in TIER_ORDER]
    assert [entry["rank"] for entry in policy["tiers"]] == list(range(len(TIER_ORDER)))


@pytest.mark.asyncio
async def test_policy_ceilings_match_the_code_they_describe() -> None:
    policy = await get_arohon_policy()
    published = {entry["risk_class"]: entry["ceiling"] for entry in policy["ceilings"]}
    assert published == {key.value: value.value for key, value in RISK_CEILINGS.items()}


@pytest.mark.asyncio
async def test_policy_reports_self_harm_as_never_l4_eligible() -> None:
    policy = await get_arohon_policy()
    self_harm = next(
        entry for entry in policy["ceilings"] if entry["risk_class"] == RiskClass.SELF_HARM.value
    )
    assert self_harm["l4_eligible_with_grant"] is False
    assert self_harm["ceiling"] == "L3_escalate"
    assert RiskClass.SELF_HARM not in L4_ELIGIBLE_RISK_CLASSES


@pytest.mark.asyncio
async def test_policy_lists_every_declared_feature_tier() -> None:
    policy = await get_arohon_policy()
    published = {entry["feature"]: entry["declared_tier"] for entry in policy["feature_tiers"]}
    assert published == {key: value.value for key, value in FEATURE_TIERS.items()}


@pytest.mark.asyncio
async def test_policy_states_the_non_device_boundary() -> None:
    policy = await get_arohon_policy()
    note = policy["notes"]["not_a_medical_device"].lower()
    assert "does not diagnose" in note
    assert "prescribe" in note


# ---------------------------------------------------------------------------
# Helplines
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_helpline_endpoint_defaults_to_the_self_harm_registry() -> None:
    payload = await get_helplines()
    assert payload["risk_class"] == RiskClass.SELF_HARM.value
    assert payload["helplines"]
    assert any(item["always_available"] for item in payload["helplines"])


# ---------------------------------------------------------------------------
# Escalation outcomes
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _models(backend_models_loaded):
    """The escalation model has relationships back into the wider registry.

    Constructing one in isolation leaves SQLAlchemy unable to resolve names such as
    `AIInteraction`, so the session-scoped loader has to have run first.
    """


def _session() -> AsyncMock:
    """An async session whose `add` is synchronous, because the real one is."""
    db = AsyncMock()
    db.add = MagicMock()
    return db


def _event(outcome: str = "dismissed", mode: str = "emergency_takeover") -> EscalationEventRequest:
    return EscalationEventRequest(
        correlation_id="esc_0123456789abcdef",
        risk_class=RiskClass.CARDIAC,
        autonomy_tier="L3_escalate",
        escalation_mode=mode,
        outcome=outcome,
        locale="bn",
        surfaced_at=datetime(2026, 8, 21, 12, 0, tzinfo=timezone.utc),
    )


@pytest.mark.asyncio
async def test_a_dismissal_is_recorded() -> None:
    db = _session()
    response = await record_escalation_event(_event(), db)

    assert response.recorded is True
    assert response.duplicate is False
    db.add.assert_called_once()
    stored = db.add.call_args.args[0]
    assert stored.outcome == "dismissed"
    assert stored.risk_class == "cardiac"
    assert stored.correlation_id == "esc_0123456789abcdef"


@pytest.mark.asyncio
async def test_a_replayed_outcome_does_not_inflate_the_false_positive_count() -> None:
    """One outcome per surface. A double-tap must not read as two dismissals."""
    db = _session()
    db.commit.side_effect = IntegrityError("insert", {}, Exception("duplicate key"))

    response = await record_escalation_event(_event(), db)

    assert response.recorded is False
    assert response.duplicate is True
    db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_the_stored_event_carries_no_utterance_or_subject() -> None:
    """The audit value of this table depends on it holding nothing re-identifying."""
    db = _session()
    await record_escalation_event(_event(), db)
    stored = db.add.call_args.args[0]

    columns = {column.name for column in stored.__table__.columns}
    for forbidden in ("user_text", "utterance", "query", "patient_id", "profile_id", "doctor_id"):
        assert forbidden not in columns, forbidden


@pytest.mark.asyncio
async def test_the_request_schema_rejects_an_outcome_it_does_not_define() -> None:
    with pytest.raises(ValueError):
        EscalationEventRequest(
            correlation_id="esc_0123456789abcdef",
            risk_class=RiskClass.CARDIAC,
            autonomy_tier="L3_escalate",
            escalation_mode="emergency_takeover",
            outcome="ignored_forever",
            locale="en",
        )


@pytest.mark.asyncio
async def test_the_request_schema_rejects_an_undefined_escalation_mode() -> None:
    with pytest.raises(ValueError):
        EscalationEventRequest(
            correlation_id="esc_0123456789abcdef",
            risk_class=RiskClass.CARDIAC,
            autonomy_tier="L3_escalate",
            escalation_mode="autodial",
            outcome="acted",
            locale="en",
        )


@pytest.mark.asyncio
async def test_crisis_outcomes_are_recorded_the_same_way_as_takeover_outcomes() -> None:
    db = _session()
    response = await record_escalation_event(_event(outcome="acted", mode="crisis_support"), db)

    assert response.recorded is True
    stored = db.add.call_args.args[0]
    assert stored.escalation_mode == "crisis_support"
    assert stored.outcome == "acted"
