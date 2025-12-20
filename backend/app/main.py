from fastapi import FastAPI
from app.routes import health,auth  # Changed to relative import
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Allow your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
