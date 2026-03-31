import AnalyticsDashboard, { type AnalyticsReminder } from "@/components/patient/analytics/AnalyticsDashboard";
import { getReminders } from "@/lib/reminder-actions";

export default async function AnalyticsPage() {
  let initialReminders: AnalyticsReminder[] = [];
  let initialLoadError: string | null = null;

  try {
    const data = await getReminders({ type_filter: "medication", active_only: true });
    initialReminders = data.reminders.map((reminder) => ({
      id: reminder.id,
      item_name: reminder.item_name,
      reminder_times: reminder.reminder_times ?? [],
      days_of_week: reminder.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
      notes: reminder.notes,
    }));
  } catch {
    initialLoadError = "Unable to load reminders for analytics right now.";
  }

  return <AnalyticsDashboard initialReminders={initialReminders} initialLoadError={initialLoadError} />;
}
