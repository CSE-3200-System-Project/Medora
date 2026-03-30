import { PatientOnboarding } from "@/components/onboarding/patient-onboarding";
import { AppBackground } from "@/components/ui/app-background";
import { AdminNavbar } from "@/components/admin/admin-navbar";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPatientEditPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <AppBackground className="animate-page-enter">
      <AdminNavbar />
      <main className="page-main">
        <PatientOnboarding adminPatientId={id} onCompleteRedirectHref={`/admin/patients/${id}/profile`} />
      </main>
    </AppBackground>
  );
}
