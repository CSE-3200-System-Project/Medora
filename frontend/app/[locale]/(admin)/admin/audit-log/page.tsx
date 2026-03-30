import { AdminAuditLogClient } from "@/components/admin/pages/admin-audit-log-client";
import { getAuditLogs } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  let initialLogs: any[] = [];
  let initialTotal = 0;

  try {
    const data = await getAuditLogs(undefined, 25, 0);
    initialLogs = data?.logs || [];
    initialTotal = data?.total || 0;
  } catch (error) {
    console.error("Failed to fetch audit logs on server render:", error);
  }

  return (
    <AdminAuditLogClient
      initialLogs={initialLogs}
      initialTotal={initialTotal}
    />
  );
}
