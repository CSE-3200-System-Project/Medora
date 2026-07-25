import { DoctorAnalyticsDashboard } from "@/components/doctor/analytics/DoctorAnalyticsDashboard";
import { buildDoctorAnalyticsData } from "@/components/doctor/analytics/build-analytics-data";
import { getDoctorActions, getDoctorActionStats } from "@/lib/doctor-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DoctorAnalyticsPage() {
  let initialError: string | null = null;
  let initialData = null;

  try {
    const [actionStats, actionsResponse] = await Promise.all([
      getDoctorActionStats().catch(() => null),
      getDoctorActions({ limit: 100, offset: 0 }).catch(() => ({ actions: [], total: 0 })),
    ]);
    const appointmentStats = actionStats
      ? {
          todays_appointments: actionStats.todays_appointments,
          total_patients: actionStats.total_patients,
          pending_reviews: actionStats.pending_reviews,
          completion_rate: actionStats.appointment_completion_rate,
        }
      : null;

    initialData = buildDoctorAnalyticsData({
      actionStats,
      appointmentStats,
      actions: actionsResponse.actions,
    });
  } catch {
    initialError = "Unable to load advanced analytics right now. Please try again shortly.";
  }

  return (
    <DoctorAnalyticsDashboard
      initialData={initialData}
      initialError={initialError}
    />
  );
}
