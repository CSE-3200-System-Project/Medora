"""Arohon: the authority ceiling that sits between a risk class and an AI path.

An endpoint declares the tier it *intends* to operate at. This module decides the tier it
is *allowed* to operate at, and the decision is made from the risk class and the consent
state alone — never from model confidence. That inversion is the whole point: a fluent
answer does not earn authority.

    requested tier  ──┐
    risk class      ──┼──▶  resolve_tier()  ──▶  TierDecision (granted tier + why)
    break-glass grant ┘

Two properties are load-bearing and are asserted by tests rather than left to review:

1. `resolve_tier` can only ever lower a tier. There is no input that raises the granted
   tier above the requested one, so an endpoint cannot be escalated by policy into doing
   something its own code was not written to do.

2. Self-harm can never reach L4. L4 means notifying a third party without a human in the
   loop at the moment of notification. For a self-harm disclosure that removes the
   person's agency and, in the team's judgement, suppresses future disclosure. This is
   enforced by membership in `L4_ELIGIBLE_RISK_CLASSES` — a frozenset that does not
   contain `SELF_HARM` — and not by a configuration value a deployment could flip.

This is an engineering specification for review, not a clinical guideline.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Mapping

from app.db.models.enums import AutonomyTier, RiskClass

__all__ = [
    "TIER_ORDER",
    "RISK_CEILINGS",
    "L4_ELIGIBLE_RISK_CLASSES",
    "EMERGENCY_RISK_CLASSES",
    "FEATURE_TIERS",
    "TierDecision",
    "tier_rank",
    "min_tier",
    "ceiling_for",
    "requested_tier_for_feature",
    "resolve_tier",
]


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------

#: Ascending authority. Index in this tuple is the tier's rank; nothing else defines it.
TIER_ORDER: tuple[AutonomyTier, ...] = (
    AutonomyTier.L0_ABSTAIN,
    AutonomyTier.L1_INFORM,
    AutonomyTier.L2_SUGGEST,
    AutonomyTier.L3_ESCALATE,
    AutonomyTier.L4_BREAK_GLASS,
)

_RANK: Mapping[AutonomyTier, int] = MappingProxyType({tier: index for index, tier in enumerate(TIER_ORDER)})


def tier_rank(tier: AutonomyTier) -> int:
    """Position of `tier` on the ladder. L0 is 0, L4 is 4."""
    return _RANK[tier]


def min_tier(left: AutonomyTier, right: AutonomyTier) -> AutonomyTier:
    """The lower authority of the two."""
    return left if tier_rank(left) <= tier_rank(right) else right


# ---------------------------------------------------------------------------
# Ceilings
# ---------------------------------------------------------------------------

#: Risk classes that describe a time-critical physical emergency. These are the paths
#: allowed to surface an L3 takeover, and the only ones a break-glass grant can lift.
EMERGENCY_RISK_CLASSES: frozenset[RiskClass] = frozenset(
    {
        RiskClass.CARDIAC,
        RiskClass.RESPIRATORY,
        RiskClass.STROKE,
        RiskClass.NEUROLOGIC,
        RiskClass.HEMORRHAGE,
        RiskClass.ANAPHYLAXIS,
        RiskClass.OBSTETRIC,
    }
)

#: The only classes a valid, unexpired break-glass grant can raise to L4.
#: `RiskClass.SELF_HARM` is absent by design and must stay absent — see the module
#: docstring. `test_arohon.py` asserts this membership directly.
L4_ELIGIBLE_RISK_CLASSES: frozenset[RiskClass] = EMERGENCY_RISK_CLASSES

#: Base ceiling per risk class, before any break-glass grant is considered.
RISK_CEILINGS: Mapping[RiskClass, AutonomyTier] = MappingProxyType(
    {
        RiskClass.CARDIAC: AutonomyTier.L3_ESCALATE,
        RiskClass.RESPIRATORY: AutonomyTier.L3_ESCALATE,
        RiskClass.STROKE: AutonomyTier.L3_ESCALATE,
        RiskClass.NEUROLOGIC: AutonomyTier.L3_ESCALATE,
        RiskClass.HEMORRHAGE: AutonomyTier.L3_ESCALATE,
        RiskClass.ANAPHYLAXIS: AutonomyTier.L3_ESCALATE,
        RiskClass.OBSTETRIC: AutonomyTier.L3_ESCALATE,
        # Support and human options are surfaced; dispatch stays a human act. L4 is not
        # reachable for this class under any grant.
        RiskClass.SELF_HARM: AutonomyTier.L3_ESCALATE,
        # Drafts, navigation, pre-fill. Never a decision that takes effect on its own.
        RiskClass.ROUTINE: AutonomyTier.L2_SUGGEST,
        # Nothing in the record supports an answer, so abstention is the correct output.
        RiskClass.OUT_OF_SCOPE: AutonomyTier.L0_ABSTAIN,
    }
)


def ceiling_for(risk_class: RiskClass, *, break_glass_grant_active: bool = False) -> AutonomyTier:
    """The highest tier `risk_class` may reach.

    `break_glass_grant_active` reflects a prior, still-valid, revocable grant naming a
    notification recipient. It lifts the ceiling to L4 only for the classes in
    `L4_ELIGIBLE_RISK_CLASSES`; for everything else it is ignored rather than rejected,
    so a caller cannot widen authority by asserting a grant it happens to hold.
    """
    base = RISK_CEILINGS[risk_class]
    if break_glass_grant_active and risk_class in L4_ELIGIBLE_RISK_CLASSES:
        return AutonomyTier.L4_BREAK_GLASS
    return base


# ---------------------------------------------------------------------------
# Declared tiers
# ---------------------------------------------------------------------------

#: The tier each AI feature declares it intends to operate at, keyed by the orchestrator
#: `feature` string. This is a registry rather than a branch in the orchestrator, for the
#: same reason Chorui's navigable destinations are a registry: adding a feature should be
#: adding a row, and a feature with no row should fail loudly instead of defaulting to
#: something permissive.
#:
#: Every entry today is L1 or L2, which is the honest state of the platform. Nothing in
#: the deployed stack drafts at L3; L3 is reached by the deterministic red-flag path
#: pre-empting the model entirely, and L4 by a prior grant. A feature is never listed
#: above the authority its own route actually exercises.
FEATURE_TIERS: Mapping[str, AutonomyTier] = MappingProxyType(
    {
        # Read-only, source-linked, shown to a clinician. Nothing is written back.
        "generate_patient_summary": AutonomyTier.L1_INFORM,
        "clinical_info_query": AutonomyTier.L1_INFORM,
        "extract_navigation_intent": AutonomyTier.L1_INFORM,
        # Produces a draft that pre-fills a form the human edits and signs before it
        # takes effect. `authoritative_writeback` is false on all of these.
        "structure_intake": AutonomyTier.L2_SUGGEST,
        "generate_soap_notes": AutonomyTier.L2_SUGGEST,
        "prescription_suggestions": AutonomyTier.L2_SUGGEST,
    }
)


class UndeclaredFeatureError(KeyError):
    """Raised when an AI feature runs without a declared tier.

    Failing here is deliberate. A feature that reaches the provider without appearing in
    `FEATURE_TIERS` has no ceiling and no tier to log, which is the exact condition the
    specification exists to make impossible.
    """


def requested_tier_for_feature(feature: str) -> AutonomyTier:
    """The tier `feature` declares. Raises rather than guessing."""
    try:
        return FEATURE_TIERS[feature]
    except KeyError as exc:
        raise UndeclaredFeatureError(
            f"AI feature {feature!r} has no declared Arohon tier. "
            f"Add it to FEATURE_TIERS in app/core/arohon.py."
        ) from exc


# ---------------------------------------------------------------------------
# Decision
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class TierDecision:
    """What an AI path was allowed to do, and why. Logged with the correlation ID.

    `correlation_id` is the orchestrator's per-request random token. It is not a stable
    subject identifier, so a tier log can be joined to one request without becoming a
    way to re-identify a patient across requests.
    """

    requested_tier: AutonomyTier
    granted_tier: AutonomyTier
    risk_class: RiskClass
    ceiling: AutonomyTier
    ceiling_applied: bool
    reason: str
    correlation_id: str | None = None

    @property
    def abstained(self) -> bool:
        return self.granted_tier is AutonomyTier.L0_ABSTAIN

    def as_log_fields(self) -> dict[str, str | bool | None]:
        """Flat form for `ai_interactions` and structured logs."""
        return {
            "requested_tier": self.requested_tier.value,
            "autonomy_tier": self.granted_tier.value,
            "risk_class": self.risk_class.value,
            "tier_ceiling": self.ceiling.value,
            "tier_ceiling_applied": self.ceiling_applied,
            "tier_reason": self.reason,
            "correlation_id": self.correlation_id,
        }


def resolve_tier(
    requested_tier: AutonomyTier,
    risk_class: RiskClass,
    *,
    break_glass_grant_active: bool = False,
    consent_ok: bool = True,
    correlation_id: str | None = None,
) -> TierDecision:
    """Resolve the tier an AI path may operate at.

    `consent_ok=False` means the data-sharing guard refused the payload. Authority then
    collapses to L0 whatever the risk class, because a path with nothing it is permitted
    to read has nothing to ground a claim in. Deny-by-default is upstream of the ladder,
    not a rung on it.
    """
    ceiling = ceiling_for(risk_class, break_glass_grant_active=break_glass_grant_active)

    if not consent_ok:
        return TierDecision(
            requested_tier=requested_tier,
            granted_tier=AutonomyTier.L0_ABSTAIN,
            risk_class=risk_class,
            ceiling=ceiling,
            ceiling_applied=requested_tier is not AutonomyTier.L0_ABSTAIN,
            reason="consent_denied",
            correlation_id=correlation_id,
        )

    granted = min_tier(requested_tier, ceiling)
    applied = granted is not requested_tier

    if applied:
        reason = f"ceiling_{risk_class.value}"
    else:
        reason = "requested_within_ceiling"

    return TierDecision(
        requested_tier=requested_tier,
        granted_tier=granted,
        risk_class=risk_class,
        ceiling=ceiling,
        ceiling_applied=applied,
        reason=reason,
        correlation_id=correlation_id,
    )
