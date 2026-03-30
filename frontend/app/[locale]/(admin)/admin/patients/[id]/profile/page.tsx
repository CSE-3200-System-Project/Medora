import PageClient from "@/components/screens/pages/home/patient/home-patient-profile-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPatientProfilePage({ params }: PageProps) {
  const { id } = await params;

  return <PageClient adminPatientId={id} useAdminNavbar adminEditHref={`/admin/patients/${id}/edit`} />;
}
