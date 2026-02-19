

# Medora – Medicine Knowledge System PRD

**Status:** MVP-critical, Source of Truth
**Audience:** Backend, Frontend, AI/OCR, Product
**Scope:** Medicine discovery, identity resolution, search, OCR support
**Excludes:** Clinical decision-making, dosage logic, diagnosis

---

## 1. Product Intent (Why this exists)

The Medicine Knowledge System is the **central reference layer** of Medora.

Its purpose is to:

* Allow **patients** to find medicines safely and understand what they are
* Allow **doctors** to reference medicines when prescribing
* Allow Medora to **infer medicines from handwritten prescriptions**
* Serve as the **only source of truth** for medicine identity across the platform

This system **does not give medical advice**.
It provides **structured, human-readable medicine knowledge**.

---

## 2. High-Level System Responsibilities

### What the system MUST do

* Normalize medicine data into canonical identities
* Resolve brand names → generic medicines
* Support fast search and autocomplete
* Support OCR fuzzy matching
* Provide safe, neutral medicine summaries
* Support patient medication history linking

### What the system MUST NOT do

* Suggest dosage
* Infer diagnosis
* Recommend medicines
* Replace doctor judgment

---

## 3. Canonical Data Model (AUTHORITATIVE)

This is the **final schema** up to Step 8.
All application features depend on this.

---

### 3.1 `drugs` — Canonical Medicine Identity

**Purpose:** Defines *what a medicine is*, independent of brand.

**One row = one unique medicine identity**

```sql
drugs
-----
id uuid PRIMARY KEY
drug_key text UNIQUE NOT NULL
generic_name text NOT NULL
strength text NOT NULL
dosage_form text NOT NULL
common_uses text
common_uses_disclaimer text
created_at timestamptz
```

**Key rules**

* `drug_key = generic_name + strength + dosage_form`
* Immutable after creation
* Never edited by users
* All other tables reference this

**Example**

```
generic_name: paracetamol
strength: 500 mg
dosage_form: tablet
```

---

### 3.2 `brands` — Commercial / Prescribed Names

**Purpose:** Represents *what doctors actually write* and *what OCR sees*.

```sql
brands
------
id uuid PRIMARY KEY
brand_name text NOT NULL
manufacturer text
medicine_type text
drug_id uuid REFERENCES drugs(id)
created_at timestamptz
```

**Rules**

* Many brands → one drug
* Brand names are not globally unique
* Brand + drug combination is unique logically

---

### 3.3 `medicine_search_index` — Search & OCR Accelerator

**Purpose:** Fast, fuzzy lookup for search and OCR.

```sql
medicine_search_index
---------------------
id uuid PRIMARY KEY
term text NOT NULL
drug_id uuid REFERENCES drugs(id)
brand_id uuid REFERENCES brands(id) NULL
```

**Usage**

* Generic names → `drug_id`
* Brand names → `brand_id + drug_id`
* Used for:

  * search
  * autocomplete
  * OCR matching

---

## 4. Functional Overview (End to End)

---

### 4.1 Find Medicine (Patient-Facing)

**Primary goal:**
Allow users to safely search and understand medicines.

#### User actions

* Search by brand or generic
* View medicine details
* Add medicine to profile (current or past)

#### Data flow

```
Search input
 → medicine_search_index
 → drug_id (+ brand_id)
 → drugs + brands
```

---

### 4.2 OCR Prescription Inference (Doctor / System)

**Primary goal:**
Assist doctors and patients in understanding handwritten prescriptions.

#### Data flow

```
Handwritten prescription
 → OCR text
 → search_index match
 → drug_id + brand_id
 → confidence score
```

**Important**

* OCR result is an *inference*
* Stored with confidence
* Human review always possible

---

### 4.3 Patient Medication Linking (Welfare)

**Primary goal:**
Track what medicines a patient has taken or is taking.

* Patient selects medicine from search
* Medicine stored by `drug_id` (and optionally `brand_id`)
* Enables:

  * history
  * continuity
  * future alerts

---

## 5. Frontend: Find Medicine Page (DETAILED)

This is where your PRD was previously incomplete.

---

### 5.1 Page Purpose

**Find Medicine Page** helps users:

* Discover medicines
* Understand them at a high level
* Avoid confusion and misinformation

---

### 5.2 Page Structure (shadcn/ui Friendly)

#### 1. Search Bar

* Large input
* Placeholder: “Search medicine by name or brand”
* Debounced search (300–500ms)
* Uses `medicine_search_index`

**Component ideas**

* `Input`
* `Command`
* `Popover`
* `MagnifyingGlassIcon`

---

#### 2. Search Results List

Each result card shows:

* **Brand name** (primary, bold)
* **Generic name**
* **Strength**
* **Dosage form**
* **Medicine type icon**

**Icons (example mapping)**

* Tablet → pill icon
* Syrup → bottle icon
* Injection → syringe icon

(shadcn-compatible SVG icons or Lucide icons)

---

#### 3. Medicine Detail Drawer / Page

When a medicine is selected:

**Show**

* Brand name
* Generic name
* Strength
* Dosage form
* Medicine type
* Common uses (neutral text)
* Disclaimer (always visible)

**Do NOT show**

* Dosage instructions
* Frequency
* Disease claims

**Components**

* `Card`
* `Badge`
* `Separator`
* `Alert` (for disclaimer)

---

#### 4. Actions

* “Add to current medications”
* “Add to past medications”

These actions:

* Store only `drug_id` (+ optional `brand_id`)
* Do not store free text

---

## 6. Backend Contract (FastAPI)

### Search endpoint (example)

```
GET /api/medicines/search?q=para
```

Returns:

* list of `{ drug_id, brand_id, display_name, type }`

### Medicine detail endpoint

```
GET /api/medicines/{drug_id}
```

Returns:

* generic_name
* strength
* dosage_form
* common_uses
* disclaimer
* brands[]

---

## 7. Non-Goals (Explicit Guardrails)

This system will NOT:

* Recommend medicines
* Suggest dosage
* Diagnose conditions
* Replace doctors
* Rank medicines by effectiveness

These are **explicitly out of scope**.

---

## 8. Why This Design Works for Medora

* Clean separation of identity vs usage
* OCR-friendly
* Patient-safe
* Frontend-friendly
* Scales without refactor
* Easy to enrich later (interactions, alerts, etc.)

---

## 9. Completion Criteria (Up to Step 8)

This PRD is considered implemented when:

* `drugs`, `brands`, `medicine_search_index` exist and are populated
* Find Medicine page works end-to-end
* OCR can resolve medicines with confidence
* No UI exposes medical advice

---

## Final Note (Important)

This PRD is intentionally **boring, strict, and disciplined**.

That is exactly what medicine-related systems must be.



# Medora – Find Medicine UI & Search Intelligence PRD

**Scope:** Component-level UI + Search ranking & typo tolerance
**Stack:** Next.js (App Router), shadcn/ui, Supabase, FastAPI
**Audience:** Frontend, Backend, AI/OCR
**Status:** MVP-critical

---

## PART A — COMPONENT-LEVEL UI SPECIFICATION

---

## A1. Page: `FindMedicinePage`

### Purpose

Allow users (patients + doctors) to:

* Search medicines by brand or generic
* Understand medicine identity safely
* Select medicines for profile or prescription workflows

---

### Layout Structure

```
<PageContainer>
  <FindMedicineHeader />
  <MedicineSearchInput />
  <MedicineSearchResults />
  <MedicineDetailDrawer /> (lazy-loaded)
</PageContainer>
```

---

## A2. `FindMedicineHeader`

### Purpose

Contextual clarity + trust

### Content

* Page title: **“Find Medicine”**
* Subtitle: “Search medicines by brand or generic name”
* Optional info tooltip: “Information only. Always follow your doctor’s advice.”

### UI

* `Heading`
* `Text`
* `InfoIcon` (Lucide)

---

## A3. `MedicineSearchInput`

### Purpose

Primary interaction point

### Behavior

* Debounced input (300–500ms)
* Triggers backend search API
* Shows loading state
* Keyboard accessible

### Component Stack

* `Input`
* `Command` (shadcn)
* `Popover`

### UX Rules

* Placeholder: `Search by medicine name or brand`
* Minimum 2 characters before search
* Show “No results found” state

### States

* Idle
* Loading (spinner)
* Results
* Empty

---

## A4. `MedicineSearchResults`

### Purpose

Show ranked, scannable medicine results

### Structure

```
<ResultList>
  <MedicineResultCard />
  <MedicineResultCard />
  ...
</ResultList>
```

---

## A5. `MedicineResultCard`

### Purpose

Allow fast recognition without cognitive overload

### Display Priority (Top → Bottom)

1. **Brand Name** (bold, large)
2. Generic name
3. Strength + dosage form
4. Medicine type icon
5. Confidence badge (if OCR flow)

### UI Elements

* `Card`
* `Badge`
* `Icon`
* `Text`

### Medicine Type → Icon Mapping

| medicine_type | Icon    |
| ------------- | ------- |
| Tablet        | Pill    |
| Syrup         | Bottle  |
| Injection     | Syringe |
| Capsule       | Capsule |
| Drop          | Droplet |

(Use Lucide icons or custom SVGs)

---

## A6. `MedicineDetailDrawer`

### Purpose

Safe, informative medicine explanation

### Trigger

* Click on result card

### Content Sections

1. **Identity**

   * Brand name
   * Generic name
   * Strength
   * Dosage form

2. **Common Uses**

   * Neutral, non-prescriptive text
   * Always followed by disclaimer

3. **Actions**

   * Add to “Current Medications”
   * Add to “Past Medications”

### UI Components

* `Drawer`
* `Separator`
* `Alert` (for disclaimer)
* `Button`

### Disclaimer (Always Visible)

> “This information is for general awareness only and does not replace professional medical advice.”

---

## A7. Accessibility & UX Rules (Non-Negotiable)

* Full keyboard navigation
* ARIA labels on search input
* High contrast for medicine names
* Icons must have text fallback
* No red/green meaning dependency

---

## PART B — SEARCH RANKING & TYPO-TOLERANCE DESIGN

This section is **critical** for:

* User trust
* OCR accuracy
* Perceived intelligence of Medora

---

## B1. Search Data Source

All searches operate on:

```
medicine_search_index
---------------------
term
drug_id
brand_id
```

---

## B2. Search Intent Types

You must handle **three distinct intents**:

1. Exact brand match
2. Exact generic match
3. Approximate / typo / OCR noise

---

## B3. Ranking Priority Rules (MVP)

### Rank results in this order:

#### Priority 1 — Exact Brand Match

* `term = query`
* Highest confidence
* Most user-expected

#### Priority 2 — Exact Generic Match

* `term = query`
* Slightly lower than brand

#### Priority 3 — Prefix Match

* `term ILIKE 'query%'`

#### Priority 4 — Fuzzy Match

* Typo-tolerant
* OCR-friendly

---

## B4. Typo Tolerance (Supabase / Postgres)

### Enable `pg_trgm`

```sql
create extension if not exists pg_trgm;
```

---

### Trigram Index (Required)

```sql
create index on medicine_search_index
using gin (term gin_trgm_ops);
```

---

### Search Query Pattern (Backend)

```sql
select
  term,
  drug_id,
  brand_id,
  similarity(term, :query) as score
from medicine_search_index
where term % :query
order by
  (term = :query) desc,
  (brand_id is not null) desc,
  score desc
limit 20;
```

---

## B5. OCR-Specific Enhancements

OCR introduces:

* spelling noise
* broken words
* partial matches

### OCR Ranking Boost Rules

If request source = OCR:

* Lower similarity threshold
* Boost brand matches
* Return confidence score

Example:

```
confidence = similarity_score × source_weight
```

---

## B6. Result Deduplication Rule

Multiple search terms may map to same drug.

### Rule

* Group results by `drug_id`
* Prefer brand-linked result if available
* Never show same medicine twice

---

## B7. Empty & Ambiguous States

### No Results

* Show: “No matching medicine found”
* Suggest: “Try generic name”

### Multiple Close Matches

* Show top 5
* Let user choose
* Do NOT auto-select

---

## B8. Performance Targets (MVP)

* Search response < 200ms
* First results visible < 300ms
* No blocking UI

---

## B9. Explicit Non-Goals (Search)

Search will NOT:

* Rank by effectiveness
* Suggest alternatives
* Infer diseases
* Recommend dosage

---

## FINAL SUMMARY

### What you now have

* Fully specified UI components
* Safe, scalable search logic
* OCR-ready matching
* Frontend-backend contract clarity

### What this enables

* Fast medicine discovery
* High trust UX
* Clean Copilot code generation
* Zero medical overreach

---
