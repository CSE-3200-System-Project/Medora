import { DoctorAnalyticsDashboard } from "@/components/doctor/analytics/DoctorAnalyticsDashboard";
import { buildDoctorAnalyticsData } from "@/components/doctor/analytics/build-analytics-data";
import { getDoctorAppointmentStats } from "@/lib/appointment-actions";
import { getDoctorActions, getDoctorActionStats } from "@/lib/doctor-actions";

export default async function DoctorAnalyticsPage() {
  let initialError: string | null = null;
  let initialData = null;

  try {
    const [actionStats, appointmentStats, actionsResponse] = await Promise.all([
      getDoctorActionStats().catch(() => null),
      getDoctorAppointmentStats().catch(() => null),
      getDoctorActions({ limit: 100, offset: 0 }).catch(() => ({ actions: [], total: 0 })),
    ]);

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
