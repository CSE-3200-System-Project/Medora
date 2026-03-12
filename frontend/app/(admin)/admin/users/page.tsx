import { AdminUsersClient } from "@/components/admin/pages/admin-users-client";
import { getAllPatients, getAllDoctors } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function UsersManagementPage() {
  let users: any[] = [];

  try {
    const [patientsData, doctorsData] = await Promise.all([getAllPatients(1000, 0), getAllDoctors()]);
    const patients = (patientsData?.patients || []).map((patient: any) => ({ ...patient, role: "patient" }));
    const doctors = (doctorsData?.doctors || []).map((doctor: any) => ({ ...doctor, role: "doctor" }));
    users = [...patients, ...doctors];
  } catch (error) {
    console.error("Failed to fetch users on server render:", error);
  }

  return <AdminUsersClient initialUsers={users} />;
}
