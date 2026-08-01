from __future__ import annotations

import asyncio
import json
import os
import statistics
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.dependencies import get_db
from app.db.base import Base
from app.db.models.appointment import Appointment
from app.db.models.appointment_delivery import AppointmentOutboxEvent
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import UserRole
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from app.db.models.speciality import Speciality
from app.main import app
from app.services import appointment_service
from tests.helpers.backend_factories import DoctorProfileFactory, PatientProfileFactory, ProfileFactory


pytestmark = [pytest.mark.backend, pytest.mark.integration, pytest.mark.performance]


def _percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    return ordered[round((len(ordered) - 1) * fraction)]


def _latency_summary(values: list[float], scope: str) -> dict:
    return {
        "scope": scope,
        "n": len(values),
        "mean": statistics.mean(values),
        "p50": _percentile(values, 0.50),
        "p95": _percentile(values, 0.95),
        "p99": _percentile(values, 0.99),
    }


@pytest.mark.asyncio
async def test_frozen_booking_contention_protocol(
    backend_engine,
    backend_models_loaded,
    auth_token_map,
) -> None:
    """Run the 2/10/50 x 30 release protocol on a fresh PostgreSQL database."""
    async with backend_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
        await connection.execute(
            text(
                """
                CREATE UNIQUE INDEX uq_appointments_active_slot
                ON appointments (doctor_id, appointment_date, slot_time)
                WHERE slot_time IS NOT NULL
                  AND status IN (
                    'PENDING', 'CONFIRMED', 'PENDING_ADMIN_REVIEW',
                    'PENDING_DOCTOR_CONFIRMATION', 'PENDING_PATIENT_CONFIRMATION',
                    'RESCHEDULE_REQUESTED', 'CANCEL_REQUESTED'
                  )
                """
            )
        )

    sessions = async_sessionmaker(backend_engine, expire_on_commit=False)
    patient: Profile = ProfileFactory(role=UserRole.PATIENT, first_name="Booking", last_name="Fixture")
    patient_medical: PatientProfile = PatientProfileFactory(profile_id=patient.id)
    doctor: Profile = ProfileFactory(role=UserRole.DOCTOR, first_name="Slot", last_name="Fixture")
    specialty = Speciality(name="General Medicine")
    async with sessions() as session:
        session.add(specialty)
        await session.flush()
        doctor_medical: DoctorProfile = DoctorProfileFactory(
            profile_id=doctor.id,
            speciality_id=specialty.id,
            appointment_duration=30,
            day_time_slots={},
        )
        session.add_all([patient, patient_medical, doctor, doctor_medical])
        await session.commit()

    token = "softwarex-booking-patient"
    auth_token_map[token] = {"sub": patient.id, "email": patient.email}

    async def _request_session():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = _request_session
    transport = ASGITransport(app=app)
    base_date = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=7)

    async def book(client: AsyncClient, key: str, payload: dict) -> dict:
        started = time.perf_counter()
        response = await client.post(
            "/appointment/",
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key},
            json=payload,
        )
        return {
            "status": response.status_code,
            "body": response.json(),
            "latency_ms": (time.perf_counter() - started) * 1000,
            "key": key,
        }

    async def run_repetition(client: AsyncClient, level: int, sequence: int) -> dict:
        target = base_date + timedelta(days=sequence)
        payload = {
            "doctor_id": doctor.id,
            "appointment_date": target.isoformat(),
            "reason": "SoftwareX booking contention fixture",
            "notes": f"Synthetic fixture {level}-{sequence}",
        }
        keys = [f"swx-{level}-{sequence}-{uuid.uuid4()}" for _ in range(level)]
        attempts = await asyncio.gather(*(book(client, key, payload) for key in keys))
        successes = [item for item in attempts if item["status"] == 201]
        conflicts = [item for item in attempts if item["status"] in {400, 409}]
        unexpected = [item for item in attempts if item["status"] not in {201, 400, 409}]

        appointment_ids = {item["body"].get("id") for item in successes if item["body"].get("id")}
        database_rows = 0
        replay_ok = False
        mismatch_rejected = False
        propagation_ms = None
        outbox_processed = False
        appointment_id = next(iter(appointment_ids)) if len(appointment_ids) == 1 else None
        if appointment_id:
            winner = successes[0]
            replay = await book(client, winner["key"], payload)
            replay_ok = replay["status"] == 201 and replay["body"].get("id") == appointment_id
            mismatch_payload = dict(payload)
            mismatch_payload["reason"] = "same key with a different request"
            mismatch = await book(client, winner["key"], mismatch_payload)
            mismatch_rejected = mismatch["status"] == 400

            async with sessions() as session:
                appointment = await session.get(Appointment, appointment_id)
                database_rows = await session.scalar(
                    select(func.count(Appointment.id)).where(
                        Appointment.doctor_id == doctor.id,
                        Appointment.appointment_date == appointment.appointment_date,
                        Appointment.slot_time == appointment.slot_time,
                    )
                )
                await appointment_service.dispatch_appointment_outbox(session, batch_size=100)
                await session.commit()
                event = (
                    await session.execute(
                        select(AppointmentOutboxEvent).where(
                            AppointmentOutboxEvent.aggregate_id == appointment_id
                        )
                    )
                ).scalar_one()
                outbox_processed = event.processed_at is not None
                if event.processed_at is not None:
                    propagation_ms = (event.processed_at - event.created_at).total_seconds() * 1000

        passed = (
            len(successes) == 1
            and len(conflicts) == level - 1
            and not unexpected
            and len(appointment_ids) == 1
            and database_rows == 1
            and replay_ok
            and mismatch_rejected
            and outbox_processed
        )
        return {
            "repetition": sequence,
            "successes": len(successes),
            "conflicts": len(conflicts),
            "unexpected": [{"status": item["status"], "body": item["body"]} for item in unexpected],
            "unique_appointment_ids": len(appointment_ids),
            "database_rows": database_rows,
            "idempotent_replay": replay_ok,
            "idempotency_mismatch_rejected": mismatch_rejected,
            "outbox": {"processed": outbox_processed, "provider_propagation_ms": propagation_ms},
            "request_latencies_ms": [item["latency_ms"] for item in attempts],
            "passed": passed,
        }

    try:
        async with AsyncClient(transport=transport, base_url="http://testserver", timeout=90.0) as client:
            warmup: dict[str, dict] = {}
            results: list[dict] = []
            sequence = 0
            for level in (2, 10, 50):
                warmup[str(level)] = await run_repetition(client, level, sequence)
                sequence += 1
                raw = []
                for repetition in range(1, 31):
                    raw.append(await run_repetition(client, level, sequence))
                    sequence += 1
                transaction_latencies = [value for item in raw for value in item.pop("request_latencies_ms")]
                propagation_latencies = [
                    item["outbox"]["provider_propagation_ms"]
                    for item in raw
                    if item["outbox"]["provider_propagation_ms"] is not None
                ]
                results.append(
                    {
                        "concurrency": level,
                        "repetitions": 30,
                        "passed_repetitions": sum(item["passed"] for item in raw),
                        "passed": all(item["passed"] for item in raw),
                        "transaction_latency_ms": _latency_summary(
                            transaction_latencies,
                            "HTTP request through committed transaction",
                        ),
                        "notification_propagation_latency_ms": _latency_summary(
                            propagation_latencies,
                            "outbox creation to processed_at; not database consistency",
                        ),
                        "raw": raw,
                    }
                )
    finally:
        app.dependency_overrides.pop(get_db, None)

    report = {
        "schema_version": "1.0.0",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "protocol": {"concurrency": [2, 10, 50], "repetitions_per_level": 30, "warmup_per_level": 1},
        "warmup_excluded": warmup,
        "results": results,
        "passed": all(item["passed"] for item in results),
        "limitations": [
            "Outbox processed_at measures application delivery processing, not a user's network rendering time.",
            "All identities and appointment records in this fixture are synthetic.",
        ],
    }
    report_path = Path(
        os.getenv(
            "MEDORA_BOOKING_REPORT",
            "tests/benchmarks/reports/current/booking_results.json",
        )
    )
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    assert report["passed"], report_path
