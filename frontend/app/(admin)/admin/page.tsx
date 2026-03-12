import { AdminDashboardClient } from "@/components/admin/pages/admin-dashboard-client";
import { getAdminStats } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let stats = null;
  try {
    stats = await getAdminStats();
  } catch (error) {
    console.error("Failed to fetch admin stats on server render:", error);
  }

  return <AdminDashboardClient initialStats={stats} />;
}
