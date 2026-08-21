import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    PATIENT = "patient"


# ========== Stewardship: scoped human administration ==========

class AdminTier(str, enum.Enum):
    """Administrative authority tier; scope remains a separate attribute."""

    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    FACILITY_ADMIN = "facility_admin"
    FUNCTION_ADMIN = "function_admin"


class Permission(str, enum.Enum):
    """Stable permission vocabulary stored in ``admin_roles.permission_set``."""

    PLATFORM_ADMIN = "platform_admin"
    VIEW_DASHBOARD = "view_dashboard"
    MANAGE_DOCTORS = "manage_doctors"
    MANAGE_PATIENTS = "manage_patients"
    MANAGE_APPOINTMENTS = "manage_appointments"
    MODERATE_REVIEWS = "moderate_reviews"
    VIEW_AUDIT = "view_audit"
    MANAGE_ADMINS = "manage_admins"
    BREAK_GLASS = "break_glass"

class VerificationStatus(enum.Enum):
    unverified = "unverified"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"

class AccountStatus(enum.Enum):
    active = "active"
    suspended = "suspended"
    deleted = "deleted"
    banned = "banned"

class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

class BloodGroup(str, enum.Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    O_POS = "O+"
    O_NEG = "O-"
    AB_POS = "AB+"
    AB_NEG = "AB-"


# ========== Consultation & Prescription Enums ==========

class ConsultationStatus(str, enum.Enum):
    OPEN = "open"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PrescriptionType(str, enum.Enum):
    MEDICATION = "medication"
    TEST = "test"
    SURGERY = "surgery"


class PrescriptionStatus(str, enum.Enum):
    PENDING_ACKNOWLEDGMENT = "pending_acknowledgment"
    RECEIPT_ACKNOWLEDGED = "receipt_acknowledged"
    DISCREPANCY_REPORTED = "discrepancy_reported"


class MealInstruction(str, enum.Enum):
    BEFORE_MEAL = "before_meal"
    AFTER_MEAL = "after_meal"
    WITH_MEAL = "with_meal"
    EMPTY_STOMACH = "empty_stomach"
    ANY_TIME = "any_time"


class TestUrgency(str, enum.Enum):
    NORMAL = "normal"
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class SurgeryUrgency(str, enum.Enum):
    SCHEDULED = "scheduled"
    # `immediate` exists in the Postgres type and predates this class. Without a member
    # for it, reading any row already carrying that value raises ValueError.
    IMMEDIATE = "immediate"
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENCY = "emergency"
    ELECTIVE = "elective"


class MedicineType(str, enum.Enum):
    TABLET = "tablet"
    CAPSULE = "capsule"
    SYRUP = "syrup"
    INJECTION = "injection"
    DROPS = "drops"
    INHALER = "inhaler"
    CREAM = "cream"
    OINTMENT = "ointment"
    GEL = "gel"
    PATCH = "patch"
    POWDER = "powder"
    SUPPOSITORY = "suppository"
    OTHER = "other"


class DurationUnit(str, enum.Enum):
    DAYS = "days"
    WEEKS = "weeks"
    MONTHS = "months"
    YEARS = "years"
    ONGOING = "ongoing"
    AS_NEEDED = "as_needed"


class DosageType(str, enum.Enum):
    PATTERN = "pattern"
    FREQUENCY = "frequency"


class HealthMetricType(str, enum.Enum):
    STEPS = "steps"
    SLEEP_HOURS = "sleep_hours"
    SLEEP_MINUTES = "sleep_minutes"
    HEART_RATE = "heart_rate"
    BLOOD_PRESSURE_SYSTOLIC = "blood_pressure_systolic"
    BLOOD_PRESSURE_DIASTOLIC = "blood_pressure_diastolic"
    WEIGHT = "weight"
    BLOOD_SUGAR = "blood_sugar"


class HealthMetricSource(str, enum.Enum):
    MANUAL = "manual"
    DEVICE = "device"


class DoctorActionType(str, enum.Enum):
    APPOINTMENT_COMPLETED = "appointment_completed"
    PRESCRIPTION_ISSUED = "prescription_issued"
    CONSULTATION_COMPLETED = "consultation_completed"
    LAB_REVIEW = "lab_review"
    PATIENT_MESSAGE = "patient_message"
    MANUAL_TASK = "manual_task"


class DoctorActionPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class DoctorActionStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ReviewModerationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# ========== Appointment Scheduling Enums ==========

class AppointmentRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    RESCHEDULE_PROPOSED = "reschedule_proposed"


class RescheduleRequestStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class DayOfWeek(int, enum.Enum):
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


# ========== Arohon: graded autonomy ==========
# Arohon (আরোহণ, "ascent") is the authority ladder specified in the BCOLBD whitepaper.
# The tier says how far an assistive AI path may go; the risk class caps how far it is
# allowed to go regardless of what the model produced. Policy lives in
# `app/core/arohon.py` — these are only the labels, kept here per the single-source rule.

class AutonomyTier(str, enum.Enum):
    """How far an AI path may act. Ordering is defined in `app.core.arohon.TIER_ORDER`."""
    L0_ABSTAIN = "L0_abstain"
    L1_INFORM = "L1_inform"
    L2_SUGGEST = "L2_suggest"
    L3_ESCALATE = "L3_escalate"
    L4_BREAK_GLASS = "L4_break_glass"


class RiskClass(str, enum.Enum):
    """What kind of case this is. Determines the ceiling, never the model's confidence.

    The whitepaper names cardiac, stroke, anaphylaxis, and obstetric as the emergency
    classes and self-harm as the separately capped one. The additional physiological
    classes exist because the deployed red-flag rules already match seizure, syncope,
    haemorrhage, and respiratory distress; folding those into `cardiac` would make the
    tier log say something clinically untrue.
    """
    CARDIAC = "cardiac"
    RESPIRATORY = "respiratory"
    STROKE = "stroke"
    NEUROLOGIC = "neurologic"
    HEMORRHAGE = "hemorrhage"
    ANAPHYLAXIS = "anaphylaxis"
    OBSTETRIC = "obstetric"
    SELF_HARM = "self_harm"
    ROUTINE = "routine"
    OUT_OF_SCOPE = "out_of_scope"
