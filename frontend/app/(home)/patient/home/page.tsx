import { PatientHomeDashboard } from "@/components/dashboard/patient-home-dashboard"
import { AppBackground } from "@/components/ui/app-background"
import { Navbar } from "@/components/ui/navbar"

export default function PatientHomePage() {
  return (
    <AppBackground>
      <Navbar />
      <div className="mx-auto max-w-7xl page-content pt-24 md:pt-28">
        <PatientHomeDashboard />
      </div>
    </AppBackground>
  )
}
