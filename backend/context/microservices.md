# 🧠 FINAL SYSTEM ARCHITECTURE

```
Users
   ↓
Azure Container Apps
   │
   ├── Backend Service (FastAPI Core)
   │
   ├── AI Service (OCR + Qwen + Groq fallback)
   │
   └── STT Service (faster-whisper-small)
   
Supabase
   ├── Postgres DB
   └── Object Storage (images, audio)
```

Azure = Compute layer
Supabase = Data layer

Clean separation.

---

# 🏗 1️⃣ NEW PROJECT STRUCTURE

Your current `/backend` is monolithic. We split into 3 services.

```
medora/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── db/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── ai_service/
│   ├── app/
│   │   ├── ocr/
│   │   ├── qwen/
│   │   ├── mapping/
│   │   ├── routes.py
│   │   └── main.py
│   ├── models/
│   ├── Dockerfile
│   └── requirements.txt
│
├── stt_service/
│   ├── app/
│   │   ├── transcriber.py
│   │   ├── routes.py
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
│
└── docker-compose.yml
```

---

# 🔹 WHAT STAYS IN BACKEND

Backend becomes **lightweight orchestrator**.

Keep:

* Auth
* RBAC
* Supabase DB interaction
* Supabase Storage upload
* Calendar sync
* Appointments
* Doctor ranking logic
* Creating AI/STT jobs

Remove from backend:

* faster-whisper
* OCR
* Qwen
* Groq calls
* Any heavy inference

Backend should NEVER load ML models.

---

# 🔹 AI SERVICE (Heavy Compute)

This service handles:

### Prescription Pipeline

* Fetch image from Supabase Storage
* OCR (Paddle / TrOCR)
* Qwen 0.6B LoRA Adapter (Prescription)
* Medicine mapping (70k dataset)
* Confidence scoring
* Groq fallback if low confidence
* Return structured JSON

### Doctor Search Pipeline

* Qwen 0.6B LoRA Adapter (Specialty mapping)
* Return specialty labels + confidence

Backend then ranks doctors deterministically.

Endpoints:

```
POST /parse-prescription
POST /doctor-intent
```

---

# 🔹 STT SERVICE

Contains only:

* faster-whisper-small
* int8
* greedy decoding
* max duration cap (e.g., 3 min)

Endpoint:

```
POST /transcribe
```

Flow:

1. Backend stores audio in Supabase
2. Backend sends public/private URL to STT service
3. STT downloads audio
4. Returns transcript
5. Backend stores transcript

---

# 🔁 SERVICE COMMUNICATION FLOW

### Prescription

User → Backend
Backend → Supabase storage
Backend → AI Service
AI → returns JSON
Backend → Save to Supabase DB

---

### Doctor Search

User → Backend
Backend → AI Service
AI → returns specialties
Backend → rank doctors using DB
Backend → return result

---

### Voice

User → Backend
Backend → Supabase storage
Backend → STT service
STT → returns transcript
Backend → Save transcript

---

# 🐳 2️⃣ DOCKER SETUP

Each service has its own Dockerfile.

Example AI Dockerfile:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

Important:

* Download Qwen base + LoRA during build stage
* Do NOT download at runtime

---

# 🧪 3️⃣ LOCAL DEVELOPMENT

Use simple docker-compose:

```yaml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - ai
      - stt

  ai:
    build: ./ai_service
    ports:
      - "8001:8001"

  stt:
    build: ./stt_service
    ports:
      - "8002:8002"
```

Test locally before Azure.

---

# ☁️ 4️⃣ AZURE DEPLOYMENT PLAN

Use:

Azure Container Apps (Consumption Plan)

DO NOT use:

* AKS
* App Service Basic
* VM
* GPU

---

## Backend Container

* 0.5 vCPU
* 1GB RAM
* minReplicas = 0

---

## AI Container

* 1 vCPU
* 2GB RAM
* minReplicas = 0

---

## STT Container

* 1–2 vCPU
* 2–4GB RAM
* minReplicas = 0

Set autoscaling:

* Based on HTTP concurrency

Scale-to-zero prevents idle cost.

---

# 🔐 ENVIRONMENT VARIABLES

Backend:

```
SUPABASE_URL
SUPABASE_KEY
AI_SERVICE_URL
STT_SERVICE_URL
JWT_SECRET
```

AI:

```
GROQ_API_KEY
QWEN_MODEL_PATH
LORA_PATH_PRESCRIPTION
LORA_PATH_SEARCH
```

STT:

```
WHISPER_MODEL=small
```

---

# 💰 COST EXPECTATION (Student Plan)

Low traffic estimate:

Backend: $5–10
AI: $10–20
STT: $10–25
Total: $30–50/month

Your $100 credit lasts ~2 months safely.

---

# 🧠 IMPORTANT PERFORMANCE NOTES

### Qwen 0.6B

* Load base once
* Load LoRA adapters dynamically
* Use temperature=0
* Use max_tokens small
* Force JSON schema

### Whisper

* Use faster-whisper-small
* int8
* greedy decoding
* limit audio duration

---

# 🏁 FINAL CLEAN ARCHITECTURE SUMMARY

You now have:

* Supabase = database + storage
* Azure = compute only
* 3 microservices
* No Kubernetes
* Docker-only workflow
* Scale-to-zero
* Confidence-aware AI fallback
* Research-grade architecture
* Cost-optimized student design

---

# 🎯 What You Should Do Next

1. Split your current backend repo into 3 folders.
2. Remove faster-whisper and AI logic from backend.
3. Create AI service with two LoRA adapters.
4. Create STT service with whisper.
5. Test with docker-compose.
6. Then deploy to Azure Container Apps.

---
