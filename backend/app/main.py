import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import health, auth, profile, upload, admin, doctor, speciality

app = FastAPI(title="Backend API")

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

app.include_router(health.router)
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(profile.router, prefix="/profile", tags=["Profile"])
app.include_router(upload.router, prefix="/upload", tags=["Upload"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(doctor.router, prefix="/doctor", tags=["Doctor"])
app.include_router(speciality.router, prefix="/specialities", tags=["Specialities"])
app.include_router(doctor.router, prefix="/doctor", tags=["Doctor"])  # Add this