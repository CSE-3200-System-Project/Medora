#!/bin/bash
set -e

echo "Starting FastAPI Backend..."

# ============================================================================
# Database Connection Check with Retry Loop
# ============================================================================
echo "Waiting for database to be ready..."

if [ -z "$SUPABASE_DATABASE_URL" ]; then
    echo "SUPABASE_DATABASE_URL is not set"
    exit 1
fi

PSQL_DATABASE_URL="${SUPABASE_DATABASE_URL/postgresql+asyncpg/postgresql}"

MAX_RETRIES=30
RETRY_COUNT=0
DB_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if psql "$PSQL_DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo "Database is ready!"
        DB_READY=true
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Database not ready yet... Retry $RETRY_COUNT/$MAX_RETRIES (waiting 2s)"
    sleep 2
done

if [ "$DB_READY" = false ]; then
    echo "Database connection failed after $MAX_RETRIES retries"
    exit 1
fi

# ============================================================================
# Database Migrations
# ============================================================================
echo "Running database migrations..."

if ! alembic upgrade head; then
    echo "Database migrations failed"
    exit 1
fi

echo "Database migrations completed"

# ============================================================================
# Start FastAPI Server
# ============================================================================
echo "Starting FastAPI server on port 8000..."

# If RELOAD environment variable is set (for development), enable auto-reload
if [ "$RELOAD" = "true" ]; then
    echo "Hot reload enabled (development mode)"
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "Running in production mode (no hot reload)"
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
fi