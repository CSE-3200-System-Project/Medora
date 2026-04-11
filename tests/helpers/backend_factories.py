from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import factory
from faker import Faker

from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.consultation import Consultation, ConsultationStatus, Prescription, PrescriptionType
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import UserRole, VerificationStatus
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile


fake = Faker("en_US")


class ProfileFactory(factory.Factory):
    class Meta:
        model = Profile

    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    role = UserRole.PATIENT
    verification_status = VerificationStatus.verified
    first_name = factory.LazyFunction(fake.first_name)
    last_name = factory.LazyFunction(fake.last_name)
    email = factory.LazyAttribute(lambda o: f"{o.first_name.lower()}.{o.last_name.lower()}@medora.test")
    phone = factory.LazyFunction(lambda: f"+8801{fake.msisdn()[0:9]}")
    onboarding_completed = True


class PatientProfileFactory(factory.Factory):
    class Meta:
        model = PatientProfile

    profile_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    gender = factory.Iterator(["male", "female"])
    blood_group = factory.Iterator(["A+", "B+", "O+", "AB+"])
    consent_ai = True
    ai_personal_context_enabled = True
    ai_general_chat_enabled = True
    has_conditions = True
    conditions = factory.LazyFunction(lambda: [{"name": "Diabetes", "source": "seed"}])
    medications = factory.LazyFunction(
        lambda: [{"name": "Metformin", "dosage": "500mg", "frequency": "1+0+1"}]
    )
    drug_allergies = factory.LazyFunction(lambda: [{"drug_name": "Penicillin", "reaction": "Rash"}])


class DoctorProfileFactory(factory.Factory):
    class Meta:
        model = DoctorProfile

    profile_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    bmdc_number = factory.LazyFunction(lambda: f"BMDC-{fake.pyint(min_value=100000, max_value=999999)}")
    bmdc_verified = True
    title = "Dr."
    specialization = "Cardiology"
    consultation_mode = "both"
    years_of_experience = 12
    appointment_duration = 30
    day_time_slots = factory.LazyFunction(
        lambda: {"Monday": ["8:00 PM - 10:00 PM"], "Tuesday": ["8:00 PM - 10:00 PM"]}
    )
    hospital_city = "Dhaka"


class AppointmentFactory(factory.Factory):
    class Meta:
        model = Appointment

    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    doctor_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    patient_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    status = AppointmentStatus.PENDING
    appointment_date = factory.LazyFunction(lambda: datetime.now(timezone.utc) + timedelta(days=2))
    reason = "Follow-up consultation"


class ConsultationFactory(factory.Factory):
    class Meta:
        model = Consultation

    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    doctor_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    patient_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    status = ConsultationStatus.OPEN
    chief_complaint = "Chest discomfort"


class PrescriptionFactory(factory.Factory):
    class Meta:
        model = Prescription

    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    consultation_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    doctor_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    patient_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    type = PrescriptionType.MEDICATION
