export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "CANCELLED_BY_PATIENT"
  | "CANCELLED_BY_DOCTOR"
  | "PENDING_ADMIN_REVIEW"
  | "PENDING_DOCTOR_CONFIRMATION"
  | "PENDING_PATIENT_CONFIRMATION"
  | "RESCHEDULE_REQUESTED"
  | "CANCEL_REQUESTED"
  | "NO_SHOW";

export type DoctorAppointment = {
  id: string;
  doctor_id?: string | null;
  appointment_date: string;
  slot_time?: string | null;
  status: AppointmentStatus;
  patient_name: string;
  patient_id?: string | null;
  patient_ref?: string | null;
  patient_age?: number | null;
  patient_gender?: string | null;
  patient_phone?: string | null;
  reason?: string | null;
  notes?: string | null;
  completed_at?: string | null;
  revenue_amount?: number | null;
  cancellation_reason_key?: string | null;
  cancellation_reason_note?: string | null;
  cancelled_at?: string | null;
  reschedule_request_id?: string | null;
  reschedule_requested_by_role?: string | null;
  proposed_date?: string | null;
  proposed_time?: string | null;
  reschedule_admin_approval_status?: string | null;
  blood_group?: string | null;
  chronic_conditions?: string[];
  location?: string | null;
};

export type MetricCard = {
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  accentClass: string;
};
