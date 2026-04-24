export interface BackendDoctorLocation {
  id?: string;
  name: string;
  location_type?: string;
  display_name?: string;
  address: string;
  city: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  availability?: string | null;
  available_days?: string[] | null;
  appointment_duration?: number | null;
  day_time_slots?: Record<string, string[]> | null;
}

export interface BackendDoctorProfile {
  profile_id: string;
  first_name: string;
  last_name: string;
  title?: string | null;
  profile_photo_url?: string | null;
  bmdc_verified?: boolean;
  qualifications?: string | null;
  specialization?: string | null;
  speciality_name?: string | null;
  years_of_experience?: number | null;
  about?: string | null;
  services?: string[] | null;
  sub_specializations?: string[] | null;
  locations?: BackendDoctorLocation[] | null;
  consultation_fee?: number | null;
  appointment_duration?: number | null;
  available_days?: string[] | null;
  day_time_slots?: Record<string, string[]> | null;
  rating_avg?: number;
  rating_count?: number;
}

export interface DateOption {
  key: string;
  dayLabel: string;
  dayNumber: string;
  monthLabel: string;
  helperLabel: string;
  disabled: boolean;
}

export interface SlotGroup {
  period: string;
  slots: Array<{ time: string; available: boolean }>;
}
