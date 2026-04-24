import os

# Must be set before oauthlib is imported anywhere (google_auth_oauthlib depends on it).
# Google returns scopes as full URIs ("userinfo.email") even if we requested short aliases
# ("email"), which oauthlib treats as a fatal scope mismatch unless relaxed.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

import logging
import asyncio
from time import perf_counter
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.routes import health, auth, profile, upload, admin, doctor, speciality, appointment, ai_doctor, ai_consultation, medicine, medical_test, notification, patient_access, reminder, consultation, consultation_ai, availability, reschedule, oauth, health_metrics, doctor_actions, patient_dashboard, health_data_consent, medical_report, patient_data_sharing, review
from app.services.reminder_dispatcher import start_reminder_dispatcher, stop_reminder_dispatcher
from app.db.session import AsyncSessionLocal
from app.services import appointment_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _ensure_scheduling_schema_compatibility() -> None:
    """Repair known scheduling schema drift in long-lived/dev databases."""
    try:
        async with AsyncSessionLocal() as db:
            appointments_table_exists = (
                await db.execute(
                    text("SELECT to_regclass('public.appointments')")
                )
            ).scalar_one_or_none() is not None
            if appointments_table_exists:
                await db.execute(
                    text(
                        "ALTER TABLE IF EXISTS appointments "
                        "ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ"
                    )
                )
                await db.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_appointments_hold_expires_at "
                        "ON appointments (hold_expires_at)"
                    )
                )

            reschedule_table_exists = (
                await db.execute(
                    text("SELECT to_regclass('public.appointment_reschedule_requests')")
                )
            ).scalar_one_or_none() is not None
            if reschedule_table_exists:
                await db.execute(
                    text(
                        "ALTER TABLE IF EXISTS appointment_reschedule_requests "
                        "ADD COLUMN IF NOT EXISTS responded_by_id VARCHAR"
                    )
                )
                await db.execute(
                    text(
                        "ALTER TABLE IF EXISTS appointment_reschedule_requests "
                        "ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ"
                    )
                )
                await db.execute(
                    text(
                        "ALTER TABLE IF EXISTS appointment_reschedule_requests "
                        "ADD COLUMN IF NOT EXISTS response_note TEXT"
                    )
                )
                await db.execute(
                    text(
                        "ALTER TABLE IF EXISTS appointment_reschedule_requests "
                        "ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ"
                    )
                )
                await db.execute(
                    text(
                        """
                        DO $$
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1
                                FROM pg_constraint
                                WHERE conname = 'fk_appointment_reschedule_requests_responded_by_id_profiles'
                            ) THEN
                                ALTER TABLE appointment_reschedule_requests
                                ADD CONSTRAINT fk_appointment_reschedule_requests_responded_by_id_profiles
                                FOREIGN KEY (responded_by_id) REFERENCES profiles(id);
                            END IF;
                        END
                        $$;
                        """
                    )
                )
                await db.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_appointment_reschedule_requests_responded_by_id "
                        "ON appointment_reschedule_requests (responded_by_id)"
                    )
                )

            await db.commit()
    except Exception as exc:
        logger.warning("Scheduling schema compatibility check failed: %s", exc)


async def _ensure_health_data_consent_schema_compatibility() -> None:
    """Repair health data consent schema drift in environments that missed migrations."""
    try:
        async with AsyncSessionLocal() as db:
            consent_table_exists = (
                await db.execute(
                    text("SELECT to_regclass('public.health_data_consents')")
                )
            ).scalar_one_or_none() is not None

            if not consent_table_exists:
                return

            await db.execute(
                text(
                    "ALTER TABLE IF EXISTS health_data_consents "
                    "ADD COLUMN IF NOT EXISTS share_medical_tests BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            await db.commit()
    except Exception as exc:
        logger.warning("Health data consent schema compatibility check failed: %s", exc)


async def _run_hold_expiry_loop(stop_event: asyncio.Event) -> None:
    """Periodically expire stale pending soft-holds."""
    interval_seconds = int(os.getenv("APPOINTMENT_HOLD_SWEEP_INTERVAL_SECONDS", "60"))

    while not stop_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                expired_count = await appointment_service.expire_pending_holds(db)
                if expired_count > 0:
                    await db.commit()
                    logger.info("Expired %s pending appointment hold(s)", expired_count)
                else:
                    await db.rollback()
        except Exception as exc:
            logger.warning("Hold expiry loop iteration failed: %s", exc)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue


async def _run_auto_complete_loop(stop_event: asyncio.Event) -> None:
    """Periodically auto-complete appointments whose scheduled time has passed."""
    interval_seconds = int(os.getenv("APPOINTMENT_AUTO_COMPLETE_INTERVAL_SECONDS", "120"))

    while not stop_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                completed = await appointment_service.auto_complete_overdue_appointments(db)
                if completed > 0:
                    await db.commit()
                    logger.info("Auto-completed %s overdue appointment(s)", completed)
                else:
                    await db.rollback()
        except Exception as exc:
            logger.warning("Auto-complete loop iteration failed: %s", exc)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.
    - Startup: Preload Whisper model for voice transcription
    - Shutdown: Cleanup resources
    """
    preload_whisper = os.getenv("PRELOAD_WHISPER_ON_STARTUP", "true").lower() == "true"

    # Startup: Preload the Whisper ASR model
    # This avoids slow first request when voice transcription is used
    if preload_whisper:
        try:
            logger.info("Preloading Whisper ASR model...")
            from app.services.asr import preload_model
            preload_model()
            logger.info("Whisper model preloaded successfully")
        except Exception as e:
            logger.warning(f"Failed to preload Whisper model: {e}")
            logger.warning("Model will be loaded on first voice transcription request")
    else:
        logger.info("Skipping Whisper preload (PRELOAD_WHISPER_ON_STARTUP=false)")

    # Startup: self-heal known scheduling drift (kept idempotent)
    await _ensure_scheduling_schema_compatibility()
    await _ensure_health_data_consent_schema_compatibility()

    # Startup: backfill missing avatar URLs once. Previously ran on first login
    # which blocked the user; hoisting to startup keeps request paths clean.
    try:
        from app.core.avatar_defaults import backfill_missing_avatar_urls
        async with AsyncSessionLocal() as _db:
            await backfill_missing_avatar_urls(_db)
            await _db.commit()
    except Exception as exc:
        logger.warning("Avatar backfill on startup failed: %s", exc)

    # Startup: begin reminder dispatch loop
    try:
        await start_reminder_dispatcher()
    except Exception as exc:
        logger.warning("Failed to start reminder dispatcher: %s", exc)

    hold_expiry_stop_event = asyncio.Event()
    hold_expiry_task = asyncio.create_task(_run_hold_expiry_loop(hold_expiry_stop_event))

    auto_complete_stop_event = asyncio.Event()
    auto_complete_task = asyncio.create_task(_run_auto_complete_loop(auto_complete_stop_event))

    yield  # Application runs

    # Shutdown: Cleanup (if needed)
    hold_expiry_stop_event.set()
    auto_complete_stop_event.set()
    await hold_expiry_task
    await auto_complete_task
    await stop_reminder_dispatcher()
    logger.info("Shutting down...")


app = FastAPI(title="Backend API", lifespan=lifespan)

# Get allowed origins from env or default to localhost
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add additional origins if specified in env (comma separated)
if os.getenv("ALLOWED_ORIGINS"):
    origins.extend(os.getenv("ALLOWED_ORIGINS").split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allows specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_performance_headers(request: Request, call_next):
    start = perf_counter()
    response = await call_next(request)
    duration_ms = (perf_counter() - start) * 1000

    response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"
    server_timing_value = f"app;dur={duration_ms:.1f}"
    existing_server_timing = response.headers.get("Server-Timing")
    if existing_server_timing:
        response.headers["Server-Timing"] = f"{existing_server_timing}, {server_timing_value}"
    else:
        response.headers["Server-Timing"] = server_timing_value

    return response


app.include_router(health.router)
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(profile.router, prefix="/profile", tags=["Profile"])
app.include_router(upload.router, prefix="/upload", tags=["Upload"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(doctor.router, prefix="/doctor", tags=["Doctor"])
app.include_router(speciality.router, prefix="/specialities", tags=["Specialities"])
app.include_router(appointment.router, prefix="/appointment", tags=["Appointment"])
app.include_router(ai_doctor.router, prefix="/ai", tags=["AI Doctor Search"])
app.include_router(ai_consultation.router, prefix="/ai", tags=["AI Consultation"])
app.include_router(medicine.router, prefix="/medicine", tags=["Medicine"])
app.include_router(medical_test.router, prefix="/medical-test", tags=["Medical Test"])
app.include_router(notification.router, prefix="/notifications", tags=["Notifications"])
app.include_router(patient_access.router, prefix="/patient-access", tags=["Patient Access"])
app.include_router(reminder.router, prefix="/reminders", tags=["Reminders"])
app.include_router(consultation.router, prefix="/consultation", tags=["Consultation"])
app.include_router(consultation_ai.router, prefix="/consultation", tags=["Consultation AI"])
app.include_router(availability.router, prefix="/availability", tags=["Availability"])
app.include_router(reschedule.router, prefix="/reschedule", tags=["Reschedule"])
app.include_router(oauth.router, prefix="/oauth", tags=["OAuth"])
app.include_router(health_metrics.router, prefix="/health-metrics", tags=["Health Metrics"])
app.include_router(doctor_actions.router, prefix="/doctor/actions", tags=["Doctor Actions"])
app.include_router(patient_dashboard.router, prefix="/patient", tags=["Patient Dashboard"])
app.include_router(health_data_consent.router, prefix="/health-data", tags=["Health Data Consent"])
app.include_router(medical_report.router, prefix="/medical-reports", tags=["Medical Reports"])
app.include_router(patient_data_sharing.router, prefix="/patient-data-sharing", tags=["Patient Data Sharing"])
app.include_router(review.router, prefix="/reviews", tags=["Doctor Reviews"])
