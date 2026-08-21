"""Label an utterance with the risk class that governs its authority ceiling.

This is the deterministic screen that runs *before* any model call. It replaces nothing:
the patterns are the ones already deployed in `app/routes/ai_doctor.py`, partitioned by
what they actually match instead of collapsed into a single boolean. `is_emergency` on
the result is bit-for-bit the old `detect_emergency_red_flags` answer, so the archived
30-fixture navigation baseline cannot move because of this change — `test_arohon.py`
asserts that parity over every fixture.

Why partition at all: the old boolean put "I want to kill myself" and "crushing chest
pain" in the same bucket, and Arohon gives those two cases different ceilings. A single
boolean cannot express that, so the class has to be recovered from the rules.

Precedence when several classes match is fixed and deliberate. `SELF_HARM` wins over
everything. If someone discloses self-harm alongside a physical red flag, treating the
case as cardiac would make it L4-eligible and permit an autonomous notification, which is
exactly what the self-harm ceiling exists to prevent. The co-occurring classes are not
discarded — they stay in `matched_classes` so the tier log records the full picture.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Mapping, Pattern

from app.db.models.enums import RiskClass

__all__ = [
    "RiskAssessment",
    "RISK_PATTERNS",
    "CLASS_PRECEDENCE",
    "classify_risk",
    "is_emergency_text",
]


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------
# Every pattern below is a piece of the previously deployed EMERGENCY_PATTERNS tuple.
# The union of these is character-equivalent to that tuple; nothing was added, removed,
# or loosened here. New coverage belongs in its own reviewed change with fixtures.

RISK_PATTERNS: Mapping[RiskClass, tuple[Pattern[str], ...]] = MappingProxyType(
    {
        RiskClass.SELF_HARM: (
            re.compile(r"\b(?:suicid(?:e|al)|kill\s+myself|(?:hurt|harm)\s+myself)\b", re.IGNORECASE),
            re.compile(r"(?:আত্মহত্যা|নিজেকে\s*আঘাত)"),
        ),
        RiskClass.STROKE: (
            re.compile(r"\bstroke\b", re.IGNORECASE),
        ),
        RiskClass.HEMORRHAGE: (
            re.compile(r"\b(?:severe|heavy)\s+bleeding\b", re.IGNORECASE),
            re.compile(r"(?:প্রচুর\s*রক্তপাত)"),
        ),
        RiskClass.RESPIRATORY: (
            re.compile(r"\b(?:cannot|can't|unable to)\s+breathe\b", re.IGNORECASE),
            re.compile(r"\bnot\s+breathing\b", re.IGNORECASE),
            re.compile(r"(?:শ্বাস\s*নিতে\s*পারছি\s*না)"),
            # Added after the licensed review of the navigation fixtures: the reviewer
            # judged শ্বাসকষ্ট (dyspnoea) to need immediate handling rather than a
            # specialty suggestion, and corrected NAV-022 accordingly.
            re.compile(r"(?:শ্বাসকষ্ট)"),
        ),
        RiskClass.NEUROLOGIC: (
            re.compile(r"\b(?:unconscious|seizure|fainting)\b", re.IGNORECASE),
            re.compile(r"(?:অজ্ঞান|খিঁচুনি)"),
        ),
        RiskClass.CARDIAC: (
            re.compile(r"\b(?:severe\s+)?chest\s+pain\b", re.IGNORECASE),
            re.compile(r"(?:বুকে\s*তীব্র\s*ব্যথা)"),
            # ধড়ফড় (palpitations), same licensed review, NAV-023. Dizziness alone is
            # deliberately absent: মাথা ঘোরা is common in routine complaints and adding
            # it would trade a narrow rule for a broad one on no clinical instruction.
            re.compile(r"(?:ধড়ফড়)"),
        ),
        # Declared with no deployed rule. Both are named in the whitepaper's ceiling
        # table, and an endpoint may set them from structured context (for example an
        # obstetric appointment reason) rather than from free text. Leaving them empty is
        # the honest state: the ceiling exists, the text detector does not.
        RiskClass.ANAPHYLAXIS: (),
        RiskClass.OBSTETRIC: (),
    }
)

#: Which class governs when more than one fires. See the module docstring for why
#: SELF_HARM is first; the rest is ordered by how time-critical the response is.
CLASS_PRECEDENCE: tuple[RiskClass, ...] = (
    RiskClass.SELF_HARM,
    RiskClass.ANAPHYLAXIS,
    RiskClass.STROKE,
    RiskClass.HEMORRHAGE,
    RiskClass.RESPIRATORY,
    RiskClass.NEUROLOGIC,
    RiskClass.CARDIAC,
    RiskClass.OBSTETRIC,
)


@dataclass(frozen=True, slots=True)
class RiskAssessment:
    """The governing risk class plus everything else that fired."""

    risk_class: RiskClass
    matched_classes: tuple[RiskClass, ...] = field(default=())

    @property
    def is_emergency(self) -> bool:
        """True exactly when the deployed red-flag screen would have fired."""
        return bool(self.matched_classes)


def classify_risk(text: str, *, default: RiskClass = RiskClass.ROUTINE) -> RiskAssessment:
    """Classify one utterance.

    `default` is what an utterance with no red flag is called. Callers that already know
    the request falls outside the platform's scope pass `RiskClass.OUT_OF_SCOPE` so the
    ceiling drops to L0 instead of L2.
    """
    normalized = str(text or "").strip()
    if not normalized:
        return RiskAssessment(risk_class=default, matched_classes=())

    matched = tuple(
        risk_class
        for risk_class in CLASS_PRECEDENCE
        if any(pattern.search(normalized) for pattern in RISK_PATTERNS[risk_class])
    )
    if not matched:
        return RiskAssessment(risk_class=default, matched_classes=())

    return RiskAssessment(risk_class=matched[0], matched_classes=matched)


def is_emergency_text(text: str) -> bool:
    """Boolean form, kept so the deployed red-flag call site reads unchanged."""
    return classify_risk(text).is_emergency
