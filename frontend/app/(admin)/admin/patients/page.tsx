import { AdminPatientsClient } from "@/components/admin/pages/admin-patients-client";
import { getAllPatients } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  let initialPatients: any[] = [];
  let initialTotal = 0;
  let initialError: string | null = null;

  try {
    const data = await getAllPatients(12, 0);
    initialPatients = data?.patients || [];
    initialTotal = data?.total || 0;
    if (data?.success === false) {
      initialError = data?.message || "Failed to load patients";
    }
  } catch (error) {
    console.error("Failed to fetch patients on server render:", error);
    initialError = "Failed to load patients";
  }

  return (
    <AdminPatientsClient
      initialPatients={initialPatients}
      initialTotal={initialTotal}
      initialPage={0}
      initialError={initialError}
    />
  );
}
