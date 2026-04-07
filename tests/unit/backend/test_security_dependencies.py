from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.dependencies import require_doctor


def test_require_doctor_accepts_verified_doctor() -> None:
    profile = SimpleNamespace(
        role=SimpleNamespace(value="doctor"),
        verification_status=SimpleNamespace(value="verified"),
    )
    result = asyncio.run(require_doctor(profile=profile))
    assert result is profile


def test_require_doctor_rejects_patient_role() -> None:
    profile = SimpleNamespace(
        role=SimpleNamespace(value="patient"),
        verification_status=SimpleNamespace(value="verified"),
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_doctor(profile=profile))
    assert exc.value.status_code == 403


def test_require_doctor_rejects_unverified_doctor() -> None:
    profile = SimpleNamespace(
        role=SimpleNamespace(value="doctor"),
        verification_status=SimpleNamespace(value="pending"),
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_doctor(profile=profile))
    assert exc.value.status_code == 403
