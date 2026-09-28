from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_screenshot_mode_skips_maintenance_and_workers(monkeypatch):
    from app import main

    monkeypatch.setenv("LOCAL_SCREENSHOT_MODE", "true")
    monkeypatch.setenv("PRELOAD_WHISPER_ON_STARTUP", "false")
    names = ["_ensure_scheduling_schema_compatibility", "_ensure_health_data_consent_schema_compatibility",
             "_ensure_arohon_tier_schema_compatibility", "start_reminder_dispatcher",
             "stop_reminder_dispatcher", "_run_hold_expiry_loop", "_run_auto_complete_loop",
             "_run_appointment_outbox_loop"]
    mocks = []
    for name in names:
        mock = AsyncMock()
        monkeypatch.setattr(main, name, mock)
        mocks.append(mock)
    async with main.lifespan(main.app):
        pass
    for mock in mocks:
        mock.assert_not_called()
