export type AppointmentStatus = "CONFIRMED" | "PENDING" | "CANCELLED" | "COMPLETED" | string;

export interface PatientAppointment {
  id: string;
  title?: string | null;
  reason?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  doctor_title?: string | null;
  doctor_specialization?: string | null;
  doctor_photo_url?: string | null;
  hospital_name?: string | null;
  appointment_date: string;
  slot_time?: string | null;
  status: AppointmentStatus;
  hold_expires_at?: string | null;
  cancellation_reason_key?: string | null;
  cancellation_reason_note?: string | null;
  reschedule_request_id?: string | null;
  reschedule_requested_by_role?: string | null;
  proposed_date?: string | null;
  proposed_time?: string | null;
  reschedule_admin_approval_status?: string | null;
}

export interface PatientSummary {
  fullName: string;
  patientId: string;
  avatarUrl?: string | null;
}
