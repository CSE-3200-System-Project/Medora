import { AdminPatientsClient } from "@/components/admin/pages/admin-patients-client";
import { getAllPatients } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  let initialPatients: any[] = [];
  let initialTotal = 0;

  try {
    const data = await getAllPatients(12, 0);
    initialPatients = data?.patients || [];
    initialTotal = data?.total || 0;
  } catch (error) {
    console.error("Failed to fetch patients on server render:", error);
  }

  return <AdminPatientsClient initialPatients={initialPatients} initialTotal={initialTotal} initialPage={0} />;
}
