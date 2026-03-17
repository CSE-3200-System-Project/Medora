export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export type DoctorAppointment = {
  id: string;
  appointment_date: string;
  status: AppointmentStatus;
  patient_name: string;
  patient_id?: string | null;
  patient_age?: number | null;
  patient_gender?: string | null;
  patient_phone?: string | null;
  reason?: string | null;
  notes?: string | null;
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
