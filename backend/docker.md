# Docker Setup Guide - Medora Backend

## Prerequisites

- **Docker:** 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose:** 1.29+ (usually comes with Docker Desktop)
- **Environment Variables:** Configured in `.env` file

## Quick Start (30 seconds)

### 1. Clone Configuration
```bash
cp .env.example .env
# Edit .env and add your Supabase & Groq credentials
```

### 2. Build & Run
```bash
docker-compose up --build
```

Expected output:
```
backend-1  | Starting FastAPI Backend...
backend-1  | Waiting for database to be ready...
backend-1  | Database is ready!
backend-1  | Running database migrations...
backend-1  | Database migrations completed
backend-1  | Starting FastAPI server on port 8000...
backend-1  | INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 3. Test the API
```bash
curl http://localhost:8000/health
# Response: {"status":"ok","database":"connected"}
```

## Detailed Configuration

### Environment Variables

**Required for Backend:**
- `SUPABASE_DATABASE_URL` - PostgreSQL connection string (async format)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase service role key
- `GROQ_API_KEY` - Groq API key for LLM

**Optional:**
- `ALLOWED_ORIGINS` - CORS origins (default: `http://localhost:3000`)
- `ADMIN_PASSWORD` - Admin panel password (default: `admin123`)
- `RELOAD` - Enable hot reload in dev (`true`/`false`, default: `false`)
- `RUN_MIGRATIONS` - Run Alembic on container startup (`true`/`false`, default: `true`)

### Getting Credentials

#### Supabase
1. Go to [supabase.io](https://supabase.io)
2. Create/select project
3. Settings → Database → Connection Strings → URI (copy production URL)
4. Change `postgresql://` to `postgresql+asyncpg://`
5. Settings → API → Project URL and Service Role Key

#### Groq
1. Go to [console.groq.com](https://console.groq.com)
2. Create API key
3. Copy key to `.env` as `GROQ_API_KEY`

## Common Commands

### Build Image
```bash
docker-compose build
```

### Run Container (Detached)
```bash
docker-compose up -d
```

### View Logs
```bash
# All services
docker-compose logs -f

# Only backend
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail 100 backend
```

### Stop Container
```bash
docker-compose down
```

### Stop & Remove Volumes (Reset Database Connection)
```bash
docker-compose down -v
```

## Development Mode

### Enable Hot Reload
Edit `.env`:
```bash
RELOAD=true
```

Then restart:
```bash
docker-compose restart backend
```

Changes to Python files will auto-reload the server.

### Interactive Shell
```bash
docker-compose exec backend bash
```

### Run Migrations Manually
```bash
docker-compose exec backend alembic upgrade head
```

### Consultation Draft Schema Runbook
Use this whenever consultation draft errors suggest schema drift (for example, missing `consultations.draft_id`).

```bash
# 1) Verify current revision and head revision
docker-compose exec backend alembic current
docker-compose exec backend alembic heads

# 2) Apply pending migrations
docker-compose exec backend alembic upgrade head

# 3) Re-check revision (should match head)
docker-compose exec backend alembic current
```

Expected consultation draft architecture after migration:
- `consultations.draft_id` exists
- `consultation_drafts` table exists
- legacy `consultations.draft_payload` column is removed

Optional verification SQL:
```bash
docker-compose exec backend psql "$SUPABASE_DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'consultations' AND column_name IN ('draft_id', 'draft_payload');"
docker-compose exec backend psql "$SUPABASE_DATABASE_URL" -c "SELECT to_regclass('public.consultation_drafts');"
```

### Check Database Connection
```bash
docker-compose exec backend psql $SUPABASE_DATABASE_URL -c "SELECT 1"
```

## Production Deployment

### Build Image for Production
```bash
docker build -t medora-backend:1.0.0 ./backend
```

### Run with Docker Secrets (Recommended)
```bash
docker run -d \
  --name medora-backend \
  -p 8000:8000 \
  -e SUPABASE_DATABASE_URL=postgresql+asyncpg://... \
  -e SUPABASE_URL=https://... \
  -e SUPABASE_KEY=... \
  -e GROQ_API_KEY=... \
  -e RELOAD=false \
  medora-backend:1.0.0
```

### Docker Compose for Production
Create `docker-compose.prod.yml`:
```yaml
version: '3.9'
services:
  backend:
    image: medora-backend:1.0.0
    ports:
      - "8000:8000"
    environment:
      SUPABASE_DATABASE_URL: ${SUPABASE_DATABASE_URL}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
      GROQ_API_KEY: ${GROQ_API_KEY}
      RELOAD: "false"
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
```

Deploy:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Container Won't Start
**Problem:** Container exits immediately
```bash
docker-compose logs backend
```
Check for:
- Database connection errors
- Missing environment variables
- Migration failures

**Solution:**
1. Verify `.env` has all required variables
2. Check database is accessible: `psql $SUPABASE_DATABASE_URL -c "SELECT 1"`
3. Check migrations: `docker-compose exec backend alembic current`

### Port Already in Use
**Problem:** `bind: address already in use`

**Solution:**
```bash
# Option 1: Use different port
docker-compose down
# Edit docker-compose.yml: ports: - "8001:8000"
docker-compose up

# Option 2: Free port 8000
lsof -i :8000
kill -9 <PID>
```

### Database Migrations Fail
**Problem:** `alembic upgrade head` fails in container

**Check current migration status:**
```bash
docker-compose exec backend alembic current
docker-compose exec backend alembic heads
```

**Rollback if needed:**
```bash
docker-compose exec backend alembic downgrade -1
```

### High Memory Usage
**Problem:** Container using too much memory

**Solutions:**
1. Limit Whisper model loading (already optimized with int8)
2. Add resource limits in docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 1G
```

## Performance Optimization

### Image Size
- **Base Image:** `python:3.11-slim` (~150MB)
- **Final Image:** ~800MB (includes faster-whisper model cache)

### Layer Caching
- `RUN pip install` is cached if `requirements.txt` unchanged
- Changes to `app/` code don't require pip reinstall

### Multi-Stage Build (Optional)
For even smaller images:
```dockerfile
FROM python:3.11-slim as builder
# ... build dependencies ...

FROM python:3.11-slim
COPY --from=builder /usr/local/lib/python3.11/site-packages ...
COPY --from=builder /app ...
```

## Health Checks

### Container Health Status
```bash
docker-compose ps
```

Look for `STATUS` column - should show `healthy` (after ~30s startup)

### Manual Health Check
```bash
curl http://localhost:8000/health
# {"status":"ok","database":"connected"}
```

## Logging Strategy

### View Structured Logs
```bash
docker-compose logs --timestamps backend | grep ERROR
docker-compose logs --timestamps backend | grep INFO
```

### Export Logs
```bash
docker-compose logs backend > backend.log
```

### Real-time Log Monitoring
```bash
docker-compose logs -f backend --tail 50
```

## Next Steps

1. Configure `.env` with credentials
2. Run `docker-compose up --build`
3. Test health endpoint: `curl http://localhost:8000/health`
4. Test database: `curl http://localhost:8000/doctor/search`
5. (Optional) Enable hot reload for development

---

**Documentation Last Updated:** January 28, 2026  
**For issues:** Check container logs with `docker-compose logs backend`