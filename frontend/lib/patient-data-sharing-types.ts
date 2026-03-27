export interface SharingCategories {
  can_view_profile: boolean;
  can_view_conditions: boolean;
  can_view_medications: boolean;
  can_view_allergies: boolean;
  can_view_medical_history: boolean;
  can_view_family_history: boolean;
  can_view_lifestyle: boolean;
  can_view_vaccinations: boolean;
  can_view_reports: boolean;
  can_view_health_metrics: boolean;
  can_view_prescriptions: boolean;
}

export interface DoctorSharingSummary {
  doctor_id: string;
  doctor_name: string;
  doctor_photo_url: string | null;
  specialization: string | null;
  sharing: SharingCategories;
  created_at: string | null;
  updated_at: string | null;
}

export interface PatientDoctorListItem {
  doctor_id: string;
  doctor_name: string;
  doctor_photo_url: string | null;
  specialization: string | null;
  has_sharing_record: boolean;
}

/**
 * Restriction metadata returned by doctor-facing endpoints when the patient
 * has not shared certain data categories.
 */
export interface DataSharingRestrictions {
  /** True if at least one category is restricted */
  any_restricted: boolean;
  /** List of category field names that are restricted (e.g. "can_view_conditions") */
  restricted_categories: (keyof SharingCategories)[];
  /** Human-readable message for the doctor, or null if nothing is restricted */
  message: string | null;
}

export const CATEGORY_LABELS: Record<keyof SharingCategories, string> = {
  can_view_profile: "Profile & Identity",
  can_view_conditions: "Medical Conditions",
  can_view_medications: "Medications",
  can_view_allergies: "Allergies",
  can_view_medical_history: "Medical History",
  can_view_family_history: "Family History",
  can_view_lifestyle: "Lifestyle & Habits",
  can_view_vaccinations: "Vaccinations",
  can_view_reports: "Lab Reports",
  can_view_health_metrics: "Health Metrics",
  can_view_prescriptions: "Prescriptions",
};

export const CATEGORY_DESCRIPTIONS: Record<keyof SharingCategories, string> = {
  can_view_profile: "Name, age, gender, blood group, photo",
  can_view_conditions: "Chronic conditions, current diagnoses",
  can_view_medications: "Current medications, dosages",
  can_view_allergies: "Drug, food, and environmental allergies",
  can_view_medical_history: "Surgeries, hospitalizations, past treatments",
  can_view_family_history: "Family medical history",
  can_view_lifestyle: "Smoking, alcohol, diet, exercise, sleep, mental health",
  can_view_vaccinations: "Vaccination records",
  can_view_reports: "Uploaded lab test reports",
  can_view_health_metrics: "Vitals and health metrics tracked over time",
  can_view_prescriptions: "Consultation prescriptions",
};
