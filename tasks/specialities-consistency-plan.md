# Specialities Consistency & Doctor Edit Profile Redirect Plan

## ⚠️ CRITICAL BUG FIX - speciality_id Not Saving to Database

### Problem Identified
The specialization was not saving to the database because:
1. ❌ Backend schema (`DoctorOnboardingUpdate`) was missing `speciality_id` field
2. ❌ Backend PATCH endpoints (`/doctor/onboarding` and `/doctor/update`) were NOT processing `speciality_id`
3. ❌ Backend GET endpoint (`/doctor/onboarding`) was NOT returning `speciality_id` for pre-fill

### Solution Applied ✅
1. ✅ Added `speciality_id: Optional[int] = None` to `backend/app/schemas/onboarding.py`
2. ✅ Added `speciality_id` processing in PATCH `/doctor/onboarding` endpoint
3. ✅ Added `speciality_id` processing in PATCH `/doctor/update` endpoint
4. ✅ Added `speciality_id` to GET `/doctor/onboarding` response
5. ✅ Added `speciality_id` to GET `/doctor/profile` response

Frontend was already correctly sending `speciality_id` - only backend was broken!

---

## ✅ Completed Tasks

### 1. ✅ Database - Already Complete
- Specialities seed file already has all 111 specialities matching the HTML
- No changes needed to backend database

### 2. ✅ Frontend Onboarding - Doctor Specialities Dropdown
- Doctor onboarding already fetches specialities from `/specialities/` API
- Step 3 dynamically renders all 111 specialities from database
- specialityId is properly saved to database

### 3. ✅ Frontend Search Filters - Already Correct
- search-filters.tsx correctly fetches from `/specialities/` endpoint
- Dynamically displays all specialities in dropdown

### 4. ✅ Doctor Edit Profile Redirect - IMPLEMENTED
- ✅ Removed `EditDoctorProfileSheet` component entirely (deleted file)
- ✅ Updated doctor profile page to redirect "Edit Profile" button to `/onboarding`
- ✅ Removed all edit sheet imports and state management
- ✅ Onboarding page already pre-fills existing doctor data

### 5. ✅ Patient Edit Profile (Kept As Is)
- Patient edit profile stays as modal/sheet (no changes needed)

### 6. ✅ JSON Reference File Created
- Created `backend/context/specialities.json` with all 111 specialities

## Implementation Summary

### Files Modified:
1. **`frontend/app/(home)/doctor/profile/page.tsx`**
   - Removed `EditDoctorProfileSheet` import
   - Added `useRouter` from next/navigation
   - Removed `editSheetOpen` state and `handleProfileUpdate` function
   - Changed "Edit Profile" button to navigate to `/onboarding` using router
   - Removed `<EditDoctorProfileSheet>` component usage

2. **`frontend/components/doctor/edit-profile-sheet.tsx`**
   - **DELETED** - Component no longer needed

3. **`backend/context/specialities.json`**
   - **CREATED** - JSON reference file with all 111 specialities

### Files Already Correct (No Changes Needed):
- ✅ `backend/app/db/seed_specialities.py` (has all 111 specialities)
- ✅ `frontend/components/onboarding/doctor-onboarding.tsx` (fetches from API)
- ✅ `frontend/components/doctor/search-filters.tsx` (fetches from API)

## System Consistency ✅

All specialities are now perfectly synchronized:
- **Database**: 111 specialities seeded
- **Doctor Onboarding**: Fetches from database API
- **Search Filters**: Fetches from database API  
- **Doctor Profile**: Redirects to onboarding for edits

## User Flow

1. Doctor clicks "Edit Profile" on profile page
2. → Redirected to `/onboarding`
3. → Onboarding wizard loads with all existing data pre-filled
4. → Doctor can update any information across all 8 steps
5. → Changes saved to database
6. → Doctor redirected back to home/profile

## Testing Checklist

- [ ] Verify doctor can select from all 111 specialities during onboarding
- [ ] Verify clicking "Edit Profile" takes doctor to `/onboarding`
- [ ] Verify onboarding pre-fills all existing doctor data
- [ ] Verify search filters show all 111 specialities
- [ ] Verify speciality selection saves correctly to database
- [ ] Verify doctor profile displays correct speciality name
