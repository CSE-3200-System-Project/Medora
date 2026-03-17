import os
import logging
from time import perf_counter
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routes import health, auth, profile, upload, admin, doctor, speciality, appointment, ai_doctor, medicine, medical_test, notification, patient_access, reminder, consultation, availability, reschedule, oauth

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.
    - Startup: Preload Whisper model for voice transcription
    - Shutdown: Cleanup resources
    """
    preload_whisper = os.getenv("PRELOAD_WHISPER_ON_STARTUP", "false").lower() == "true"

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
    
    yield  # Application runs
    
    # Shutdown: Cleanup (if needed)
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
    allow_origins=origins, # Allows specific origins
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
app.include_router(medicine.router, prefix="/medicine", tags=["Medicine"])
app.include_router(medical_test.router, prefix="/medical-test", tags=["Medical Test"])
app.include_router(notification.router, prefix="/notifications", tags=["Notifications"])
app.include_router(patient_access.router, prefix="/patient-access", tags=["Patient Access"])
app.include_router(reminder.router, prefix="/reminders", tags=["Reminders"])
app.include_router(consultation.router, prefix="/consultation", tags=["Consultation"])
app.include_router(availability.router, prefix="/availability", tags=["Availability"])
app.include_router(reschedule.router, prefix="/reschedule", tags=["Reschedule"])
app.include_router(oauth.router, prefix="/oauth", tags=["OAuth"])
