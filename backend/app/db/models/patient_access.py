"""
Patient Access Control and Audit Models

These models handle:
1. PatientAccessLog - Audit trail of who viewed patient data
2. PatientDoctorAccess - Consent/access control between patients and doctors
"""

from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.db.base import Base


class AccessType(str, enum.Enum):
    """Types of access events - stored as string in database"""
    VIEW_PROFILE = "view_profile"
    VIEW_MEDICAL_HISTORY = "view_medical_history"
    VIEW_MEDICATIONS = "view_medications"
    VIEW_ALLERGIES = "view_allergies"
    VIEW_FAMILY_HISTORY = "view_family_history"
    VIEW_LIFESTYLE = "view_lifestyle"
    VIEW_FULL_RECORD = "view_full_record"
    VIEW_AI_QUERY = "view_ai_query"


class AccessStatus(str, enum.Enum):
    """Status of doctor-patient access relationship - stored as string in database"""
    ACTIVE = "active"  # Access allowed (default when appointment exists)
    REVOKED = "revoked"  # Patient has revoked access
    EXPIRED = "expired"  # Access expired (optional time-based)


class PatientAccessLog(Base):
    """
    Audit log for tracking when doctors access patient data.
    Every view is logged for compliance and patient transparency.
    """
    __tablename__ = "patient_access_logs"

    id = Column(String, primary_key=True)
    patient_id = Column(String, ForeignKey("profiles.id"), nullable=False, index=True)
    doctor_id = Column(String, ForeignKey("profiles.id"), nullable=False, index=True)
    # Store as string instead of PostgreSQL enum for simplicity
    access_type = Column(String(50), nullable=False)
    accessed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address = Column(String(45), nullable=True)  # Store IP for security audit
    user_agent = Column(Text, nullable=True)  # Browser/device info
    
    # Relationships
    patient = relationship("Profile", foreign_keys=[patient_id], backref="access_logs_as_patient")
    doctor = relationship("Profile", foreign_keys=[doctor_id], backref="access_logs_as_doctor")


class PatientDoctorAccess(Base):
    """
    Manages consent/access control between patients and doctors.
    Patients can revoke access to specific doctors.
    """
    __tablename__ = "patient_doctor_access"

    id = Column(String, primary_key=True)
    patient_id = Column(String, ForeignKey("profiles.id"), nullable=False, index=True)
    doctor_id = Column(String, ForeignKey("profiles.id"), nullable=False, index=True)
    
    # Store as string instead of PostgreSQL enum for simplicity
    status = Column(String(20), default="active", nullable=False)
    
    # Timestamps
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # Optional expiration
    
    # Metadata
    revocation_reason = Column(Text, nullable=True)
    
    # Relationships
    patient = relationship("Profile", foreign_keys=[patient_id], backref="doctor_access_controls")
    doctor = relationship("Profile", foreign_keys=[doctor_id], backref="patient_access_controls")
