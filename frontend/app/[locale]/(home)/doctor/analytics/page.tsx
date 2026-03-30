import { DoctorAnalyticsDashboard } from "@/components/doctor/analytics/DoctorAnalyticsDashboard";
import { getTranslations } from "next-intl/server";
import { buildDoctorAnalyticsData } from "@/components/doctor/analytics/build-analytics-data";
import { getDoctorAppointmentStats } from "@/lib/appointment-actions";
import { getDoctorActions, getDoctorActionStats } from "@/lib/doctor-actions";

export default async function DoctorAnalyticsPage() {
  const t = await getTranslations();
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
    initialError = t("errors.doctorAnalyticsLoad");
  }

  return (
    <DoctorAnalyticsDashboard
      initialData={initialData}
      initialError={initialError}
    />
  );
}
