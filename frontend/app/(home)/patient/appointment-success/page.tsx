import { AppointmentSuccessClient } from "@/components/patient/pages/appointment-success-client";

type AppointmentSuccessPageProps = {
  searchParams?: Promise<{
    doctorName?: string;
    date?: string;
    time?: string;
    location?: string;
  }>;
};

export default async function AppointmentSuccessPage({ searchParams }: AppointmentSuccessPageProps) {
  const resolvedSearchParams = await searchParams;

  const appointmentData =
    resolvedSearchParams?.doctorName && resolvedSearchParams?.date && resolvedSearchParams?.time
      ? {
          doctorName: resolvedSearchParams.doctorName,
          date: resolvedSearchParams.date,
          time: resolvedSearchParams.time,
          location: resolvedSearchParams.location || "",
        }
      : null;

  return <AppointmentSuccessClient initialAppointmentData={appointmentData} />;
}
