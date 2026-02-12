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