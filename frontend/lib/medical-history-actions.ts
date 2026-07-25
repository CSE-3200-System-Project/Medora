"use server";

import { getMyAppointments } from "@/lib/appointment-actions";
import { getPatientOnboardingData } from "@/lib/auth-actions";
import { getMedicalHistoryPrescriptions } from "@/lib/prescription-actions";

/**
 * One client-to-server action for the initial medical-history view.
 *
 * React serializes client-triggered server actions. Combining these independent
 * backend calls here lets the Next.js server issue them concurrently instead of
 * making the browser wait for three action round trips in sequence.
 */
export async function getPatientMedicalHistoryBundle() {
  const [patientData, appointmentsResult, prescriptionResult] = await Promise.all([
    getPatientOnboardingData(),
    getMyAppointments(),
    getMedicalHistoryPrescriptions(undefined, 100, 0),
  ]);

  return {
    patientData,
    appointmentsResult,
    prescriptionResult,
  };
}
