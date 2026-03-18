import { DoctorProfileAppointmentPage } from "@/components/doctor-profile/DoctorProfileAppointmentPage";

interface PageProps {
  params: Promise<{ doctorId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { doctorId } = await params;
  return <DoctorProfileAppointmentPage doctorId={doctorId} />;
}
