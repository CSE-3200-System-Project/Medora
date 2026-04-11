from app.db.models.enums import UserRole
from app.services.chorui_navigation_registry import (
    get_chorui_route_registry,
    get_chorui_route_registry_entries,
    resolve_chorui_navigation_route,
)


def test_registry_contains_no_admin_routes() -> None:
    entries = get_chorui_route_registry_entries()

    assert entries
    assert all(not entry.route.startswith("/admin") for entry in entries)


def test_doctor_dynamic_route_requires_id_and_has_fallback() -> None:
    result = resolve_chorui_navigation_route(
        canonical_intent="doctor_patient_reports",
        role_context=UserRole.DOCTOR,
        params={},
    )

    assert result.route is None
    assert result.reason == "missing_required_params"
    assert "id" in result.missing_params
    assert result.fallback_route == "/doctor/patients"


def test_doctor_dynamic_route_formats_with_id() -> None:
    result = resolve_chorui_navigation_route(
        canonical_intent="doctor_patient_reports",
        role_context="doctor",
        params={"id": "PT-ABCDEFGHJK"},
    )

    assert result.route == "/doctor/patient/PT-ABCDEFGHJK/reports"
    assert result.reason == "resolved"


def test_admin_scope_is_blocked() -> None:
    result = resolve_chorui_navigation_route(
        canonical_intent="doctor_patients",
        role_context=UserRole.ADMIN,
    )

    assert result.route is None
    assert result.reason == "role_out_of_scope"


def test_shared_registry_routes_visible_for_patient_and_doctor() -> None:
    patient_registry = get_chorui_route_registry("patient")
    doctor_registry = get_chorui_route_registry("doctor")

    assert patient_registry["settings"].route == "/settings"
    assert patient_registry["notifications"].route == "/notifications"
    assert doctor_registry["settings"].route == "/settings"
    assert doctor_registry["notifications"].route == "/notifications"
