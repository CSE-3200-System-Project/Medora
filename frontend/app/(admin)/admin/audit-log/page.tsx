import { AdminAuditLogClient } from "@/components/admin/pages/admin-audit-log-client";
import type { AuditLog } from "@/components/admin/pages/admin-audit-log-client";
import {
  getAuditLogs,
  getGovernanceAudit,
  type GovernanceAuditLog,
} from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  let initialLogs: AuditLog[] = [];
  let initialTotal = 0;
  let initialGovernanceLogs: GovernanceAuditLog[] = [];
  let initialGovernanceTotal = 0;

  try {
    const data = await getAuditLogs(undefined, 25, 0);
    initialLogs = data?.logs || [];
    initialTotal = data?.total || 0;
  } catch (error) {
    console.error("Failed to fetch audit logs on server render:", error);
  }

  try {
    const data = await getGovernanceAudit(undefined, undefined, 25, 0);
    initialGovernanceLogs = data?.items || [];
    initialGovernanceTotal = data?.total || 0;
  } catch (error) {
    console.error("Failed to fetch governance audit on server render:", error);
  }

  return (
    <AdminAuditLogClient
      initialLogs={initialLogs}
      initialTotal={initialTotal}
      initialGovernanceLogs={initialGovernanceLogs}
      initialGovernanceTotal={initialGovernanceTotal}
    />
  );
}
