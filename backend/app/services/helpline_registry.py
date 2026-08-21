"""Which human help is actually reachable right now.

An emergency surface that prints a number nobody answers is worse than one that prints
nothing, because it consumes the seconds in which the person was still willing to act.
So this registry is time-aware and states its own limits.

Two facts drive the design:

* Kaan Pete Roi, the volunteer emotional-support line, operates 15:00-03:00 Asia/Dhaka.
  It is not a 24-hour service, and showing it at 06:00 sends someone to a dead ring.
* Shastho Batayon 16263 has been publicly reported to be in financial distress with
  unanswered calls. It stays in the registry because it is still the national health line,
  but it is marked `reliability="reported_degraded"` so the interface can rank it below
  alternatives rather than presenting it as a guarantee.

Consequently no entry is a hard dependency: `resolve_helplines` always returns at least
one always-available option, and the caller renders a manual alternative regardless.

This is a directory of human services. It performs no triage and makes no clinical
judgement; the risk class decides which subset is relevant, and the whole list is
advisory.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from typing import Iterable, Sequence
from zoneinfo import ZoneInfo

from app.db.models.enums import RiskClass

__all__ = [
    "BANGLADESH_TIMEZONE",
    "Helpline",
    "HELPLINES",
    "is_open_at",
    "resolve_helplines",
]

BANGLADESH_TIMEZONE = ZoneInfo("Asia/Dhaka")


@dataclass(frozen=True, slots=True)
class Helpline:
    """One reachable human service.

    `opens_at`/`closes_at` are local wall-clock times in `BANGLADESH_TIMEZONE`. Both None
    means the service is always available. A window whose close time is earlier than its
    open time wraps past midnight, which is the Kaan Pete Roi case.
    """

    key: str
    name_en: str
    name_bn: str
    number: str
    risk_classes: frozenset[RiskClass]
    opens_at: time | None = None
    closes_at: time | None = None
    reliability: str = "operational"
    note_en: str | None = None
    note_bn: str | None = None

    @property
    def always_available(self) -> bool:
        return self.opens_at is None or self.closes_at is None

    def is_open_at(self, moment: datetime) -> bool:
        if self.always_available:
            return True
        local = moment.astimezone(BANGLADESH_TIMEZONE).time()
        if self.opens_at <= self.closes_at:
            return self.opens_at <= local < self.closes_at
        # Wraps past midnight: open in the evening, closes in the small hours.
        return local >= self.opens_at or local < self.closes_at

    def as_payload(self, moment: datetime) -> dict[str, object]:
        return {
            "key": self.key,
            "name_en": self.name_en,
            "name_bn": self.name_bn,
            "number": self.number,
            "always_available": self.always_available,
            "open_now": self.is_open_at(moment),
            "opens_at": self.opens_at.strftime("%H:%M") if self.opens_at else None,
            "closes_at": self.closes_at.strftime("%H:%M") if self.closes_at else None,
            "reliability": self.reliability,
            "note_en": self.note_en,
            "note_bn": self.note_bn,
        }


_EMERGENCY_CLASSES = frozenset(
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

HELPLINES: tuple[Helpline, ...] = (
    Helpline(
        key="national_emergency",
        name_en="National Emergency Service",
        name_bn="জাতীয় জরুরি সেবা",
        number="999",
        # Present on both paths. Someone in crisis may also be physically injured, and
        # withholding the emergency number from that screen would be a design choice
        # nobody could defend.
        risk_classes=frozenset(_EMERGENCY_CLASSES | {RiskClass.SELF_HARM}),
    ),
    Helpline(
        key="kaan_pete_roi",
        name_en="Kaan Pete Roi (emotional support)",
        name_bn="কান পেতে রই (মানসিক সহায়তা)",
        number="09612-119911",
        risk_classes=frozenset({RiskClass.SELF_HARM}),
        opens_at=time(15, 0),
        closes_at=time(3, 0),
        note_en="Volunteer listeners, 3 PM to 3 AM.",
        note_bn="স্বেচ্ছাসেবী শ্রোতা, বিকেল ৩টা থেকে রাত ৩টা।",
    ),
    Helpline(
        key="shastho_batayon",
        name_en="Shastho Batayon health line",
        name_bn="স্বাস্থ্য বাতায়ন",
        number="16263",
        risk_classes=frozenset(_EMERGENCY_CLASSES | {RiskClass.SELF_HARM}),
        reliability="reported_degraded",
        note_en="National health line. Calls have been reported to go unanswered.",
        note_bn="জাতীয় স্বাস্থ্য লাইন। কল না ধরার খবর পাওয়া গেছে।",
    ),
    Helpline(
        key="national_mental_health",
        name_en="National Institute of Mental Health helpline",
        name_bn="জাতীয় মানসিক স্বাস্থ্য ইনস্টিটিউট হেল্পলাইন",
        number="01688-709965",
        risk_classes=frozenset({RiskClass.SELF_HARM}),
        opens_at=time(9, 0),
        closes_at=time(17, 0),
        note_en="Office hours, 9 AM to 5 PM.",
        note_bn="অফিস সময়, সকাল ৯টা থেকে বিকেল ৫টা।",
    ),
)


def is_open_at(key: str, moment: datetime) -> bool:
    for helpline in HELPLINES:
        if helpline.key == key:
            return helpline.is_open_at(moment)
    raise KeyError(key)


def resolve_helplines(
    risk_class: RiskClass,
    *,
    now: datetime | None = None,
    registry: Sequence[Helpline] = HELPLINES,
) -> list[dict[str, object]]:
    """Helplines relevant to `risk_class`, open ones first.

    Closed entries are returned rather than hidden, carrying `open_now=False` and their
    hours, so the interface can say "opens at 3 PM" instead of silently shrinking the
    list to nothing. Ordering is: open and operational, then open but reported degraded,
    then closed. Within a group the registry order is preserved, which puts 999 first.
    """
    moment = now or datetime.now(tz=BANGLADESH_TIMEZONE)
    relevant: Iterable[Helpline] = (item for item in registry if risk_class in item.risk_classes)

    def sort_key(item: Helpline) -> tuple[int, int]:
        open_now = item.is_open_at(moment)
        degraded = item.reliability != "operational"
        return (0 if open_now else 1, 1 if degraded else 0)

    ordered = sorted(relevant, key=sort_key)
    return [item.as_payload(moment) for item in ordered]
