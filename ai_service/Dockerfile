# ============================================================================
# STAGE 1: BUILD — install heavy dependencies in isolation
# ============================================================================
FROM --platform=linux/amd64 python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Build-time native deps for opencv, onnxruntime, paddlepaddle
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install --prefix=/install -r requirements.txt

# ============================================================================
# STAGE 2: RUNTIME — lean production image
# ============================================================================
FROM --platform=linux/amd64 python:3.11-slim AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    PYTHONPATH=/app

# Runtime native libs required by:
#   libgomp1        — onnxruntime, paddlepaddle OpenMP threading
#   libglib2.0-0    — opencv-python-headless
#   libgl1          — opencv-python-headless (libGL.so.1)
#   libsm6 libxext6 — opencv-python-headless (X11/SM/Ext)
#   curl            — health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-8000}/health" || exit 1

CMD ["uvicorn", "app.main:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--log-level", "info", \
    "--proxy-headers", \
    "--forwarded-allow-ips", "*"]
