import { DoctorOnboarding } from "@/components/onboarding/doctor-onboarding";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";

export default function DoctorOnboardingPage() {
  return (
    <AppBackground className="animate-page-enter">
      <Navbar />
      <main className="page-main">
        <DoctorOnboarding />
      </main>
    </AppBackground>
  );
}
