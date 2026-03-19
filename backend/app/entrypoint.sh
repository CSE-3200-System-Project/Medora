#!/usr/bin/env bash
set -Eeuo pipefail

echo "Starting FastAPI Backend..."

APP_HOST="0.0.0.0"
APP_PORT="${PORT:-${WEBSITES_PORT:-8000}}"
RELOAD_MODE="${RELOAD:-false}"
WAIT_FOR_DB="${WAIT_FOR_DB:-true}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-false}"
UVICORN_WORKERS="${UVICORN_WORKERS:-2}"

if ! [[ "$UVICORN_WORKERS" =~ ^[1-9][0-9]*$ ]]; then
    echo "UVICORN_WORKERS must be a positive integer, got: $UVICORN_WORKERS"
    exit 1
fi

if [ "$RELOAD_MODE" = "true" ] && [ "$UVICORN_WORKERS" != "1" ]; then
    echo "RELOAD=true ignores UVICORN_WORKERS=$UVICORN_WORKERS (reload mode uses a single worker)"
fi

if [ "$WAIT_FOR_DB" = "true" ] || [ "$RUN_MIGRATIONS" = "true" ]; then
    if [ -z "${SUPABASE_DATABASE_URL:-}" ]; then
        echo "SUPABASE_DATABASE_URL is not set"
        exit 1
    fi
fi

if [ "$WAIT_FOR_DB" = "true" ]; then
    echo "Waiting for database to be ready..."

    PSQL_DATABASE_URL="${SUPABASE_DATABASE_URL/postgresql+asyncpg/postgresql}"
    MAX_RETRIES=30
    RETRY_COUNT=0
    DB_READY=false

    while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
        if psql "$PSQL_DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
            echo "Database is ready!"
            DB_READY=true
            break
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Database not ready yet... Retry $RETRY_COUNT/$MAX_RETRIES (waiting 2s)"
        sleep 2
    done

    if [ "$DB_READY" = "false" ]; then
        echo "Database connection failed after $MAX_RETRIES retries"
        exit 1
    fi
else
    echo "Skipping database wait (WAIT_FOR_DB=$WAIT_FOR_DB)"
fi

if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    if ! alembic upgrade head; then
        echo "Database migrations failed"
        exit 1
    fi
    echo "Database migrations completed"
else
    echo "Skipping migrations (RUN_MIGRATIONS=$RUN_MIGRATIONS)"
fi

echo "Starting FastAPI server on port $APP_PORT..."

if [ "$RELOAD_MODE" = "true" ]; then
    echo "Hot reload enabled (development mode)"
    exec uvicorn app.main:app --host "$APP_HOST" --port "$APP_PORT" --reload
else
    echo "Running in production mode (no hot reload)"
    exec uvicorn app.main:app --host "$APP_HOST" --port "$APP_PORT" --workers "$UVICORN_WORKERS"
fi
