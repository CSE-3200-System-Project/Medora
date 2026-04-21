import { AdminRequestsClient } from "@/components/admin/pages/admin-requests-client";
import {
  getPendingAppointments,
  getPendingRescheduleRequests,
  getPendingCancellationRequests,
} from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  const [appts, reschedules, cancellations] = await Promise.all([
    getPendingAppointments(50, 0).catch(() => ({ appointments: [], total: 0 })),
    getPendingRescheduleRequests(50, 0).catch(() => ({ requests: [], total: 0 })),
    getPendingCancellationRequests(50, 0).catch(() => ({ requests: [], total: 0 })),
  ]);

  return (
    <AdminRequestsClient
      initialAppointments={appts?.appointments ?? []}
      initialReschedules={reschedules?.requests ?? []}
      initialCancellations={cancellations?.requests ?? []}
    />
  );
}
