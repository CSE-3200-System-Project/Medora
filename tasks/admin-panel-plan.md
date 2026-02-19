# Admin Panel Implementation Plan

## Backend Features (FastAPI)

### Already Exists
- `/admin/pending-doctors` - Get pending doctor verifications
- `/admin/verify-doctor/{doctor_id}` - Approve/reject doctors
- `/admin/doctors` - Get all doctors
- `/admin/stats` - Basic platform stats

###  To Create
- `/admin/dashboard` - Enhanced dashboard with comprehensive stats
- `/admin/patients` - Patient management endpoints
- `/admin/patients/{id}` - Get specific patient details
- `/admin/appointments` - View all appointments
- `/admin/analytics` - Advanced analytics data
- `/admin/system-logs` - Audit logs

## Frontend Features (Next.js)

### Structure
```
frontend/app/(admin)/
   layout.tsx (Admin-specific layout with dark theme)
   admin/
      dashboard/
         page.tsx (Dashboard overview)
      doctors/
         page.tsx (Doctor list & verification)
         [id]/
             page.tsx (Doctor detail view)
      patients/
         page.tsx (Patient list)
         [id]/
             page.tsx (Patient detail view)
      appointments/
         page.tsx (Appointment oversight)
      analytics/
          page.tsx (Analytics & reports)
```

### Components
- `components/admin/admin-navbar.tsx` - Dark themed admin navbar
- `components/admin/stats-card.tsx` - Reusable stats display
- `components/admin/doctor-verification-modal.tsx` - Verification interface
- `components/admin/data-table.tsx` - Reusable data table
- `lib/admin-actions.ts` - Server actions for admin

### Color Theme (Dark & Bold)
Based on existing theme but darker:
- Background: `#0A1929` (very dark blue)
- Surface: `#1E3A5F` (dark blue)
- Primary: `#2196F3` (brighter blue)
- Accent: `#FFB74D` (amber for highlights)
- Success: `#4CAF50` (bright green)
- Warning: `#FF9800` (orange)
- Danger: `#F44336` (red)

## Implementation Order
1. Expand backend admin routes
2. Create admin frontend routing structure
3. Build admin navbar (dark theme)
4. Implement dashboard page
5. Implement doctor verification interface
6. Implement patient management
7. Add route protection
