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