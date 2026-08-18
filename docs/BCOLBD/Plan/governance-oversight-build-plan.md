# Governance & Stewardship Layer — Build Plan

**Working name:** the *stewardship layer* (optional Bengali label: **তত্ত্বাবধান / Tottabodhan** — oversight).
**Status:** proposed / roadmap. A thin slice is buildable for the finalist; the full org model is
post-competition.
**Positioning:** woven into the whitepaper as the PDPO **data-controller accountability layer**,
under Architecture (§5) and Revenue (§9), with a cross-sector hook in Vision (§2). It is **not** a
sixth named artifact — the five-artifact frame stays intact. This layer is the *administrative*
counterpart to আরোহণ: আরোহণ governs what the AI may do; the stewardship layer governs what a human
operator may do, and records it the same way.

---

## 1. Motivation

Three forces make a scoped, auditable admin hierarchy a governance requirement rather than a
convenience feature:

1. **Real deployments are multi-institution.** A hospital chain, a clinic network, and a solo
   chamber cannot share one flat god-mode admin. Oversight must be scoped to *who you are
   accountable for*.
2. **PDPO makes scope legally meaningful.** Under the Personal Data Protection framework, a hospital
   is a **data controller** for its patients. A scoped org-admin is the concrete, auditable boundary
   of that controllership — and every administrative touch of patient data must itself be logged,
   the same discipline already applied to AI reads via `patient_access`.
3. **The cross-sector signal (August 2026).** Bangladesh's Cabinet Division (e-Governance-2 Wing)
   instructed all ministry secretaries to exercise maximum caution with AI tools, warning that
   careless use can leak confidential government data to third-party platforms; Bangladesh Bank
   issued the same warning to the financial sector. Medora's local-first, consent-gated,
   no-data-leaves-the-system architecture *is* the answer that directive asks for. A scoped,
   audited admin layer is what makes the same stack deployable in government and finance, where the
   controller/steward boundary and the audit trail are the whole point.

---

## 2. Current state (verified against code)

| Fact | Location | Consequence |
|---|---|---|
| Roles are flat: `admin / doctor / patient` | `backend/app/db/models/enums.py:3` | No tier, no scope |
| `require_admin_access` = `role == ADMIN` only | `backend/app/routes/admin.py:26` | Guards ~50 endpoints identically |
| Admin already does patient/doctor management | `admin.py` (verify, ban/suspend, review moderation, `PENDING_ADMIN_REVIEW`) | The *actions* exist; only the *scoping* is missing |
| Hospital/clinic = free-text strings | `doctor.py:49-56` (`hospital_name`, `chamber_name`, …) + `doctor_locations` table | **Blocker:** nothing for an admin's authority to bind to |
| Consent-grant object exists | `health_data_consents`, `patient_data_sharing`, `data_sharing_guard.py` | Reuse for delegated/time-boxed admin grants |
| Access-audit tables exist | `patient_access`, `ai_interactions`, `appointment_audit` | Reuse for the audit explorer + patient access timeline |

**Conclusion.** The management *capability* is largely built; what is missing is (a) a first-class
organization entity to scope against, and (b) a scoped authorization model. The org entity is the
critical-path net-new work.

---

## 3. Target design

### 3.1 Admin tiers — authority = scope × permission set

RBAC (permission sets) combined with ABAC (the scoping attribute is affiliation).

| Tier | Scope | Powers |
|---|---|---|
| **Super Admin (central)** | platform | Everything. The *only* tier that can mint other admins, edit the drug registry (অক্ষর), set policy versions, and view cross-org analytics. |
| **Org Admin** | one organization (hospital / clinic / chain) | Its doctors, their verification, its appointments & revenue, and staff admins beneath it. |
| **Facility Admin** | one branch / chamber under an org | Scheduling and operations for that location only. |
| **Function Admin** (scope by role, not place) | platform or org | Verification · Moderation · Support (no PHI write) · **Compliance / DPO** (audit + consent records + DSAR handling; read-heavy). |

### 3.2 Authorization mechanism (minimal blast radius)

Do **not** rewrite ~50 endpoints inline. Introduce a scope-injecting dependency:

```python
# require_admin(scope=..., perm=...) resolves the caller's admin_role rows,
# derives the accessible org/facility scope set, and either returns a
# ScopedAdminContext (super-admin = unbounded) or raises 403.
admin = Depends(require_admin(perm=Permission.MANAGE_DOCTORS))
```

Each endpoint then filters queries by `admin.scope` (org/facility id set). Most endpoints change
**one line** (the dependency) plus a `WHERE org_id IN (...)` clause. Super-admin short-circuits to
unbounded scope, preserving today's behaviour exactly.

### 3.3 Data model additions (proposed)

| Table | Purpose |
|---|---|
| `organizations` | Canonical hospital / clinic / chain entity (name, type, parent_id for chains, address, verification state). |
| `doctor_organizations` | Doctor ↔ org affiliation (many-to-many; role at org, active flag). Replaces reliance on free-text `hospital_name`. |
| `admin_roles` | (profile_id, tier, permission_set) — who is an admin and of what kind. |
| `admin_scopes` | (admin_role_id, org_id / facility_id) — the ABAC scope binding. |
| `admin_action_audit` | Every privileged action: actor, target, action, scope, before/after, timestamp. Mirrors `patient_access` for admins. |
| `delegated_admin_grants` | Time-boxed, revocable authority (start, expiry, granter, reason). Reuses the consent-grant pattern. |
| `dsar_requests` | Data-subject-request queue (export / delete), with status + fulfilment audit. |

`enums.py`: add `AdminTier` and `Permission` enums (single source, per convention).

### 3.4 Migration + backfill

1. Alembic revision creating the tables (use `server_default` where NOT NULL on existing tables).
2. **Backfill:** derive candidate `organizations` by normalising distinct `doctor_profiles.hospital_name`
   / `chamber_name` / `doctor_locations` strings (trigram / fuzzy match — the same normalisation
   technique অক্ষর already uses for brands), then link doctors via `doctor_organizations`. Leave
   free-text columns in place (non-breaking); the entity becomes authoritative going forward.
3. Seed one Super Admin from the existing bootstrap (`UPDATE profiles SET role='ADMIN' …`).

Reconciliation is bounded but non-trivial (fuzzy hospital names, duplicates, misspellings) — this is
why the full org model is post-competition, not finalist-sprint.

---

## 4. Quality-of-life features (chosen set)

| Feature | Build vs reuse | Notes |
|---|---|---|
| **Delegated, time-boxed, revocable admin grants** | Reuse consent-grant pattern | Authority that expires and is auditable — strong thematic fit with the consent story. |
| **Audit-log explorer** | Reuse `patient_access` / `ai_interactions` / `appointment_audit` | Surface existing tables to admins, scoped. Mostly a read + UI. |
| **Patient "who accessed my data" timeline** | Reuse `patient_access` | Data already captured; surface it to the patient. Directly PDPO-aligned. |
| **PDPO data-subject-request (DSAR) tooling** | New (`dsar_requests`) + existing delete/export paths | Export-my-data / delete-my-data workflow with fulfilment audit. Compliance selling point. |
| **Safety gate: two-person rule** | New | Destructive ops (account delete, ban) require a second admin's approval. |
| **Safety gate: break-glass access** | New; ties to আরোহণ **L4** | Emergency elevated access, always logged, notifies; the administrative analogue of L4 break-glass. |
| **Config-driven permission matrix** | New | New admin types need config, not code. |

---

## 5. Whitepaper placement (woven-in)

Small hooks only — the paper's word budget is tight (~5,000 words). Detail lives here.

| Section | Hook |
|---|---|
| **§2 Vision** | One sentence: the consent-governed, local-first pattern generalises beyond health to any sensitive-data sector (govt/finance), citing the Cabinet Division directive. |
| **§5 Architecture** | The stewardship layer: scoped RBAC+ABAC admin hierarchy; every admin action consent/audit-logged; break-glass = L4; two-person rule on destructive ops. Extend F4/F5 to show the org/controller boundary. |
| **§8 Risk register** | Add rows: admin privilege abuse / over-broad scope → scoped RBAC + two-person rule + admin_action_audit + break-glass logging. |
| **§9 Revenue** | Hospital-scoped org-admin = the data-controller accountability unit enterprises must demonstrate; anchors the enterprise/on-prem tier. Sector expansion (govt/finance) as adjacent TAM created by the same regulation. |
| **§10 / Table 5** | Built = flat admin + management actions. Proposed = org entity + scoped RBAC + QoL. Keep honest. |

**Built vs proposed (state plainly):** the admin *actions* and the reusable substrate (consent
grants, audit tables) are shipped; the org entity, scoping, and QoL surfaces are proposed roadmap.

---

## 6. Effort estimate

| Slice | Effort | When |
|---|---|---|
| `AdminTier` + `Permission` enums + `require_admin(...)` dependency (super-admin unbounded; behaviour-preserving) | 1–2 days | finalist-feasible |
| Audit explorer + patient access timeline (surface existing tables) | 1–2 days | finalist-feasible |
| `organizations` + `doctor_organizations` + backfill/reconciliation | 3–5 days | post-competition |
| Scoped enforcement across ~50 endpoints via the dependency | 2–3 days | post-competition |
| Delegated grants · DSAR · two-person rule · break-glass | 3–4 days | post-competition |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Backfill mislinks doctors to wrong org (fuzzy names) | Human-in-the-loop review queue; free-text columns retained as fallback; org verification state |
| Scope enforcement missed on an endpoint → data crosses org boundary | Central dependency (not per-endpoint branching); negative tests asserting cross-org denial |
| Break-glass abused | Always-logged, notifies, time-boxed, reviewed after the fact |
| Over-broad super-admin | Two-person rule on destructive ops; DPO/compliance function-admin audits the audit |
| Scope creep dilutes the AI thesis | Kept as a woven layer, not a sixth artifact; framed as governance, not a dashboard |

---

## 8. Regulatory sources

The authoritative framing is the one already cited in the whitepaper: the Personal Data Protection
Ordinance 2025 (Ordinance No. 61 of 2025, gazetted 6 Nov 2025), most provisions in immediate effect
with selected institutional/enforcement sections delayed. Do not reintroduce a blanket "compliance
window closes May 2027" claim; the self-review already rejected it as too broad. A hospital is a data
controller under that framework, which is what the scoped organisation admin makes observable.

Adjacent-sector demand signal (used in the whitepaper's distribution section, cited, not as a Medora
result):

- Cabinet Division (e-Governance-2 Wing) caution to ministry secretaries on third-party AI data
  exposure — *Views Bangladesh* (`cabinetai`).
- Bangladesh Bank: "Don't use confidential data in AI tools" — *The Business Standard* (`bbai`).
