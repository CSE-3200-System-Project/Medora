# Medora - AI Coding Agent Instructions

## HIGH PRIORITY RULES (READ FIRST)

> **These rules are NON-NEGOTIABLE and apply to EVERY task.**

### Claude Rules

1. **PLAN FIRST**: Think through the problem, read the codebase for relevant files, and write a plan to `tasks/todo.md`.
2. **TODO TRACKING**: The plan should have a list of todo items that you can check off as you complete them.
3. **VERIFY BEFORE WORK**: Before you begin working, check in with me and I will verify the plan.
4. **MARK PROGRESS**: Begin working on the todo items, marking them as complete as you go.
5. **HIGH-LEVEL EXPLANATIONS**: Every step of the way just give a high-level explanation of what changes you made.
6. **SIMPLICITY IS KEY**: Make every task and code change as simple as possible. Avoid massive or complex changes. Every change should impact as little code as possible. **Everything is about simplicity.**
7. **REVIEW SECTION**: Add a review section to the `todo.md` file with a summary of the changes you made and any other relevant information.
8. **NO LAZINESS**: DO NOT BE LAZY. NEVER BE LAZY. IF THERE IS A BUG FIND THE ROOT CAUSE AND FIX IT. NO TEMPORARY FIXES. YOU ARE A SENIOR DEVELOPER. NEVER BE LAZY.
9. **MINIMAL IMPACT**: MAKE ALL FIXES AND CODE CHANGES AS SIMPLE AS HUMANLY POSSIBLE. THEY SHOULD ONLY IMPACT NECESSARY CODE RELEVANT TO THE TASK AND NOTHING ELSE. IT SHOULD IMPACT AS LITTLE CODE AS POSSIBLE. YOUR GOAL IS TO NOT INTRODUCE ANY BUGS. IT'S ALL ABOUT SIMPLICITY.

### Reference Documents
- **Backend PRD**: `backend/context/backend-prd.md`
- **Doctor-Search PRD**: `backend/context/doctor-search-prd.md`
- **Frontend PRD**: `frontend/assets/context/app-prd.md`
- **Medicine Knowledge PRD**: `backend/context/medicine-knowledge.md`

---

## Project Overview

Medora is a **healthcare platform** for Bangladesh enabling structured patient medical history management, doctor verification, and AI-assisted care. Built with **Next.js 15 frontend** + **FastAPI backend** + **Supabase** (auth & PostgreSQL).

**Critical Constraint**: This is a medical platform - never generate code that diagnoses, prescribes, or makes autonomous medical decisions.

---

## Architecture

### Monorepo Structure
```
/backend     - FastAPI + SQLAlchemy async + Alembic migrations
/frontend    - Next.js 15 App Router + Tailwind CSS + shadcn/ui
```

### Three User Roles (RBAC)
| Role | Description |
|------|-------------|
| **Patient** | Owns medical data, completes 8-step onboarding wizard |
| **Doctor** | Requires BMDC verification before accessing patient data |
| **Admin** | Verifies doctors, manages platform |

### Data Flow
1. Frontend uses **server actions** in `lib/auth-actions.ts` (NOT API routes)
2. Backend authenticates via Supabase JWT → `get_current_user_token`
3. Database models in `backend/app/db/models/` use async SQLAlchemy

---

## Mobile-First Responsive UI (FIRST PRIORITY)

> **All UI must be designed mobile-first, then scale up to larger screens.**

### Breakpoint Strategy
```tsx
// Always start with mobile styles, then add responsive modifiers
className="
  flex flex-col gap-4           // Mobile: stack vertically
  md:flex-row md:gap-6          // Tablet: side by side
  lg:gap-8                      // Desktop: more spacing
"
```

### Mobile-First Guidelines
1. **Touch targets**: Minimum 44x44px for all interactive elements
2. **Font sizes**: Start with readable mobile sizes (16px base)
3. **Spacing**: Use compact spacing on mobile, expand for larger screens
4. **Navigation**: Hamburger menu on mobile, full nav on desktop
5. **Forms**: Single-column on mobile, can expand to multi-column on desktop
6. **Cards**: Full-width on mobile, grid layout on desktop

### Responsive Component Example
```tsx
<div className="
  grid grid-cols-1 gap-4        // Mobile: single column
  sm:grid-cols-2                // Small: 2 columns
  lg:grid-cols-3                // Large: 3 columns
  xl:grid-cols-4                // XL: 4 columns
">
```

---

## Theme System & Dynamic Colors

### CSS Variables (from `globals.css`) 
```css
:root {
  /* Background & Surface */
  --surface: #E6F5FC;
  --background: #FFFFFF;
  --foreground: #2E2E2E;
  --foreground-muted: #A8A8A8;

  /* Primary Doctor Blue */
  --primary: #0360D9;
  --primary-muted: #1379B1;
  --primary-light: #A5CCFF;
  --primary-more-light: #E1EEFF;

  /* Accent & Secondary */
  --accent: #E1EEFF;
  --accent-foreground: #0360D9;
  --secondary: #E1EEFF;
  --secondary-foreground: #0360D9;

  /* Status Colors */
  --success: rgb(57, 224, 57);
  --success-muted: #047857;
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-muted: #B91C1C;

  /* Borders & UI */
  --border: #D9D9D9;
  --input: #D9D9D9;
  --ring: #0360D9;
  --radius: 0.625rem;
}
```

### Using Theme Colors in Tailwind
```tsx
// CORRECT - Use theme variables
className="bg-primary text-primary-foreground"
className="bg-surface text-foreground"
className="border-border"
className="text-muted-foreground"

// WRONG - Hardcoded colors
className="bg-blue-500"
className="text-gray-600"
```

---

## shadcn/ui Components

### Available Components (`frontend/components/ui/`)
- `button.tsx` - With custom variants (medical, transaction, emergency)
- `card.tsx` - Customized with rounded-2xl for Medora style
- `input.tsx`, `label.tsx`, `textarea.tsx`
- `select-native.tsx`, `radio-group-native.tsx`
- `checkbox.tsx`, `accordion.tsx`, `tabs.tsx`
- `dropdown-menu.tsx`, `navigation-menu.tsx`
- `sheet.tsx` (mobile drawer), `separator.tsx`
- `avatar.tsx`, `navbar.tsx`

### Button Variants
```tsx
import { Button } from "@/components/ui/button"

// Standard variants
<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link Style</Button>
<Button variant="destructive">Delete</Button>

// Custom Medora variants
<Button variant="medical">Medical Action</Button>      // Primary blue with shadow
<Button variant="transaction">Complete</Button>        // Success green
<Button variant="emergency">Emergency</Button>         // Red alert

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Card Pattern
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Title Here</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Creating New Components
When creating new UI components:
1. Use `cva` (class-variance-authority) for variants
2. Follow the `data-slot` pattern for styling hooks
3. Use `cn()` utility for class merging
4. Accept `className` prop for customization

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        success: "bg-success text-white",
        warning: "bg-yellow-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  )
}
```

---

## 8-Step Patient Onboarding Wizard

### Step Structure
| Step | Title | Fields |
|------|-------|--------|
| 1 | Personal Identity | firstName, lastName, dob, gender, phone, email, nidNumber, maritalStatus, profile_photo_url |
| 2 | Physical & Address | height, weight, bloodGroup, address, district, postalCode, city, country, occupation |
| 3 | Chronic Conditions | hasDiabetes, hasHypertension, hasHeartDisease, hasAsthma, hasCancer, hasThyroid, hasKidneyDisease, hasLiverDisease, hasArthritis, hasStroke, hasEpilepsy, hasMentalHealth, otherConditions |
| 4 | Medications & Allergies | takingMeds, medications[], drugAllergies[], foodAllergies, environmentalAllergies |
| 5 | Medical History | surgeries[], hospitalizations[], ongoingTreatments, vaccinations[], lastCheckupDate |
| 6 | Family History | familyHasDiabetes, familyHasHeartDisease, familyHasCancer, familyHasHypertension, familyHasStroke, familyHasMentalHealth, etc. |
| 7 | Lifestyle & Mental Health | smoking, alcohol, activityLevel, sleepDuration, stressLevel, diet, mentalHealthConcerns |
| 8 | Preferences & Consent | language, notifications, emergencyContact, consentStorage, consentAI, consentDoctor, consentResearch |

### Onboarding Animation Pattern
```tsx
import { motion, AnimatePresence } from "framer-motion"

<AnimatePresence mode="wait">
  <motion.div
    key={currentStep}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3 }}
  >
    {/* Step content */}
  </motion.div>
</AnimatePresence>
```

### Field Naming Convention
```tsx
// Frontend uses camelCase
const formData = {
  firstName: "",
  hasDiabetes: false,
  drugAllergies: [],
}

// Convert to snake_case for backend
const payload = {
  first_name: formData.firstName,
  has_diabetes: formData.hasDiabetes,
  drug_allergies: formData.drugAllergies,
}
```

---

## File Upload Pattern (Supabase Storage)

### Backend Upload Route (`backend/app/routes/upload.py`)
```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from supabase import create_client
import uuid

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_ext = file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_content = await file.read()
        
        bucket_name = "medora-storage"
        
        supabase.storage.from_(bucket_name).upload(
            path=file_name,
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        public_url = supabase.storage.from_(bucket_name).get_public_url(file_name)
        return {"url": public_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
```

### Frontend Upload Handler
```tsx
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
  const file = e.target.files?.[0]
  if (!file) return
  
  const formDataUpload = new FormData()
  formDataUpload.append("file", file)
  
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/upload/`, {
      method: 'POST',
      body: formDataUpload,
    })
    
    if (res.ok) {
      const data = await res.json()
      handleInputChange(field, data.url)
    } else {
      alert("Upload failed")
    }
  } catch (err) {
    console.error("Upload error:", err)
  }
}
```

---

## Backend Conventions (FastAPI)

### Route Structure
```python
# backend/app/routes/profile.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token

router = APIRouter()

@router.patch("/patient/onboarding")
async def update_patient_onboarding(
    data: PatientOnboardingUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update patient profile during onboarding"""
    user_id = user.id
    # Implementation...
```

### Model Pattern (SQLAlchemy 2.0)
```python
from sqlalchemy import Boolean, String, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class PatientProfile(Base):
    __tablename__ = "patient_profiles"
    
    id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), primary_key=True)
    has_diabetes: Mapped[bool] = mapped_column(Boolean, default=False)
    medications: Mapped[list | None] = mapped_column(JSON)  # For arrays
```

### Migration with server_default
```python
# When adding NOT NULL boolean to existing table
op.add_column('patient_profiles', 
    sa.Column('has_diabetes', sa.Boolean(), nullable=False, server_default='false'))
```

---

## Frontend Conventions (Next.js)

### Server Actions Pattern
```typescript
// lib/auth-actions.ts
"use server"

import { cookies } from "next/headers"

async function getAuthHeaders() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session_token")?.value
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  }
}

export async function updatePatientOnboarding(data: any) {
  try {
    const headers = await getAuthHeaders()
    
    const response = await fetch(`${BACKEND_URL}/profile/patient/onboarding`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || "Update failed")
    }

    return await response.json()
  } catch (error) {
    console.error("Onboarding update error:", error)
    throw error
  }
}
```

### Error Handling Pattern
```typescript
try {
  const response = await fetch(url, options)
  
  if (!response.ok) {
    const errorData = await response.json()
    const errorMessage = typeof errorData.detail === 'string' 
      ? errorData.detail 
      : JSON.stringify(errorData.detail)
    throw new Error(errorMessage || "Operation failed")
  }
  
  return await response.json()
} catch (error) {
  console.error("Operation error:", error)
  throw error
}
```

---

## Common Tasks

### Adding a New Field to Onboarding
1. **Model**: Add to `backend/app/db/models/patient.py` or `doctor.py`
2. **Schema**: Add to `backend/app/schemas/onboarding.py`
3. **Route**: Update PATCH + GET in `backend/app/routes/profile.py`
4. **Migration**: `alembic revision --autogenerate -m "Add field"` + `alembic upgrade head`
5. **Frontend**: Update form state + UI + payload conversion (camelCase → snake_case)

### Running the Project
```powershell
# Backend
cd backend; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload

# Frontend
cd frontend; npm run dev
```

### Admin Operations
- Create admin: `UPDATE profiles SET role = 'ADMIN' WHERE email = 'admin@example.com'`
- Admin routes: `/admin/pending-doctors`, `/admin/verify-doctor/{id}`
- Protected by `require_admin` dependency

---

## Reference Files
| Purpose | File |
|---------|------|
| Auth Flow | `frontend/lib/auth-actions.ts`, `backend/app/routes/auth.py` |
| Onboarding | `frontend/components/onboarding/`, `backend/app/routes/profile.py` |
| Enums | `backend/app/db/models/enums.py` |
| Theme | `frontend/app/globals.css` |
| UI Components | `frontend/components/ui/` |

## Common Tasks

### Adding a New Field to Onboarding
1. Add to model: `backend/app/db/models/patient.py` or `doctor.py`
2. Add to schema: `backend/app/schemas/onboarding.py`
3. Add to route handlers: `backend/app/routes/profile.py` (PATCH + GET endpoints)
4. Generate migration: `alembic revision --autogenerate -m "Add field"`
5. Update frontend form state + UI + payload conversion

### Running the Project
```bash
# Backend
cd backend && .\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload

# Frontend  
cd frontend && npm run dev
```

### Admin Operations
- Create admin via SQL: `UPDATE profiles SET role = 'ADMIN' WHERE email = 'admin@example.com'`
- Admin routes: `/admin/pending-doctors`, `/admin/verify-doctor/{id}`
- Protected by `require_admin` dependency

## Reference Files
- PRD context: `backend/context/backend-prd.md`, `frontend/assets/context/app-prd.md`
- Auth flow: `frontend/lib/auth-actions.ts`, `backend/app/routes/auth.py`
- Onboarding: `frontend/components/onboarding/`, `backend/app/routes/profile.py`
- Enums: `backend/app/db/models/enums.py` (UserRole, VerificationStatus)

---

## Frontend Development Best Practices

### Core Principles
- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Favor iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Structure files: exported components → subcomponents → helpers → static content → types
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`)
- Never use emojis anywhere! only use vector icons if needed!

### Next.js Optimization
- **Minimize client-side code**: Reduce `'use client'`, `useEffect`, and `setState`
- **Favor Server Components**: Use React Server Components (RSC) and Next.js SSR features
- **Code splitting**: Implement dynamic imports for optimization
- **Image optimization**: Use WebP format, include size data, lazy loading

### Error Handling
- **Early returns**: Handle error conditions at the start of functions
- **Guard clauses**: Handle preconditions and invalid states early
- **Custom error types**: Use consistent error handling patterns
- **User-friendly messages**: Provide clear feedback to users

```typescript
// Good - Early return with guard clause
async function processPayment(userId: string) {
  if (!userId) {
    throw new Error("User ID is required")
  }
  
  const user = await getUser(userId)
  if (!user) {
    throw new Error("User not found")
  }
  
  // Happy path last
  return await executePayment(user)
}

// Bad - Nested conditions
async function processPayment(userId: string) {
  if (userId) {
    const user = await getUser(userId)
    if (user) {
      return await executePayment(user)
    } else {
      throw new Error("User not found")
    }
  } else {
    throw new Error("User ID is required")
  }
}
```

### State Management
- Use Zustand or TanStack React Query for global state
- Implement Zod for schema validation
- Keep state as local as possible
- Lift state only when necessary

### UI Best Practices
- **Mobile-first**: Always design for mobile, then scale up
- **Consistent patterns**: Use shadcn/ui components with theme variables
- **Responsive design**: Use Tailwind breakpoints (sm, md, lg, xl)
- **Accessibility**: Ensure proper ARIA labels, keyboard navigation, focus states

### Testing & Documentation
- Write unit tests with Jest and React Testing Library
- Use JSDoc for function/component documentation
- Comment complex logic, but prefer self-documenting code
- Test edge cases and error states

### Development Methodology
1. **System 2 Thinking**: Analyze requirements thoroughly before coding
2. **Tree of Thoughts**: Evaluate multiple solutions and select optimal approach
3. **Iterative Refinement**: Review and optimize before finalizing
4. **Deep Dive Analysis**: Understand technical requirements and constraints
5. **Planning**: Outline architectural structure and flow
6. **Implementation**: Build step-by-step following best practices
7. **Review & Optimize**: Check for improvements and edge cases
8. **Finalization**: Ensure code is secure, performant, and meets all requirements

---

## Backend Development Best Practices

### Core Principles
- Write concise, technical responses with accurate Python examples
- Use functional, declarative programming; avoid classes where possible
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., `is_active`, `has_permission`)
- Use lowercase with underscores for directories and files (e.g., `routers/user_routes.py`)
- Favor named exports for routes and utility functions
- Use the Receive an Object, Return an Object (RORO) pattern

### Python/FastAPI Guidelines
- Use `def` for pure functions and `async def` for asynchronous operations
- Use type hints for all function signatures
- Prefer Pydantic models over raw dictionaries for input validation
- File structure: exported router → sub-routes → utilities → static content → types

```python
# Good - Type hints, async, early returns
async def get_user_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db)
) -> UserProfile:
    """Fetch user profile with proper error handling"""
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")
    
    result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile

# Bad - No type hints, nested conditions
def get_user_profile(user_id, db):
    if user_id:
        result = db.execute(select(Profile).where(Profile.id == user_id))
        profile = result.scalar_one_or_none()
        if profile:
            return profile
        else:
            raise HTTPException(status_code=404, detail="Profile not found")
    else:
        raise HTTPException(status_code=400, detail="User ID required")
```

### Error Handling
- **Early returns**: Handle errors at the beginning of functions
- **Guard clauses**: Check preconditions first
- **HTTPException**: Use for expected errors with proper status codes
- **Middleware**: Handle unexpected errors, logging, monitoring
- **Custom error types**: Create consistent error handling patterns

### Performance Optimization
- **Async operations**: Use async functions for all I/O-bound tasks
- **Caching**: Implement Redis or in-memory stores for frequently accessed data
- **Lazy loading**: Use for large datasets and substantial API responses
- **Database optimization**: Use proper indexes, query optimization, connection pooling
- **Pydantic**: Optimize data serialization and deserialization

### Dependencies
- FastAPI
- Pydantic v2
- SQLAlchemy 2.0 (async)
- Async database libraries (asyncpg, aiomysql)
- Alembic for migrations

### FastAPI-Specific Guidelines
- Use functional components (plain functions) and Pydantic models
- Use declarative route definitions with clear return type annotations
- Minimize `@app.on_event()`, prefer lifespan context managers
- Use middleware for logging, error monitoring, performance optimization
- Use dependency injection for managing state and shared resources
- Implement proper request/response validation with Pydantic

### Key Conventions
1. Rely on FastAPI's dependency injection system
2. Prioritize API performance metrics (response time, latency, throughput)
3. Limit blocking operations in routes
4. Favor asynchronous and non-blocking flows
5. Use dedicated async functions for database and external API operations
6. Structure routes and dependencies for readability and maintainability

### Database Patterns (SQLAlchemy 2.0)
```python
# Modern async pattern with type hints
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

async def get_patient_profile(
    patient_id: str,
    db: AsyncSession
) -> Optional[PatientProfile]:
    """Fetch patient profile asynchronously"""
    result = await db.execute(
        select(PatientProfile).where(PatientProfile.id == patient_id)
    )
    return result.scalar_one_or_none()

# Model with proper type annotations
class PatientProfile(Base):
    __tablename__ = "patient_profiles"
    
    id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), primary_key=True)
    has_diabetes: Mapped[bool] = mapped_column(Boolean, default=False)
    medications: Mapped[Optional[list]] = mapped_column(JSON)
```

### Validation with Pydantic v2
```python
from pydantic import BaseModel, Field, validator
from typing import Optional, List

class PatientOnboardingUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    has_diabetes: Optional[bool] = None
    medications: Optional[List[str]] = None
    
    @validator('medications')
    def validate_medications(cls, v):
        if v and len(v) > 50:
            raise ValueError('Too many medications')
        return v
    
    class Config:
        from_attributes = True  # Pydantic v2
```

---

## Integration Summary

### Combined Best Practices
1. **Type Safety**: TypeScript (frontend) + Python type hints (backend)
2. **Async First**: React Server Components + FastAPI async routes
3. **Error Handling**: Early returns, guard clauses, proper HTTP status codes
4. **Performance**: Code splitting, lazy loading, caching, database optimization
5. **Security**: Input validation (Zod/Pydantic), authentication, authorization
6. **Testing**: Unit tests, integration tests, edge case coverage
7. **Documentation**: JSDoc/docstrings, clear comments, self-documenting code
8. **Medical Compliance**: Never generate diagnostic or prescriptive code

### Workflow Pattern
1. **Plan**: Analyze requirements, create todo list in `tasks/todo.md`
2. **Verify**: Confirm approach before implementation
3. **Implement**: Follow best practices, make minimal changes
4. **Test**: Verify functionality, check edge cases
5. **Review**: Document changes, ensure quality
6. **Simplicity**: Always choose the simplest solution that works
