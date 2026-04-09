from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from app.db.models.enums import UserRole

ChoruiRoleScope = Literal["patient", "doctor", "shared"]


@dataclass(frozen=True, slots=True)
class ChoruiRouteRegistryEntry:
    canonical_intent: str
    role: ChoruiRoleScope
    route: str
    requires_params: list[str] = field(default_factory=list)
    fallback_route: str | None = None
    enabled: bool = True
    notes: str = ""


@dataclass(frozen=True, slots=True)
class ChoruiRouteResolution:
    canonical_intent: str
    role_context: str
    route: str | None
    missing_params: list[str] = field(default_factory=list)
    fallback_route: str | None = None
    reason: str = "ok"
    registry_entry: ChoruiRouteRegistryEntry | None = None


CHORUI_ROUTE_REGISTRY_GOVERNANCE: tuple[str, ...] = (
    "Registry entries are limited to patient/doctor/shared routes only.",
    "Admin routes are excluded by definition and must never be added.",
    "Each canonical intent should map to one primary enabled entry per role scope.",
    "Dynamic intents must declare requires_params and a safe fallback route.",
)


_CHORUI_ROUTE_REGISTRY: tuple[ChoruiRouteRegistryEntry, ...] = (
    ChoruiRouteRegistryEntry(
        canonical_intent="go_home",
        role="patient",
        route="/patient/home",
        notes="Patient dashboard home fallback.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="find_doctor",
        role="patient",
        route="/patient/find-doctor",
        notes="Primary patient care discovery flow.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="appointments",
        role="patient",
        route="/patient/appointments",
        notes="Patient appointments list.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="medical_history",
        role="patient",
        route="/patient/medical-history",
        notes="Patient medical history timeline.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="medical_reports",
        role="patient",
        route="/patient/medical-reports",
        notes="Patient lab/medical reports list.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="prescriptions",
        role="patient",
        route="/patient/prescriptions",
        notes="Canonical prescription route.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="reminders",
        role="patient",
        route="/patient/reminders",
        notes="Patient medication reminders.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="find_medicine",
        role="patient",
        route="/patient/find-medicine",
        notes="Patient medicine lookup.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="patient_analytics",
        role="patient",
        route="/patient/analytics",
        notes="Patient analytics dashboard.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="patient_profile",
        role="patient",
        route="/patient/profile",
        notes="Patient profile management.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="patient_privacy",
        role="patient",
        route="/patient/privacy",
        notes="Patient privacy and sharing controls.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="go_home",
        role="doctor",
        route="/doctor/home",
        notes="Doctor dashboard home fallback.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_appointments",
        role="doctor",
        route="/doctor/appointments",
        notes="Doctor appointment management.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_patients",
        role="doctor",
        route="/doctor/patients",
        notes="Doctor patient list primary fallback.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_analytics",
        role="doctor",
        route="/doctor/analytics",
        notes="Doctor analytics page.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_schedule",
        role="doctor",
        route="/doctor/schedule",
        notes="Doctor schedule management page.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_profile",
        role="doctor",
        route="/doctor/profile",
        notes="Doctor profile page.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_find_medicine",
        role="doctor",
        route="/doctor/find-medicine",
        notes="Doctor medicine reference page.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_patient_detail",
        role="doctor",
        route="/doctor/patient/{id}",
        requires_params=["id"],
        fallback_route="/doctor/patients",
        notes="Doctor patient detail page requires patient id.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_patient_reports",
        role="doctor",
        route="/doctor/patient/{id}/reports",
        requires_params=["id"],
        fallback_route="/doctor/patients",
        notes="Doctor patient report list requires patient id.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_patient_consultation",
        role="doctor",
        route="/doctor/patient/{id}/consultation",
        requires_params=["id"],
        fallback_route="/doctor/patients",
        notes="Doctor consultation route requires patient id.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="doctor_patient_consultation_ai",
        role="doctor",
        route="/doctor/patient/{id}/consultation/ai",
        requires_params=["id"],
        fallback_route="/doctor/patients",
        notes="Doctor AI pre-consultation route requires patient id.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="settings",
        role="shared",
        route="/settings",
        notes="Shared settings route for patient and doctor.",
    ),
    ChoruiRouteRegistryEntry(
        canonical_intent="notifications",
        role="shared",
        route="/notifications",
        notes="Shared notifications route for patient and doctor.",
    ),
)


def _normalize_role_context(role_context: str | UserRole) -> str:
    if isinstance(role_context, UserRole):
        return str(role_context.value).strip().lower()
    return str(role_context or "").strip().lower()


def _entry_applies_to_role(entry: ChoruiRouteRegistryEntry, role_context: str) -> bool:
    if entry.role == "shared":
        return role_context in {"patient", "doctor"}
    return entry.role == role_context


def get_chorui_route_registry_entries() -> list[ChoruiRouteRegistryEntry]:
    return list(_CHORUI_ROUTE_REGISTRY)


def get_chorui_route_registry(role_context: str | UserRole) -> dict[str, ChoruiRouteRegistryEntry]:
    normalized_role = _normalize_role_context(role_context)
    if normalized_role not in {"patient", "doctor"}:
        return {}

    entries: dict[str, ChoruiRouteRegistryEntry] = {}
    for entry in _CHORUI_ROUTE_REGISTRY:
        if not entry.enabled:
            continue
        if not _entry_applies_to_role(entry, normalized_role):
            continue
        entries[entry.canonical_intent] = entry
    return entries


def resolve_chorui_navigation_route(
    *,
    canonical_intent: str,
    role_context: str | UserRole,
    params: dict[str, str] | None = None,
) -> ChoruiRouteResolution:
    normalized_role = _normalize_role_context(role_context)
    normalized_intent = str(canonical_intent or "").strip()

    if normalized_role not in {"patient", "doctor"}:
        return ChoruiRouteResolution(
            canonical_intent=normalized_intent,
            role_context=normalized_role,
            route=None,
            reason="role_out_of_scope",
        )

    if not normalized_intent:
        return ChoruiRouteResolution(
            canonical_intent=normalized_intent,
            role_context=normalized_role,
            route=None,
            reason="empty_intent",
        )

    role_registry = get_chorui_route_registry(normalized_role)
    entry = role_registry.get(normalized_intent)
    if entry is None:
        return ChoruiRouteResolution(
            canonical_intent=normalized_intent,
            role_context=normalized_role,
            route=None,
            reason="intent_not_registered",
        )

    route_params = {
        str(key).strip(): str(value).strip()
        for key, value in (params or {}).items()
        if str(key).strip() and str(value).strip()
    }

    missing_params = [param for param in entry.requires_params if not route_params.get(param)]
    if missing_params:
        return ChoruiRouteResolution(
            canonical_intent=normalized_intent,
            role_context=normalized_role,
            route=None,
            missing_params=missing_params,
            fallback_route=entry.fallback_route,
            reason="missing_required_params",
            registry_entry=entry,
        )

    resolved_route = entry.route
    if entry.requires_params:
        try:
            resolved_route = entry.route.format(**route_params)
        except KeyError:
            return ChoruiRouteResolution(
                canonical_intent=normalized_intent,
                role_context=normalized_role,
                route=None,
                missing_params=list(entry.requires_params),
                fallback_route=entry.fallback_route,
                reason="param_format_failed",
                registry_entry=entry,
            )

    if not resolved_route.startswith("/"):
        return ChoruiRouteResolution(
            canonical_intent=normalized_intent,
            role_context=normalized_role,
            route=None,
            reason="invalid_route_template",
            registry_entry=entry,
        )

    return ChoruiRouteResolution(
        canonical_intent=normalized_intent,
        role_context=normalized_role,
        route=resolved_route,
        missing_params=[],
        fallback_route=entry.fallback_route,
        reason="resolved",
        registry_entry=entry,
    )


__all__ = [
    "CHORUI_ROUTE_REGISTRY_GOVERNANCE",
    "ChoruiRouteRegistryEntry",
    "ChoruiRouteResolution",
    "get_chorui_route_registry",
    "get_chorui_route_registry_entries",
    "resolve_chorui_navigation_route",
]
