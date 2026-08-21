"""What happened after an L3 surface was shown.

Lokkhon axis A scores emergency escalation by counting false negatives against false
positives, and the whitepaper commits to a dismissal being recorded as a labelled
false-positive event. That number can only come from the live surface: a fixture set says
what the rules do, not what a person did when the takeover appeared.

Deliberately absent from this table: the utterance, the patient's identity, and anything
derived from either. What is stored is the risk class the rules assigned, the tier that
was granted, which screen was rendered, and what the person did about it. `correlation_id`
is a random token minted when the surface was produced, so an outcome joins back to its
own escalation and to nothing else.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class ArohonEscalationEvent(Base):
    __tablename__ = "arohon_escalation_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    #: Random per-surface token from the search response. Not a subject identifier.
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    risk_class: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    autonomy_tier: Mapped[str] = mapped_column(String(24), nullable=False)
    escalation_mode: Mapped[str] = mapped_column(String(32), nullable=False)

    #: "dismissed" scores as a false positive for axis A. "acted" means the person used
    #: one of the offered human options. "expired" means the surface closed untouched,
    #: which is neither, and is kept separate rather than folded into dismissal.
    outcome: Mapped[str] = mapped_column(String(24), nullable=False, index=True)

    locale: Mapped[str] = mapped_column(String(8), nullable=False, default="en")

    surfaced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
