import { AdminDoctorsClient } from "@/components/admin/pages/admin-doctors-client";
import { getAllDoctors, getPendingDoctors } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  let allDoctors: any[] = [];
  let pendingDoctors: any[] = [];

  try {
    const [allResponse, pendingResponse] = await Promise.all([getAllDoctors(), getPendingDoctors()]);
    allDoctors = allResponse?.doctors || [];
    pendingDoctors = pendingResponse?.doctors || [];
  } catch (error) {
    console.error("Failed to fetch doctors on server render:", error);
  }

  return <AdminDoctorsClient initialAllDoctors={allDoctors} initialPendingDoctors={pendingDoctors} />;
}
