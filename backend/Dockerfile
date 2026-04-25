# ============================================================================
# STAGE 1: BUILD — install dependencies in an isolated layer
# ============================================================================
FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install --prefix=/install -r requirements.txt

# ============================================================================
# STAGE 2: RUNTIME — lean production image
# ============================================================================
FROM python:3.11-slim AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    PYTHONPATH=/app

# postgresql-client is needed by entrypoint.sh for DB readiness check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Fix line endings and set permissions before dropping privileges
RUN sed -i 's/\r$//' app/entrypoint.sh && chmod +x app/entrypoint.sh

# Non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-8000}/health" || exit 1

ENTRYPOINT ["/bin/bash", "/app/app/entrypoint.sh"]
