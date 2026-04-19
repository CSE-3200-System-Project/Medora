# Deployment & CI/CD Documentation

## Live Deployment URLs

> **Note**: Replace placeholder URLs with actual deployed URLs when available.

| Service | URL | Status |
|---------|-----|--------|
| **Frontend (Next.js PWA)** | `https://medora-app.azurewebsites.net` | ✅ Production |
| **Backend API (FastAPI)** | `https://medora-backend.azurecontainerapps.io` | ✅ Production |
| **AI OCR Service** | `https://medora-ai-ocr.azurecontainerapps.io` | ✅ Production |
| **Grafana Dashboards** | `https://medora-grafana.azurewebsites.net` | ✅ Monitoring |
| **Prometheus Metrics** | `https://medora-prometheus.azurewebsites.net` | ✅ Metrics |

---

## Architecture Overview

Medora is deployed on **Microsoft Azure** using a cloud-native architecture designed for scalability, reliability, and cost-effectiveness.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Azure Cloud                             │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │   Azure Container    │    │   Azure Container Apps       │  │
│  │   Registry (ACR)     │    │   (Backend + AI OCR)         │  │
│  │                      │    │                                │  │
│  │  - Backend Image     │───▶│  - FastAPI Service            │  │
│  │  - AI OCR Image      │    │  - AI OCR Service             │  │
│  └──────────────────────┘    │  - Auto-scaling               │  │
│                              └──────────┬───────────────────┘  │
│                                         │                       │
│  ┌──────────────────────┐               │                       │
│  │   Azure Static Web   │               │                       │
│  │   Apps / App Service │               │                       │
│  │   (Frontend)         │               │                       │
│  │                      │               │                       │
│  │  - Next.js PWA       │───────────────┘                       │
│  │  - Static Assets     │                                       │
│  └──────────────────────┘                                       │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │   Supabase           │    │   Azure Monitor / Grafana    │  │
│  │   (Database + Auth)  │    │   (Observability)            │  │
│  │                      │    │                                │  │
│  │  - PostgreSQL        │    │  - Prometheus Metrics         │  │
│  │  - Auth              │    │  - Grafana Dashboards         │  │
│  │  - Storage           │    │  - Alerting                   │  │
│  │  - Realtime          │    │                                │  │
│  └──────────────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployment Infrastructure

### 1. Frontend - Next.js PWA

**Platform**: Azure Static Web Apps / Azure App Service  
**Build Tool**: Vercel / Azure Build Pipeline  
**Configuration**:
```yaml
# next.config.ts
- PWA enabled via Serwist
- Output: 'standalone' for Docker optimization
- Images: Remote patterns configured for avatars
- i18n: English + Bangla locales
- Performance: Bundle checks, code splitting
```

**Deployment Strategy**:
- Static asset build (HTML, CSS, JS, service worker)
- Server-side rendering via Azure Functions (if App Service)
- CDN caching for static assets
- PWA manifest and icons served from `/public`

**PWA Features in Production**:
- Offline caching via service worker
- Background sync queue for API mutations
- Push notifications via VAPID
- Installable on mobile devices
- Web vitals monitoring

---

### 2. Backend - FastAPI Service

**Platform**: Azure Container Apps  
**Container Registry**: Azure Container Registry (ACR)  
**Image**: `medora-backend:latest`

**Dockerfile** (`backend/Dockerfile`):
```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m appuser
USER appuser

# Set working directory
WORKDIR /app

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Entrypoint script handles:
# 1. Database wait
# 2. Alembic migrations
# 3. Uvicorn startup
CMD ["sh", "app/entrypoint.sh"]
```

**Container App Configuration**:
```yaml
# Azure Container Apps Settings
- Minimum replicas: 1
- Maximum replicas: 10 (auto-scaling)
- CPU: 0.5 - 2.0 cores
- Memory: 1.0 - 4.0 GB
- Ingress: External (HTTPS)
- Target port: 8000
- Environment variables: Injected from Azure Key Vault / App Settings
```

**Health Check**:
- Endpoint: `GET /health`
- Returns: Service status + database connectivity check
- Interval: 30 seconds
- Timeout: 10 seconds

---

### 3. AI OCR Service - FastAPI + YOLO + Azure OCR

**Platform**: Azure Container Apps  
**Container Registry**: Azure Container Registry (ACR)  
**Image**: `medora-ai-ocr:latest`

**Dockerfile** (`ai_service/Dockerfile`):
```dockerfile
FROM python:3.11-slim

# Install ONNX Runtime dependencies
RUN apt-get update && apt-get install -y \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m appuser
USER appuser

# Set working directory
WORKDIR /app

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and models
COPY . .

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

# Run AI OCR service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

**Container App Configuration**:
```yaml
# Azure Container Apps Settings
- Minimum replicas: 1
- Maximum replicas: 5 (auto-scaling)
- CPU: 1.0 - 4.0 cores (OCR is compute-intensive)
- Memory: 2.0 - 8.0 GB
- Ingress: Internal (only accessible by backend)
- Target port: 8001
- Models: YOLO ONNX models mounted as Azure File Share
```

**Isolation Strategy**:
- AI OCR runs on separate Container App to prevent OCR CPU spikes from impacting core API latency
- Internal ingress ensures only backend can access OCR service
- Auto-scaling based on CPU utilization and queue depth

---

### 4. Database - Supabase (PostgreSQL)

**Platform**: Supabase Cloud (Managed PostgreSQL)  
**Features Used**:
- PostgreSQL 15+ with async SQLAlchemy
- Supabase Auth (JWT-based authentication)
- Supabase Storage (file uploads, documents)
- Supabase Realtime (websocket channels for live updates)
- Row Level Security (RLS) for data access control

**Connection Pooling**:
- Connection pool managed by Supabase PgBouncer
- Async sessions in FastAPI backend
- Pool size: Configurable via environment variables

**Migrations**:
- Alembic migration framework
- Auto-applied on container startup (development)
- Manual migration in production via CI/CD or admin control

---

## CI/CD Pipelines

### GitHub Actions Workflows

All CI/CD pipelines are defined in `.github/workflows/` and trigger on push/PR to `main` branch.

---

#### 1. Backend Deployment (`deploy-backend.yml`)

**Trigger**: Push to `main` with changes to `backend/`  
**Stages**:

```yaml
# Stage 1: Build Backend Image
- Checkout code
- Set up Docker Buildx
- Login to Azure Container Registry
- Build Docker image with cache optimization
- Push image to ACR with tag: latest + commit SHA

# Stage 2: Deploy to Azure Container Apps
- Login to Azure CLI
- Update Container App with new image
- Wait for deployment to complete
- Run health check validation

# Stage 3: Post-Deployment Validation
- Run integration tests against production
- Verify API endpoints
- Check database connectivity
```

**Environment Variables Injected**:
- All `backend/.env` variables via Azure App Settings
- Secrets stored in Azure Key Vault
- Database URLs, API keys, VAPID keys, etc.

---

#### 2. AI OCR Deployment (`deploy-ai-ocr.yml`)

**Trigger**: Push to `main` with changes to `ai_service/`  
**Stages**:

```yaml
# Stage 1: Build AI OCR Image
- Checkout code
- Set up Docker Buildx
- Login to Azure Container Registry
- Build Docker image (includes ONNX models)
- Push image to ACR with tag: latest + commit SHA

# Stage 2: Deploy AI OCR Service
- Login to Azure CLI
- Update AI OCR Container App
- Verify health endpoint
- Test OCR endpoint with sample image
```

**Special Considerations**:
- ONNX models are baked into image or mounted as Azure File Share
- Azure OCR credentials injected via Key Vault
- Longer health check timeout due to model loading

---

#### 3. Performance Budget (`performance-budget.yml`)

**Trigger**: Pull Request to `main`  
**Purpose**: Prevent performance regressions

**Checks**:
```yaml
# Frontend Bundle Size Check
- Build Next.js application
- Analyze bundle size
- Fail if bundle exceeds budget (e.g., 500KB initial load)

# Lighthouse CI (Mobile)
- Run Lighthouse audit on mobile emulation
- Performance score ≥ 90
- Accessibility score ≥ 90
- Best Practices score ≥ 90
- SEO score ≥ 90

# Lighthouse CI (Desktop)
- Run Lighthouse audit on desktop
- Stricter performance thresholds
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s
- Cumulative Layout Shift < 0.1
```

**Failure Behavior**:
- PR blocked from merging if thresholds not met
- Report posted as PR comment with detailed metrics

---

#### 4. Testing & Benchmarking (`testing-benchmarking.yml`)

**Trigger**: Push to `main` + Pull Request  
**Purpose**: Run comprehensive test suite

**Test Stages**:
```yaml
# Stage 1: Backend Unit Tests
- Set up Python 3.11
- Install dependencies
- Run pytest with coverage
- Fail if coverage < 80%

# Stage 2: AI OCR Unit Tests
- Set up Python 3.11
- Install AI dependencies
- Run OCR unit tests
- Validate YOLO, Azure OCR, matcher

# Stage 3: Integration Tests
- Start test database container
- Run backend integration tests
- Test API contracts and clinical workflows

# Stage 4: E2E Tests (Playwright)
- Set up Node.js 18+
- Install Playwright browsers
- Run E2E test specs
- Validate appointment booking, verification, OCR

# Stage 5: Security Tests
- Test RBAC enforcement
- JWT validation
- Access control boundaries

# Stage 6: Benchmark Reports
- Run API latency benchmark
- Run DB concurrency test
- Generate benchmark summary
- Upload to `tests/benchmarks/reports/`
```

---

## Deployment Workflow

### Local Development → Production Pipeline

```
1. Developer creates feature branch
   ↓
2. Implements code with tests
   ↓
3. Opens Pull Request
   ↓
4. CI/CD triggers:
   - Linting checks
   - Type checks (TypeScript, Pydantic)
   - Unit tests
   - Integration tests
   - Performance budget (Lighthouse)
   ↓
5. Code review by teammate
   ↓
6. Merge to main
   ↓
7. CI/CD triggers automatic deployment:
   - Build Docker images
   - Push to Azure Container Registry
   - Deploy to Azure Container Apps
   - Run health checks
   ↓
8. Post-deployment validation:
   - Integration tests against production
   - Monitoring dashboards updated
   ↓
9. If failure: automatic rollback to previous image
```

---

## Environment Configuration

### Environment Variables by Service

#### Backend Production Environment
```bash
# Database
SUPABASE_DATABASE_URL=postgresql+asyncpg://<credentials>@<host>:5432/postgres
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_STORAGE_BUCKET=medora-storage

# AI Providers
AI_PROVIDER=groq
GROQ_API_KEY=<key>
GEMINI_API_KEY=<key>
CEREBRAS_CLOUD_API_KEY=<key>

# AI OCR Service
AI_OCR_SERVICE_URL=https://medora-ai-ocr.azurecontainerapps.io

# Authentication
AI_ID_HASH_SECRET=<secret_for_pii_tokenization>

# VAPID Push Notifications
WEB_PUSH_VAPID_PUBLIC_KEY=<key>
WEB_PUSH_VAPID_PRIVATE_KEY=<key>
WEB_PUSH_VAPID_SUBJECT=mailto:notifications@medora.app

# Vapi Voice
VAPI_PUBLIC_KEY=<key>
VAPI_ASSISTANT_ID=<id>
VAPI_TOOL_SHARED_SECRET=<secret>

# Google Calendar OAuth
GOOGLE_CLIENT_ID=<client_id>
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_REDIRECT_URI=https://medora-backend.azurecontainerapps.io/oauth/google/callback

# CORS
ALLOWED_ORIGINS=https://medora-app.azurewebsites.net

# Reminder Dispatcher
REMINDER_DISPATCH_ENABLED=true
REMINDER_DISPATCH_INTERVAL_SECONDS=30
DEFAULT_REMINDER_TIMEZONE=Asia/Dhaka

# SMTP Email
SMTP_HOST=<smtp_host>
SMTP_PORT=587
SMTP_USERNAME=<username>
SMTP_PASSWORD=<password>
SMTP_FROM_EMAIL=no-reply@medora.app
```

#### AI OCR Service Production Environment
```bash
# Azure Document Intelligence
AZURE_OCR_ENDPOINT=https://<resource>.cognitiveservices.azure.com/
AZURE_OCR_KEY=<key>
AZURE_OCR_MODEL_ID=prebuilt-read

# YOLO Detection
YOLO_MODEL_PATH=/app/models/yolo26s.onnx
YOLO_INPUT_SIZE=640
YOLO_CONFIDENCE_THRESHOLD=0.5
YOLO_IOU_THRESHOLD=0.45

# Medicine Matching
SUPABASE_DATABASE_URL=postgresql+asyncpg://<credentials>@<host>:5432/postgres
MEDICINE_DB_TABLE=medicine
MEDICINE_MATCH_MIN_CONFIDENCE=0.75
```

#### Frontend Production Environment
```bash
NEXT_PUBLIC_BACKEND_URL=https://medora-backend.azurecontainerapps.io
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_PERF_API_CACHE_TTL=3600
NEXT_PUBLIC_RUM_SAMPLE_RATE=0.1
```

---

## Monitoring & Observability

### Prometheus Metrics

**Scrape Configuration** (`observability/prometheus.yml`):
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'backend'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['medora-backend.azurecontainerapps.io']

  - job_name: 'ai-ocr'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['medora-ai-ocr.azurecontainerapps.io']

  - job_name: 'frontend'
    static_configs:
      - targets: ['medora-app.azurewebsites.net']

  - job_name: 'postgres'
    static_configs:
      - targets: ['<supabase-host>:5432']
```

**Metrics Collected**:
- Request latency (p50, p95, p99)
- Request throughput (RPS)
- Error rates by endpoint
- Database query duration
- AI OCR processing time
- Active WebSocket connections
- Background job execution time
- Cache hit rates

---

### Grafana Dashboards

Four pre-configured dashboards provisioned automatically:

#### 1. AI Performance Dashboard
- LLM provider latency by model
- AI OCR processing time distribution
- YOLO detection confidence histogram
- Medicine matching accuracy
- AI request throughput
- Error rates by provider

#### 2. Appointment Load Dashboard
- Appointment bookings per hour
- Slot availability refresh rate
- Realtime channel subscription count
- Appointment status distribution
- Reschedule request rate
- Cancellation rate

#### 3. Error Heatmap Dashboard
- Error rate by endpoint (heatmap)
- Error type breakdown (pie chart)
- HTTP status code distribution
- Database connection pool utilization
- Memory and CPU utilization
- Alert history

#### 4. System Health Overview
- Service uptime percentage
- Response time trends
- Database query performance
- Container app replica count
- Auto-scaling events
- Deployment frequency
- Mean time to recovery (MTTR)

---

## Scaling Strategy

### Current Auto-Scaling Rules

| Service | Min Replicas | Max Replicas | Scale Trigger |
|---------|-------------|--------------|---------------|
| Backend | 1 | 10 | CPU > 70% or concurrent requests > 100 |
| AI OCR | 1 | 5 | CPU > 80% or queue depth > 10 |
| Frontend | 2 | 20 | Concurrent connections > 500 |

### Future Scaling Path

1. **Database Read Replicas**: Add read replicas for high-volume queries (doctor search, dashboards)
2. **Redis Cache Layer**: Cache frequently accessed data (specialty catalog, doctor profiles)
3. **Message Queue**: Introduce Azure Service Bus for async jobs (OCR, email dispatch, reminder processing)
4. **CDN Integration**: Azure CDN for static assets and API responses
5. **Multi-Region Deployment**: Deploy to multiple Azure regions for geographic redundancy
6. **Database Sharding**: Shard patient records by region for horizontal scaling

---

## Disaster Recovery

### Backup Strategy
- **Database**: Supabase automated daily backups with 7-day retention
- **File Storage**: Supabase Storage with geo-redundancy
- **Container Images**: ACR retains all pushed images for rollback

### Recovery Procedures

#### Database Restore
```bash
# 1. Identify backup point in Supabase dashboard
# 2. Restore database to point-in-time
# 3. Verify data integrity
# 4. Restart backend containers to reconnect
```

#### Service Rollback
```bash
# Rollback to previous container app revision
az containerapp revision copy \
  --name medora-backend \
  --resource-group medora-rg \
  --revision <previous-revision-name>
```

#### Incident Response
1. Alert triggered via Grafana (error rate > 5% or latency > 2s)
2. Investigate via Grafana dashboards and Azure Monitor logs
3. If database issue: check Supabase status, connection pool
4. If container issue: check logs, restart or rollback
5. If frontend issue: check CDN cache, rollback deployment
6. Post-incident review and documentation

---

## Security & Compliance

### Network Security
- All services communicate over HTTPS
- Internal ingress for AI OCR (backend-only access)
- CORS restricted to production frontend URL
- Database connection via SSL/TLS
- VNet integration (optional, for enhanced security)

### Application Security
- JWT token verification on all protected endpoints
- Role-based access control (RBAC) enforced
- Data sharing consent checks for sensitive health data
- PII anonymization before AI processing
- Input validation via Pydantic schemas
- SQL injection prevention via SQLAlchemy ORM
- Rate limiting (configurable per endpoint)

### Secrets Management
- All secrets stored in Azure Key Vault
- No hardcoded credentials in codebase
- Environment variables injected at runtime
- Supabase service role key restricted to backend only
- API keys rotated regularly

### Audit Trail
- Appointment audit log for status changes
- Patient access log for data sharing events
- AI interaction tracking for compliance
- Error logging with structured format
- Deployment history via GitHub Actions

---

## Cost Estimation

### Monthly Azure Costs (Production)

| Service | Tier | Estimated Cost (USD) |
|---------|------|---------------------|
| Container Apps (Backend) | Consumption | $15 - $30 |
| Container Apps (AI OCR) | Consumption | $20 - $50 |
| Azure Container Registry | Basic | $5 |
| Supabase (Pro Plan) | Pro | $25 |
| Azure Document Intelligence | Pay-per-use | $10 - $50 (depends on volume) |
| Azure Monitor + Grafana | Free tier | $0 - $10 |
| **Total** | | **$75 - $170/month** |

*Note: Costs scale with usage. Consumption-based pricing means you pay only for resources used.*

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance budget checks passed
- [ ] Database migrations tested on staging
- [ ] Environment variables configured in Azure
- [ ] Secrets stored in Key Vault
- [ ] Docker images built and scanned for vulnerabilities

### Deployment
- [ ] Images pushed to ACR
- [ ] Container Apps updated with new revisions
- [ ] Health checks passing on all services
- [ ] Frontend deployment successful
- [ ] DNS records updated (if applicable)

### Post-Deployment
- [ ] Integration tests passing against production
- [ ] Grafana dashboards showing healthy metrics
- [ ] No error alerts in first 15 minutes
- [ ] PWA installable and functional on mobile
- [ ] Push notifications working
- [ ] Realtime slot updates verified

---

## Useful Commands

### Local Development
```bash
# Start all services locally
cd backend && uvicorn app.main:app --reload --port 8000
cd ai_service && uvicorn app.main:app --reload --port 8001
cd frontend && npm run dev

# Run database migrations
cd backend && alembic upgrade head

# Run tests
./run_tests.sh

# Run benchmarks
./run_benchmarks.sh
```

### Docker
```bash
# Build and run with Docker Compose
cd backend && docker-compose up --build

# Build backend image
docker build -t medora-backend:latest ./backend

# Build AI OCR image
docker build -t medora-ai-ocr:latest ./ai_service
```

### Azure Deployment
```bash
# Login to Azure
az login

# View container app status
az containerapp show --name medora-backend --resource-group medora-rg

# View logs
az containerapp logs show --name medora-backend --resource-group medora-rg

# Restart container app
az containerapp restart --name medora-backend --resource-group medora-rg

# Rollback to previous revision
az containerapp revision copy \
  --name medora-backend \
  --resource-group medora-rg \
  --revision <revision-name>
```

---

## Troubleshooting

### Common Issues

**Issue**: Backend health check failing  
**Solution**: Check database connectivity, environment variables, and container logs

**Issue**: AI OCR timeout  
**Solution**: Increase container memory, check Azure OCR endpoint availability, verify YOLO model path

**Issue**: Frontend PWA not updating  
**Solution**: Clear service worker cache, hard refresh, check CDN cache invalidation

**Issue**: Realtime slot updates not working  
**Solution**: Verify Supabase realtime enabled, check websocket connection in browser dev tools, ensure RLS policies allow subscription

**Issue**: Push notifications not delivered  
**Solution**: Verify VAPID keys match frontend/backend, check push subscription status, ensure HTTPS in production

---

## Future Deployment Improvements

1. **Blue-Green Deployment**: Zero-downtime deployments with traffic switching
2. **Canary Releases**: Gradual rollout to subset of users
3. **Database Migration Automation**: Separate migration pipeline with approval gates
4. **Feature Flags**: Toggle features without code deployment
5. **Multi-Environment Support**: Dev, staging, production environments
6. **Automated Rollback**: Trigger rollback on health check failure
7. **Infrastructure as Code**: Terraform/Bicep for reproducible infrastructure
8. **Disaster Recovery Drills**: Regular backup restore testing
