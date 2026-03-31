import { DoctorProfileAppointmentPage } from "@/components/doctor/doctor-profile/DoctorProfileAppointmentPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <DoctorProfileAppointmentPage doctorId={id} />;
}
