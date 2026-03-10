# ============================================================================
# STAGE 1: BASE IMAGE & DEPENDENCIES
# ============================================================================
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
# Prevents Python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

# Install system dependencies
# - gcc: Required for building some Python packages (faster-whisper dependencies)
# - postgresql-client: For debugging database connections (optional)
# - curl: For health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# ============================================================================
# STAGE 2: PYTHON DEPENDENCIES
# ============================================================================

# Copy requirements first (for better layer caching)
COPY requirements.txt .

# Install Python dependencies
# --no-cache-dir is already set as env var above
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# ============================================================================
# STAGE 3: APPLICATION CODE
# ============================================================================

# Copy entire backend directory
COPY . .


# Create non-root user for security (optional but recommended)
# RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
# USER appuser

# ============================================================================
# STAGE 4: RUNTIME SETUP
# ============================================================================

RUN sed -i 's/\r$//' app/entrypoint.sh && chmod +x app/entrypoint.sh

# Expose the port FastAPI runs on
EXPOSE 8000

# Health check (optional but useful)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD sh -c 'curl -fsS "http://localhost:${PORT:-8000}/health" || exit 1'

# Run entrypoint script
ENTRYPOINT ["/bin/bash", "-c", "sed -i 's/\\r$//' /app/app/entrypoint.sh && exec /bin/bash /app/app/entrypoint.sh"]
