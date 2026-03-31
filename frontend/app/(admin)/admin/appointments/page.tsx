import { AdminAppointmentsClient } from "@/components/admin/pages/admin-appointments-client";
import { getAllAppointments } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  let initialAppointments: any[] = [];
  let initialTotal = 0;

  try {
    const data = await getAllAppointments(10, 0);
    initialAppointments = data?.appointments || [];
    initialTotal = data?.total || 0;
  } catch (error) {
    console.error("Failed to fetch appointments on server render:", error);
  }

  return <AdminAppointmentsClient initialAppointments={initialAppointments} initialTotal={initialTotal} initialPage={0} />;
}
