import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    PATIENT = "patient"

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
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


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
