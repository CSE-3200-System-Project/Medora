export type AppointmentStatus = "CONFIRMED" | "PENDING" | "CANCELLED" | "COMPLETED" | string;

export interface PatientAppointment {
  id: string;
  title?: string | null;
  reason?: string | null;
  doctor_name?: string | null;
  doctor_title?: string | null;
  doctor_specialization?: string | null;
  doctor_photo_url?: string | null;
  hospital_name?: string | null;
  appointment_date: string;
  slot_time?: string | null;
  status: AppointmentStatus;
}

export interface PatientSummary {
  fullName: string;
  patientId: string;
  avatarUrl?: string | null;
}
