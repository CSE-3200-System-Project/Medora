# **PRODUCT REQUIREMENTS DOCUMENT (PRD)**

## **Project: MEDORA**

### **Scope: FRONTEND (Web – Next.js 16)**

**Last Updated:** January 13, 2026  
**Status:** Active Development with Core Features Implemented  
**Version:** 1.0 (Implementation-Aligned)

---

## EXECUTIVE SUMMARY

Medora frontend is a **production-ready healthcare web application** built with Next.js 15, React 19, TypeScript, and Tailwind CSS. It implements:

* ✅ **Landing Page** (hero, features, CTA, doctor/patient differentiation)
* ✅ **Authentication** (signup, login, logout, email verification, role selection)
* ✅ **Patient Onboarding** (8-step wizard with mobile-first UI, comprehensive medical history)
* ✅ **Doctor Onboarding** (8-step wizard for professional credentials and practice info)
* ✅ **Doctor Discovery** (search, filter, AI-powered recommendations, detail pages)
* ✅ **Appointment Management** (booking, history, status tracking)
* ✅ **Patient Dashboard** (profile, medical records, doctor access control)
* ✅ **Doctor Dashboard** (search patients, view appointments, manage profile)
* ✅ **Admin Portal** (doctor verification, pending doctor approval)
* ✅ **Mobile-First Responsive Design** (works on all screen sizes)
* ✅ **Theme System** (CSS variables, doctor blue primary color, comprehensive color palette)
* ✅ **shadcn/ui Components** (buttons, cards, forms, modals, dropdowns)

---

## 1. PRODUCT VISION

### 1.1 Frontend Mission

The Medora frontend is the **user-facing gateway** to healthcare data management.

It must:

* Enable **structured data entry**, not free-text chaos
* Make **patient history instantly readable** for doctors
* Highlight **generic-centric medication intelligence**
* Enforce **privacy, consent, and access control visually**
* Support **longitudinal timelines** (not snapshots)
* Be **mobile-first responsive** across all devices
* Scale for future **AI, OCR, CV, and research modules**
* **Never diagnose** or make medical decisions
* **Never display confusing language** that suggests clinical authority

### 1.2 Global Frontend Principles (Non-Negotiable)

**Tone:**
* Calm and medical
* Minimal visual noise
* No gamification or flashy effects
* Professional, serious, trustworthy

**Data Philosophy:**
* Structured > free text
* Generic drug > brand
* Timeline > single record
* Explicit consent > implicit access
* Medical data clearly labeled and explained

**Safety:**
* ❌ No diagnosis language (never "you have X")
* ❌ No autonomous medical decisions
* ❌ No confusing disclaimers (clear, upfront explanations)
* ✅ Clear disclaimers everywhere medical content appears

---

## 2. USER ROLES & PERSONAS

### 2.1 Patient

* **Owns** their medical data
* **Controls** who can see what information
* **Completes** 8-step onboarding wizard
* **Views** and edits their medical profile
* **Searches** for doctors by specialty
* **Books** appointments
* **Tracks** appointment history
* **Manages** documents and records

### 2.2 Doctor

* **Searches** for patients by unique ID
* **Views** patient medical profiles
* **Completes** 8-step professional credentials onboarding
* **Manages** appointments with patients
* **Updates** their practice information
* **Gets verified** by admin before full access

### 2.3 Admin

* **Verifies** doctor credentials
* **Approves** or rejects doctor registrations
* **Views** pending doctors for review
* **Manages** platform operations

---

## 3. DESIGN SYSTEM & THEME

### 3.1 CSS Theme Variables (globals.css)

```css
:root {
  /* Background & Surface */
  --surface: #E6F5FC;              /* Light blue background */
  --background: #FFFFFF;            /* Pure white */
  --foreground: #2E2E2E;            /* Dark gray text */

  /* Primary Color (Doctor Blue) */
  --primary: #0360D9;               /* Vibrant medical blue */
  --primary-muted: #1379B1;         /* Muted blue */
  --primary-light: #A5CCFF;         /* Light blue */
  --primary-more-light: #E1EEFF;    /* Very light blue */
  --primary-foreground: #FFFFFF;    /* White text on blue */

  /* Accent & Secondary */
  --accent: #E1EEFF;                /* Light blue accent */
  --accent-foreground: #0360D9;     /* Dark text on accent */
  --secondary: #E1EEFF;
  --secondary-foreground: #0360D9;

  /* Status Colors */
  --success: rgb(57, 224, 57);      /* Green */
  --success-muted: #047857;
  --destructive: oklch(0.577 0.245 27.325);  /* Red */
  --destructive-muted: #B91C1C;

  /* UI Elements */
  --border: #D9D9D9;                /* Light gray border */
  --input: #D9D9D9;                 /* Input border */
  --ring: #0360D9;                  /* Focus ring (primary blue) */
  --radius: 0.625rem;               /* 10px border radius */

  /* Text */
  --muted-foreground: #A8A8A8;      /* Light gray text */
}
```

### 3.2 Using Theme Colors in Tailwind

```tsx
// ✅ CORRECT - Use theme variables
className="bg-primary text-primary-foreground"
className="bg-surface text-foreground"
className="border-border"
className="text-muted-foreground"

// ❌ WRONG - Hardcoded colors
className="bg-blue-500"
className="text-gray-600"
```

### 3.3 Button Variants (shadcn/ui)

```tsx
<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### 3.4 Component Library (shadcn/ui)

Available components in `frontend/components/ui/`:
- `button.tsx` - With custom medical, transaction, emergency variants
- `card.tsx` - Customized with rounded-2xl for Medora style
- `input.tsx`, `label.tsx`, `textarea.tsx`
- `select-native.tsx`, `radio-group-native.tsx`
- `checkbox.tsx`, `accordion.tsx`, `tabs.tsx`
- `dropdown-menu.tsx`, `navigation-menu.tsx`
- `sheet.tsx` (mobile drawer)
- `avatar.tsx`, `navbar.tsx`
- `separator.tsx`

---

## 4. MOBILE-FIRST RESPONSIVE DESIGN

### 4.1 Design Principles

* **Always start with mobile** - Mobile styles are base, add responsive modifiers
* **Breakpoints** (Tailwind):
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
  - `2xl`: 1536px
* **Touch targets** - Minimum 44x44px for all interactive elements
* **Font sizes** - Start with readable mobile sizes (16px base)

### 4.2 Responsive Component Pattern

```tsx
// Mobile first: single column, stack vertically
// Tablet: two columns, side-by-side
// Desktop: full layout with spacing

<div className="
  flex flex-col gap-4           // Mobile: stack vertically
  md:flex-row md:gap-6          // Tablet: side by side
  lg:gap-8                       // Desktop: more spacing
">
  {/* Content */}
</div>

// Grid example
<div className="
  grid grid-cols-1 gap-4        // Mobile: 1 column
  sm:grid-cols-2                // Small: 2 columns
  lg:grid-cols-3                // Large: 3 columns
  xl:grid-cols-4                // XL: 4 columns
">
```

---

## 5. INFORMATION ARCHITECTURE

### 5.1 Complete Site Map

```
PUBLIC
├── /                              Landing page (hero, features)
├── /(auth)/login                  Login form
├── /(auth)/selection              Role selection (Patient / Doctor)
├── /(auth)/patient/signup         Patient registration
├── /(auth)/doctor/signup          Doctor registration
├── /(auth)/forgot-password        Password reset
├── /(auth)/logout                 Logout confirmation

PATIENT AUTHENTICATED
├── /(onboarding)/onboarding/patient   8-step wizard
├── /(home)/patient/home               Dashboard
├── /(home)/patient/profile            View/edit profile
├── /(home)/patient/appointments       Appointment history
├── /(home)/patient/find-doctor        Doctor search & discovery
├── /(home)/patient/doctor/{id}        Doctor detail page
├── /(home)/patient/appointment-success Booking confirmation

DOCTOR AUTHENTICATED
├── /(onboarding)/onboarding/doctor    8-step wizard
├── /(home)/doctor/home                Dashboard
├── /(home)/doctor/appointments        Appointment history
├── /(home)/doctor/profile             View/edit profile

ADMIN AUTHENTICATED
├── /admin/dashboard                   Verification dashboard
├── /admin/verify-pending              Pending doctor approval
├── /admin/clear-admin                 Admin login/logout

POST-AUTH ROUTING
├── /(onboarding)/verify-email         Email verification prompt
├── /(onboarding)/verification-success Success confirmation
├── /(onboarding)/verify-pending       Doctor awaiting BMDC verification
```

---

## 6. AUTHENTICATION FLOW & PAGES

### 6.1 Landing Page (`/`)

**Components:**
- Responsive navbar (home, login links)
- Hero slideshow (patient/doctor toggle, background images)
- Feature cards (structured data, doctor matching, privacy)
- CTA buttons (Sign up as Patient / Doctor)
- Footer with links

**Responsive:**
- Mobile: Single column, full-width images, stacked buttons
- Desktop: Two-column layout, side-by-side images

### 6.2 Role Selection (`/(auth)/selection`)

**Purpose:** User selects Patient or Doctor role  
**Components:**
- Two large card buttons
- Icon + description for each role
- Clear benefits/explanation for each path

### 6.3 Patient Signup (`/(auth)/patient/signup`)

**Fields:**
- First name, Last name
- Email (validated)
- Password (strong validation)
- Confirm password
- Phone number
- Date of birth (date picker)
- Gender (radio: Male/Female/Other)
- Blood group (select)
- Allergies (text area)
- Terms acceptance checkbox
- Privacy notice checkbox

**Behavior:**
- Client-side validation with Zod
- POST to `/auth/signup/patient`
- On success: Creates account, redirects to email verification
- Error handling: Shows specific error messages

### 6.4 Doctor Signup (`/(auth)/doctor/signup`)

**Fields:**
- First name, Last name
- Email (validated)
- Password
- Confirm password
- Phone number
- BMDC number (required, must be unique)
- BMDC document (file upload button)
- Terms acceptance

**Behavior:**
- Validates BMDC number format
- File upload to `/upload/`
- On success: Redirects to pending verification page
- Status: "Awaiting admin verification (24-48 hours)"

### 6.5 Login (`/(auth)/login`)

**Fields:**
- Email
- Password
- "Remember me" checkbox (for 7-day session)

**Behavior:**
- POST to `/auth/login`
- Checks email verification (redirects to `/verify-email` if not verified)
- Checks doctor verification (redirects to `/verify-pending` if doctor not verified)
- Checks onboarding completion (redirects to `/onboarding/{role}` if not completed)
- On success: Redirects to role-specific home (`/patient/home` or `/doctor/home`)

### 6.6 Email Verification (`/(onboarding)/verify-email`)

**Purpose:** User must confirm email before accessing main features  
**Components:**
- Email address display
- Resend confirmation email button
- "Email verified" check and redirect on completion
- Auto-redirect when email is verified

### 6.7 Doctor Pending Verification (`/(onboarding)/verify-pending`)

**Purpose:** Doctor awaits admin approval of BMDC credentials  
**Components:**
- Status message: "Your BMDC credentials are under review"
- Expected timeline: "24-48 hours"
- What happens next explanation
- Contact support link
- Auto-redirect when verified

### 6.8 Verification Success (`/(onboarding)/verification-success`)

**Purpose:** Confirmation page after successful verification  
**Components:**
- Success icon/message
- Redirect to onboarding after 3 seconds

---

## 7. PATIENT ONBOARDING (8-Step Wizard)

### 7.1 Wizard Structure

**Shared Components:**
- Progress indicator (showing step X of 8)
- Step title and description
- Form fields for current step
- Previous / Next buttons
- Save progress indicator

**Animations:**
- Smooth slide transition between steps (Framer Motion)
- Loading state when saving
- Error messages with field highlighting

### 7.2 Step 1: Personal Identity

**Fields:**
- First name, Last name (pre-filled from signup)
- Date of birth (date picker)
- Gender (radio: Male/Female/Other)
- Profile photo (upload button with preview)
- NID number (text, optional)

**Validation:**
- All required except NID

### 7.3 Step 2: Physical & Address

**Fields:**
- Height (cm, number input)
- Weight (kg, number input)
- Blood group (select dropdown)
- Address (textarea)
- City (text)
- District (text, Bangladesh-specific)
- Postal code (text)
- Country (select, default: Bangladesh)
- Marital status (select: Single/Married/Divorced/Widowed)
- Occupation (text)

### 7.4 Step 3: Chronic Conditions

**Layout:**
- Checkbox grid for common conditions (2-3 columns)
- Free-text area for "Other conditions"
- Free-text area for "Condition details"

**Checkboxes:**
- Diabetes, Hypertension, Heart Disease, Asthma
- Kidney Disease, Liver Disease, Thyroid, Neurological
- Cancer, Arthritis, Stroke, Epilepsy, Mental Health

### 7.5 Step 4: Medications & Allergies

**Current Medications:**
- Add button to create medication entries
- For each entry: Name, Dosage, Frequency (select), Duration, Prescribed by (text)
- Delete button for each entry

**Drug Allergies:**
- Add button for allergy entries
- For each entry: Drug name, Reaction, Severity (select: Mild/Moderate/Severe)
- Delete button

**Other Allergies:**
- Food allergies (textarea)
- Environmental allergies (textarea)

### 7.6 Step 5: Medical History

**Surgeries:**
- Add button to create surgery entries
- For each: Name, Date, Hospital, Reason, Document upload (optional)
- Delete button

**Hospitalizations:**
- Add button for hospitalization entries
- For each: Reason, Hospital, Date, Duration (days)
- Delete button

**Other:**
- Previous doctors (textarea)
- Last checkup date (date picker)
- Ongoing treatment details (textarea)

### 7.7 Step 6: Family History

**Layout:**
- Checkbox grid for family medical history
- Free-text area for notes

**Checkboxes:**
- Diabetes, Hypertension, Heart Disease, Cancer, Stroke
- Asthma, Thalassemia, Blood Disorders, Mental Health
- Kidney Disease, Thyroid Disorders

### 7.8 Step 7: Lifestyle & Mental Health

**Substance Use:**
- Smoking status (select: Never/Former/Current)
- Smoking amount (text, e.g., "1 pack/day")
- Alcohol use (select: Never/Occasional/Frequent)
- Alcohol details (textarea)
- Tobacco use (select: None/Paan/Jorda/Other)
- Drug use (select: No/Past/Current)
- Caffeine (select: None/Low/Moderate/High)

**Physical Activity:**
- Activity level (select: Sedentary/Moderate/Active/Very Active)
- Exercise type (text)
- Exercise frequency (text)

**Sleep & Stress:**
- Sleep duration (text, e.g., "8 hours")
- Sleep quality (select: Good/Fair/Poor)
- Stress level (select: Low/Moderate/High)
- Water intake (text, e.g., "8 glasses")

**Diet:**
- Diet type (select: Omnivore/Vegetarian/Vegan/Other)
- Dietary restrictions (textarea)

**Mental Health:**
- Mental health concerns (textarea)
- Currently in therapy (checkbox)

**Vaccinations:**
- Add button for vaccination entries
- For each: Vaccine name, Date received, Next due date
- Pre-filled common vaccines: EPI, COVID, Hepatitis, TB, TT

### 7.9 Step 8: Preferences & Consent

**Languages:**
- Add button for language entries
- For each: Select language from dropdown

**Contact Preferences:**
- Preferred contact method (select: Phone/Email/SMS/WhatsApp)

**Emergency Contacts:**
- Primary: Name, Relation, Phone, Address
- Secondary: Name, Phone (optional)

**Notification Preferences:**
- Checkboxes: Appointments, Medications, Health Tips, Doctor Updates

**Consent Flags:**
- "I consent to data storage on Medora" (checkbox)
- "I consent to AI assistance" (checkbox)
- "I consent to doctor access to my data" (checkbox)
- "I consent to research use" (checkbox)

**Submit:**
- Submit button saves all data
- On success: Redirects to patient home with success message

---

## 8. DOCTOR ONBOARDING (8-Step Wizard)

Similar structure to patient wizard with professional-specific fields:

**Step 1:** Title, Gender, DOB, NID, Profile photo  
**Step 2:** BMDC number, BMDC document, Qualifications, Degree certificates  
**Step 3:** Primary specialization (select), Sub-specializations (add), Services offered (add)  
**Step 4:** Years of experience, Work history (add entries)  
**Step 5:** Hospital info, Chamber info, Affiliation letter, Consultation mode  
**Step 6:** Fees, Visiting hours, Available days, Appointment duration, Telemedicine platforms  
**Step 7:** Professional bio/about (textarea)  
**Step 8:** Languages, AI preference, Terms acceptance  

---

## 9. PATIENT DASHBOARD

### 9.1 Home Page (`/patient/home`)

**Components:**
- Welcome banner with patient name
- Quick stats cards:
  - Active medications count
  - Upcoming appointments count
  - Last checkup date
  - Recent doctors accessed profile

- Navigation sidebar or mobile menu with:
  - Profile
  - Find Doctor
  - Appointments
  - Settings

- Quick access buttons for common actions

### 9.2 Patient Profile (`/patient/profile`)

**Sections** (read-only display with edit buttons):
1. **Personal Information** - Name, DOB, Gender, Contact
2. **Medical Summary** - Chronic conditions overview
3. **Current Medications** - Table: Drug name, Dosage, Frequency
4. **Allergies** - Drug allergies, food allergies
5. **Medical History** - Surgeries, hospitalizations summary
6. **Emergency Contacts** - Primary and secondary

**Edit Profile Button:**
- Opens sheet/modal with form fields
- Allows partial updates
- Auto-save with validation
- Success/error messages

### 9.3 Find Doctor (`/patient/find-doctor`)

**Layout:**
- Search bar (text input) at top
- Filter sidebar or collapsible filters on mobile:
  - Specialty dropdown
  - City/location input
  - Consultation mode (online/in-person/both)
  - Doctor gender (optional)

- Doctor results grid:
  - Doctor card with: Name, Title, Specialization, Hospital, Consultation fee
  - Rating (if implemented)
  - View Profile button → Opens detail page

### 9.4 Doctor Detail Page (`/patient/doctor/{id}`)

**Left Column (Doctor Info):**
- Profile photo
- Name, Title, Qualifications
- Years of experience
- Specializations
- Languages spoken

**Right Column (Practice Info):**
- Hospital/Chamber name and address
- Consultation fees (consultation + follow-up)
- Consultation mode
- Visiting hours
- Available appointment slots

**Bottom:**
- Professional bio/about section
- Book Appointment button → Opens booking form

**Booking Form Modal:**
- Select appointment date (date picker)
- Select appointment time (time picker showing available slots)
- Reason for appointment (textarea)
- Additional notes (textarea)
- Book button

**On Success:**
- Shows confirmation page
- Displays appointment ID and details
- Redirect to appointments list

### 9.5 Appointments (`/patient/appointments`)

**Table/List View:**
- Columns: Doctor name, Date, Time, Reason, Status
- Status badges: PENDING (yellow), CONFIRMED (green), COMPLETED (gray), CANCELLED (red)

**Actions:**
- Cancel button for PENDING appointments
- Confirmation before cancellation

**Empty State:**
- "No appointments yet" message
- CTA to find a doctor

---

## 10. DOCTOR DASHBOARD

### 10.1 Home Page (`/doctor/home`)

**Components:**
- Welcome banner with doctor name
- Quick stats:
  - Appointments this week
  - Pending appointment requests
  - Last appointment date

- Recent appointments widget (upcoming + recent)
- Quick links to:
  - Find patient (search bar)
  - Manage appointments
  - Update profile

### 10.2 Patient Search (`/doctor/find-patient`)

**Search Form:**
- Patient ID input (required)
- Search button

**Behavior:**
- POST to backend with patient ID
- Shows patient profile if found
- "No patient found" message if not found
- Privacy notice: "Patient data is confidential"

**Patient Profile (Doctor View):**
- Medical summary
- Current medications
- Allergies (highlighted for safety)
- Medical history
- Family history
- Lifestyle information
- Recent appointments with you

### 10.3 Appointments (`/doctor/appointments`)

**Table/List View:**
- Columns: Patient name, Date, Time, Reason, Status
- Status badges

**Actions:**
- Confirm appointment (PENDING → CONFIRMED)
- Complete appointment (CONFIRMED → COMPLETED)
- Cancel appointment

**Modal for Actions:**
- Confirmation before status change
- Optional notes field
- Save button

### 10.4 Doctor Profile (`/doctor/profile`)

**Display:**
- Professional credentials (read-only)
- Practice information (read-only)
- Specializations

**Edit Profile Button:**
- Opens form to update:
  - Visiting hours
  - Consultation fees
  - Available days
  - Emergency contact
  - About/bio

---

## 11. ADMIN PORTAL

### 11.1 Admin Login

**Authentication:**
- Admin password header (for Phase 1, will be upgraded)
- Redirects to `/admin/dashboard` on success

### 11.2 Verify Pending Doctors (`/admin/verify-pending`)

**Table:**
- Columns: Doctor name, Email, Phone, BMDC number, Specialization, Created date
- Row actions: View Details button

**Detail Modal:**
- Doctor information
- BMDC document (view/download link)
- Education history
- Approve / Reject buttons

**Approve:**
- Sets verification_status = VERIFIED
- Doctor can now book appointments

**Reject:**
- Sets verification_status = REJECTED
- Shows reason text area
- Doctor cannot use platform

### 11.3 Admin Dashboard (`/admin/dashboard`)

**Widgets:**
- Pending doctors count
- Total doctors count
- Total patients count
- Platform statistics

**Quick Actions:**
- Review pending doctors button
- View all doctors button

---

## 12. IMPLEMENTATION STATUS

### Completed Features ✅

* Landing page (hero, features, CTA)
* Authentication flows (signup, login, logout)
* Role selection
* Email verification flow
* Patient onboarding wizard (8 steps)
* Doctor onboarding wizard (8 steps)
* Patient dashboard and profile
* Doctor search and filter
* Doctor detail pages
* Appointment booking
* Appointment history/management
* Doctor dashboard
* Admin verification portal
* Mobile-responsive design
* Theme system with CSS variables
* shadcn/ui component integration
* Form validation with Zod
* Server actions for backend communication
- Framer Motion animations on onboarding

### Partial/Future Implementations ⏳

* Patient-doctor messaging/chat
* Real-time notifications (email/SMS)
* Prescription management
* Medical document storage/OCR
* Wound tracking with images
* Advanced filtering and sorting
* Rating/review system
* Payment integration
* Analytics dashboard
* Multi-language support
* Accessibility improvements (WCAG)
* Dark mode support

---

## 13. TECHNOLOGY STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16, React 19 | SSR, routing, components |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| UI Components | shadcn/ui | Pre-built accessible components |
| Forms | React Hook Form + Zod | Form handling and validation |
| Animation | Framer Motion 12 | Smooth transitions |
| Icons | Lucide React | SVG icons |
| State | React hooks (useContext, useState) | Client-side state |
| Backend Comms | Next.js server actions | Secure API calls |
| Authentication | Supabase Auth (JWT) | User authentication |
| Storage | Supabase Storage | File uploads |
| Dev Tools | TypeScript, ESLint | Code quality |

---

## 14. FILE STRUCTURE

```
frontend/
├── app/
│   ├── (admin)/
│   │   ├── admin/
│   │   ├── clear-admin/
│   │   └── verify-pending/
│   ├── (auth)/
│   │   ├── auth/
│   │   ├── doctor/
│   │   ├── patient/
│   │   ├── login/
│   │   ├── selection/
│   │   ├── logout/
│   │   └── forgot-password/
│   ├── (home)/
│   │   ├── doctor/
│   │   └── patient/
│   ├── (onboarding)/
│   │   ├── onboarding/
│   │   ├── verify-email/
│   │   ├── verify-pending/
│   │   └── verification-success/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx (landing)
│
├── components/
│   ├── admin/
│   │   ├── admin-navbar.tsx
│   │   └── admin-notifications.tsx
│   ├── doctor/
│   │   ├── doctor-card.tsx
│   │   ├── doctor-information-section.tsx
│   │   ├── doctor-navbar.tsx
│   │   ├── search-filters.tsx
│   │   └── appointment-booking-panel.tsx
│   ├── onboarding/
│   │   ├── patient-onboarding.tsx
│   │   ├── doctor-onboarding.tsx
│   │   ├── step-indicator.tsx
│   │   └── onboarding-banner.tsx
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── checkbox.tsx
│       ├── navbar.tsx
│       └── ... (20+ shadcn/ui components)
│
├── lib/
│   ├── auth-actions.ts (server actions)
│   ├── appointment-actions.ts (server actions)
│   ├── admin-actions.ts (server actions)
│   └── utils.ts (cn(), validators, helpers)
│
├── middleware.ts (route protection)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## 15. KEY FEATURES & FLOWS

### 15.1 Patient Signup → Home Flow

```
1. User lands on /
2. Clicks "Sign up as Patient"
3. Fills patient signup form → /auth/patient
4. Backend creates Supabase user + Profile + PatientProfile
5. Redirects to verify-email (awaits email confirmation)
6. User clicks email link → Email verified
7. Redirects to /onboarding/patient (8-step wizard)
8. Completes wizard → onboarding_completed = true
9. Redirects to /patient/home
```

### 15.2 Doctor Signup → Verification → Home Flow

```
1. Clicks "Sign up as Doctor"
2. Fills doctor signup form → /auth/doctor
3. Backend creates user with verification_status = pending
4. Redirects to /verify-pending (awaits admin approval)
5. Admin reviews BMDC docs → /admin/verify-pending
6. Admin approves → verification_status = verified
7. Doctor logs in → Redirected to /onboarding/doctor
8. Completes wizard → onboarding_completed = true
9. Redirects to /doctor/home
```

### 15.3 Patient Finds Doctor → Books Appointment

```
1. Patient on /patient/find-doctor
2. Searches by specialty or text
3. Clicks doctor card
4. Views doctor detail page (/patient/doctor/{id})
5. Clicks "Book Appointment"
6. Selects date, time, reason
7. Submits form (POST to /appointment/)
8. Gets confirmation → /appointment-success
9. Appointment appears in /patient/appointments
```

---

## 16. FORM VALIDATION

### Zod Schemas (in `lib/utils.ts` or separate file)

```typescript
// Patient signup validation
const PatientSignupSchema = z.object({
  first_name: z.string().min(1, "First name required"),
  last_name: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be 8+ characters"),
  phone: z.string().min(10, "Valid phone required"),
  date_of_birth: z.string().refine(d => new Date(d) < new Date(), "DOB must be in past"),
  // ... other fields
});

// Onboarding field validation
const MedicationSchema = z.object({
  name: z.string().min(1, "Medication name required"),
  dosage: z.string(),
  frequency: z.string(),
  // ...
});
```

---

## 17. ERROR HANDLING

### Strategy

* **Client-side:** Zod validation with field-level error messages
* **Server-side:** Catch errors in server actions, return error object
* **User feedback:**
  - Toast notifications for errors (can be implemented with Sonner or similar)
  - Inline field errors below form inputs
  - Error pages for 404/500 errors

### Example Error Response

```typescript
// Server action returns
{
  error: "Medication name is required",
  field: "medications[0].name"
}

// Frontend displays:
<p className="text-destructive text-sm">Medication name is required</p>
```

---

## 18. MOBILE-FIRST IMPLEMENTATION CHECKLIST

- ✅ All touch targets ≥ 44x44px
- ✅ Readable font sizes on mobile (16px base)
- ✅ Single column on mobile, multi-column on tablet/desktop
- ✅ Full-width on mobile, constrained on desktop
- ✅ Hamburger menu on mobile, full nav on desktop
- ✅ Tap-friendly buttons and inputs
- ✅ Responsive images (next/image with sizes)
- ✅ Responsive modals (full screen on mobile, centered on desktop)

---

## 19. SUCCESS METRICS

* ✅ Patient can complete signup → onboarding → book appointment in < 5 minutes
* ✅ Doctor can complete signup → verification → view patients in < 2 minutes
* ✅ All forms validate correctly on client and server
* ✅ Mobile-responsive on all screen sizes
* ✅ API response times < 500ms (patient feel smooth, fast)
* ✅ No layout shifts (CLS minimized)
* ✅ Dark mode ready (CSS variables scalable)
* ✅ Accessibility score > 90 (future improvement)

---

## 20. GUIDING PRINCIPLES

> **The frontend exists to guide users through medical data entry safely and clearly.**

1. **Clarity** - Never confuse with medical jargon
2. **Completeness** - Capture all necessary medical data
3. **Simplicity** - One thing per screen/section
4. **Privacy** - Visually emphasize data ownership
5. **Mobile-First** - Works on all devices equally well
6. **Responsiveness** - Smooth, snappy interactions
7. **Accessibility** - Usable by everyone, including those with disabilities

---

## 21. FUTURE FEATURES (Phase 2+)

* Real-time notifications
* Doctor-patient messaging
* Prescription management
* Wound image tracking
* OCR for document upload
* Advanced reporting
* Payment integration
* Mobile app (React Native)
* Dark mode
* Multi-language support (Bangla, English, Arabic)
- Analytics dashboard

---

### **END OF FRONTEND PRD**
