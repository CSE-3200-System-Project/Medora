import { PatientOnboarding } from "@/components/onboarding/patient-onboarding";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";

export default function PatientOnboardingPage() {
  return (
    <AppBackground className="animate-page-enter">
      <Navbar />
      <main className="page-main">
        <PatientOnboarding />
      </main>
    </AppBackground>
  );
}
