# Multi-Type Prescription Implementation

## Overview
Implemented support for doctors to prescribe multiple types (medications, tests, and procedures) within a single prescription session. Previously, only one type could be active at a time, and switching tabs would clear the data.

## Changes Made

### 1. Backend Changes

#### File: `backend/app/routes/consultation.py`

**Validation Update (Lines ~565-575)**
- **Before**: Required that only ONE type (medication, test, OR surgery) be present based on the prescription type
- **After**: Validates that AT LEAST ONE item exists across ALL types
- This allows mixing medications, tests, and procedures in a single prescription

```python
# OLD - Single type validation
if data.type == PrescriptionType.MEDICATION and (not data.medications or len(data.medications) == 0):
    raise HTTPException(status_code=400, detail="Medication prescription requires at least one medication")

# NEW - Multi-type validation
has_medications = data.medications and len(data.medications) > 0
has_tests = data.tests and len(data.tests) > 0
has_surgeries = data.surgeries and len(data.surgeries) > 0

if not (has_medications or has_tests or has_surgeries):
    raise HTTPException(
        status_code=400,
        detail="Prescription must include at least one medication, test, or procedure"
    )
```

**Notification Update (Lines ~670-710)**
- **Before**: Notification showed a single type (e.g., "New Medication Prescription")
- **After**: Notification dynamically lists all included items (e.g., "3 medication(s), 2 test(s)")
- Provides better context to patients about what was prescribed

```python
# Build dynamic notification message
prescription_items = []
if data.medications and len(data.medications) > 0:
    prescription_items.append(f"{len(data.medications)} medication(s)")
if data.tests and len(data.tests) > 0:
    prescription_items.append(f"{len(data.tests)} test(s)")
if data.surgeries and len(data.surgeries) > 0:
    prescription_items.append(f"{len(data.surgeries)} procedure(s)")

items_text = ", ".join(prescription_items)
# Message: "Dr. Smith has prescribed 2 medication(s), 1 test(s). Please review and accept."
```

### 2. Frontend Changes

#### File: `frontend/app/(home)/doctor/patient/[id]/consultation/page.tsx`

**State Management**
- State variables (`medications`, `tests`, `surgeries`) now persist across tab switches
- No longer clears state when changing between Medications/Tests/Procedures tabs

**Validation Update (handleAddPrescription function)**
- **Before**: Validated only the active tab's data
- **After**: Validates ALL types that have items
- Checks that at least one item exists across all types

```typescript
// NEW - Multi-type validation
const hasMedications = medications.length > 0;
const hasTests = tests.length > 0;
const hasSurgeries = surgeries.length > 0;

if (!hasMedications && !hasTests && !hasSurgeries) {
  setError("Please add at least one medication, test, or procedure");
  return;
}

// Validate each type independently if it has items
if (hasMedications) {
  for (const med of medications) {
    if (!med.medicine_name.trim()) {
      setError("Medicine name is required for all medications");
      return;
    }
    // ... other validations
  }
}
```

**Submission Logic**
- **Before**: Sent only the active tab's data
- **After**: Sends ALL types with data in a single request

```typescript
await addPrescription(consultation.id, {
  type: prescriptionType, // Keep for backward compatibility
  notes: prescriptionNotes,
  medications: hasMedications ? medications : undefined,
  tests: hasTests ? tests : undefined,
  surgeries: hasSurgeries ? surgeries : undefined,
});
```

**Form Clearing**
- After successful submission, ALL forms are cleared (medications, tests, surgeries)
- Previously only cleared the active tab's form

#### File: `frontend/components/prescription/PrescriptionReview.tsx`

**Display Logic Update**
- **Before**: Only showed the active tab's preview
- **After**: Shows ALL types that have items, regardless of active tab

```typescript
// OLD - Only show active type
const hasContent = 
  (type === "medication" && medications.length > 0) ||
  (type === "test" && tests.length > 0) ||
  (type === "surgery" && surgeries.length > 0);

// NEW - Show all types with items
const hasMedications = medications.length > 0;
const hasTests = tests.length > 0;
const hasSurgeries = surgeries.length > 0;
const hasContent = hasMedications || hasTests || hasSurgeries;

// Render sections independently
{hasMedications && (<MedicationsCard />)}
{hasTests && (<TestsCard />)}
{hasSurgeries && (<SurgeriesCard />)}
```

## User Experience Improvements

### For Doctors
1. **Seamless Workflow**: Can add medications on one tab, tests on another, and procedures on a third without losing data
2. **Complete Preview**: See everything they've prescribed in the preview section before submitting
3. **Flexible Prescribing**: Can prescribe any combination (only meds, only tests, all three, etc.)
4. **Better Validation**: Clear error messages for each type of item

### For Patients
1. **Clear Notifications**: Immediately notified with exact details (e.g., "2 medication(s), 1 test(s)")
2. **Complete Picture**: Can see all prescribed items in one place
3. **Single Action**: Accept or decline the entire prescription (not separate items)

## Technical Benefits

1. **Data Integrity**: All prescription items are linked to the same prescription ID
2. **Atomic Operations**: Single database transaction for all items
3. **Backward Compatible**: Existing single-type prescriptions still work
4. **Consistent State**: Frontend state management prevents data loss during tab switches

## Testing Checklist

- [x] Backend validates multi-type prescriptions
- [x] Backend creates notification with all item types
- [x] Frontend persists state across tab switches
- [x] Frontend validates all types before submission
- [x] Frontend preview shows all types
- [ ] End-to-end test: Add meds → switch to tests → add test → preview shows both → submit
- [ ] Patient receives notification with correct item count
- [ ] Patient can view all items in prescription detail
- [ ] Accepting prescription adds all medications to medical history
- [ ] Doctor receives acceptance notification

## Database Impact

**No schema changes required!** The database already supported this:
- `Prescription` table has a `type` field (kept for backward compatibility)
- `MedicationPrescription`, `TestPrescription`, `SurgeryRecommendation` tables all link to `prescription_id`
- A single prescription can already have multiple rows in each related table

## API Changes

### Endpoint: `POST /consultation/{consultation_id}/prescription`

**Request Body (unchanged schema, usage changed)**
```json
{
  "type": "medication",  // Still required but becomes less meaningful
  "notes": "Patient needs comprehensive care",
  "medications": [
    {
      "medicine_name": "Paracetamol",
      "dose_morning": true,
      "duration_value": 7,
      "duration_unit": "days"
    }
  ],
  "tests": [
    {
      "test_name": "Complete Blood Count",
      "urgency": "normal"
    }
  ],
  "surgeries": []  // Can be omitted or empty
}
```

**Validation**
- ✅ At least one of `medications`, `tests`, or `surgeries` must have items
- ✅ All provided items are validated according to their schema
- ✅ Empty arrays are allowed for types not being prescribed

## Future Enhancements

1. **Remove `type` field**: Since we now support multi-type, the `type` field is less meaningful. Could be deprecated.
2. **Prescription Templates**: Allow doctors to save common prescription combinations
3. **Partial Acceptance**: Allow patients to accept some items and decline others
4. **Item-Level Notes**: Add notes to individual medications/tests/procedures

## Rollback Plan

If issues arise, revert these files to previous state:
1. `backend/app/routes/consultation.py` (lines 565-710)
2. `frontend/app/(home)/doctor/patient/[id]/consultation/page.tsx` (handleAddPrescription function)
3. `frontend/components/prescription/PrescriptionReview.tsx` (hasContent logic and render conditions)

No database migrations needed for rollback.
