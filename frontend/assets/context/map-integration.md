Below is a **full, implementation-ready Product Requirements Document (PRD)** for **ditching Google Maps** and using **MapLibre + mapcn + OpenStreetMap (Nominatim)** with **doctor-friendly location input**.


# PRD

## Feature: Doctor Location Mapping (Non-Google, MapLibre-Based)

### Version

v1.0

### Status

Approved for Implementation

### Owner

Engineering

---

## 1. Objective

Enable doctors to enter clinic or chamber locations in **plain human language** and automatically:

* Convert the text location into latitude and longitude
* Render an interactive map with a marker
* Avoid Google Maps and Google APIs entirely
* Use open-source and vendor-neutral mapping tools

The system must be:

* Simple for doctors
* Accurate for Bangladeshi locations
* Scalable for future features (distance search, nearby doctors)

---

## 2. Non-Goals

* No manual coordinate input by doctors
* No Google Maps or Google Geocoding
* No paid map APIs in MVP
* No real-time navigation or routing

---

## 3. Tech Stack (Mandatory)

### Frontend

* React / Next.js
* **mapcn** (shadcn-based MapLibre wrapper)
* MapLibre GL JS

### Backend

* FastAPI
* OpenStreetMap **Nominatim** (Geocoding API)
* PostgreSQL (or Supabase)

### Mapping Data

* Map Style: MapLibre compatible (OSM tiles)

---

## 4. User Personas

### Primary

Doctor

* Non-technical
* Wants fast setup
* Types locations as they would on Google

### Secondary

Patient

* Views doctor location on a map
* Clicks marker to see address

---

## 5. User Flow

### Doctor Flow

1. Doctor opens profile setup
2. Enters location in plain text
3. Saves profile
4. System auto-generates map marker

### Patient Flow

1. Patient views doctor profile
2. Map loads centered on doctor’s location
3. Marker shows clinic info

---

## 6. Functional Requirements

### FR-1: Text-Based Location Input

* Single text input field
* Accepts:

  * Hospital name
  * Area
  * City
  * Country (optional)

**Example Inputs**

* “Aalok Healthcare Ltd, Mirpur 10, Dhaka”
* “Popular Diagnostic Centre, Kushtia”
* “Apollo Hospital, Chittagong”

---

### FR-2: Backend Geocoding Service

* All geocoding MUST happen on backend
* Frontend never calls geocoding APIs directly

**Endpoint**

```
POST /api/geocode
```

**Request**

```json
{
  "location_text": "Aalok Healthcare Ltd, Mirpur 10, Dhaka"
}
```

**Response**

```json
{
  "latitude": 23.806975,
  "longitude": 90.366458,
  "display_name": "Mirpur-10, Dhaka, Bangladesh"
}
```

---

### FR-3: Geocoding Provider

* Use OpenStreetMap **Nominatim**
* Must send a custom User-Agent
* Must limit results to 1 (best match)

**API**

```
https://nominatim.openstreetmap.org/search
```

---

### FR-4: Database Schema

Store **both raw text and coordinates**.

```sql
doctor_locations (
  id UUID PRIMARY KEY,
  doctor_id UUID,
  location_text TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  display_name TEXT,
  geocoded_at TIMESTAMP
)
```

---

### FR-5: Caching Strategy

* If the same `location_text` already exists:

  * Reuse stored coordinates
  * Do not re-call Nominatim

---

### FR-6: Map Rendering (Frontend)

* Use **mapcn** component
* Use MapLibre-compatible style
* Center map on doctor coordinates
* Place a marker

**Initial Zoom**

* Default: 14–15

---

### FR-7: Marker Behavior

* Marker visible by default
* Tooltip on click:

  * Doctor name
  * Clinic name
  * Address

---

### FR-8: Error Handling

| Scenario            | Behavior                  |
| ------------------- | ------------------------- |
| No geocoding result | Show “Location not found” |
| Ambiguous location  | Pick best match           |
| API failure         | Show retry message        |
| Empty input         | Block submission          |

---

## 7. Frontend UX Requirements

### Doctor Profile Form

**Field**

```
Clinic Location *
[____________________________]
```

**Helper Text**

```
Example: Apollo Hospital, Dhanmondi, Dhaka
```

---

### Map Preview (After Save)

* Map loads only after successful geocoding
* Read-only map for doctors
* Editable in future versions

---

## 8. API Contracts

### POST /api/geocode

* Rate limited
* Validates input length (min 5 chars)

---

### POST /api/doctor/location

```json
{
  "doctor_id": "uuid",
  "location_text": "Apollo Hospital, Dhanmondi, Dhaka"
}
```

Backend:

1. Geocodes
2. Stores location
3. Returns coordinates

---

## 9. Security & Compliance

* No API keys exposed
* User-Agent required for Nominatim
* Rate limiting enabled
* Input sanitization required

---

## 10. Performance Requirements

* Geocoding response < 800ms average
* Cached results < 50ms
* Map load < 1.5s

---

## 11. Future Enhancements (Out of Scope)

* Autocomplete suggestions
* Manual pin drag
* Distance-based doctor search
* Reverse geocoding
* Offline maps

---

## 12. Acceptance Criteria

* Doctor enters plain text location
* Coordinates are auto-generated
* Map renders correctly without Google Maps
* Marker appears at correct position
* No Google APIs used anywhere

---

## 13. Copilot Implementation Notes (Important)

* Separate geocoding logic into service layer
* Never hardcode map tiles
* Use environment-based map styles
* Write reusable map component
* Keep map rendering stateless

---

## 14. Summary

This feature replaces Google Maps entirely with an **open, privacy-safe, cost-free mapping system** using:

* MapLibre
* mapcn
* OpenStreetMap Nominatim

Doctors get a **Google-like experience** without Google.

