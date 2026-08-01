from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.processing_consent import ProcessingPurpose
from app.services.processing_consent import consent_is_active, require_processing_consent


def _grant(**overrides):
    now = datetime.now(timezone.utc)
    values = {
        "valid_from": now - timedelta(minutes=1),
        "valid_until": now + timedelta(minutes=1),
        "revoked_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_consent_active_expired_and_revoked_states():
    now = datetime.now(timezone.utc)
    assert consent_is_active(_grant(), now=now)
    assert not consent_is_active(_grant(valid_until=now - timedelta(seconds=1)), now=now)
    assert not consent_is_active(_grant(revoked_at=now), now=now)
    assert not consent_is_active(_grant(valid_from=now + timedelta(seconds=1)), now=now)


class _EmptyResult:
    def scalar_one_or_none(self):
        return None


class _EmptyDatabase:
    async def execute(self, _statement):
        return _EmptyResult()


@pytest.mark.asyncio
async def test_missing_external_consent_is_typed_and_offers_local_processing():
    with pytest.raises(HTTPException) as raised:
        await require_processing_consent(
            _EmptyDatabase(),
            subject_id="subject-1",
            purpose=ProcessingPurpose.CLOUD_DOCUMENT_OCR,
            provider="azure_document_intelligence",
            local_option_available=True,
        )
    assert raised.value.status_code == 403
    assert raised.value.detail == {
        "code": "processing_consent_required",
        "purpose": "cloud_document_ocr",
        "provider": "azure_document_intelligence",
        "required_scopes": [],
        "local_option_available": True,
        "message": "This external processing purpose has not been granted or is no longer valid.",
    }
