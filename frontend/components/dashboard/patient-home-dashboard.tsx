import Link from "next/link"
import { CalendarCheck, ShieldPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AIInsightCard,
  AppointmentCard,
  DeviceConnectionCard,
  HealthScoreCard,
  HealthStatCard,
  MedicationTrendChart,
} from "@/components/dashboard"
import { getPatientDashboard } from "@/lib/patient-dashboard-actions"

const iconNameByStatLabel: Record<string, string> = {
  "Steps Today": "Footprints",
  "Avg Sleep": "MoonStar",
  "BPM (Resting)": "Heart",
  "Blood Pressure": "Waves",
}

const insightIconNameByTitle: Record<string, string> = {
  "Medication Adherence": "Pill",
  "Sleep Monitoring": "MoonStar",
  "Blood Pressure Tracking": "Droplets",
}

function formatAppointmentDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatSyncLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export async function PatientHomeDashboard() {
  let dashboard: Awaited<ReturnType<typeof getPatientDashboard>> | null = null

  try {
    dashboard = await getPatientDashboard()
  } catch {
    dashboard = null
  }

  const medicationTrend = dashboard?.medication_adherence_trend ?? {
    labels: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    values: [0, 0, 0, 0, 0, 0, 0],
    adherence_rate: 0,
    delta_percent: 0,
  }

  const appointments = (dashboard?.upcoming_appointments ?? []).map((item) => ({
    appointmentKey: item.id || `${item.doctor_name}-${item.appointment_date}-${item.status}`,
    doctorName: item.doctor_name,
    specialty: item.specialty || "General Consultation",
    dateTime: formatAppointmentDate(item.appointment_date),
    location: "Medora Consultation",
    status: item.status,
    actionLabel: item.status.toUpperCase() === "CONFIRMED" ? "Join Visit" : "Manage",
    actionVariant: item.status.toUpperCase() === "CONFIRMED" ? ("default" as const) : ("outline" as const),
  }))

  const insights = (dashboard?.ai_insights ?? []).map((item) => ({
    iconName: insightIconNameByTitle[item.title] ?? "Pill",
    title: item.title,
    description: item.description,
    tone: item.tone,
  }))

  const quickStats = (dashboard?.today_health_stats ?? []).map((item) => ({
    iconName: iconNameByStatLabel[item.label] ?? "Heart",
    value: item.value,
    label: item.label,
    trend: item.trend,
    trendType: item.trend_type,
  }))

  const healthScore = dashboard?.health_score ?? 0
  const scoreStatus = healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Improving" : "Needs Attention"
  const activityLabel = healthScore >= 75 ? "High" : healthScore >= 50 ? "Moderate" : "Low"
  const nutritionLabel = healthScore >= 70 ? "Balanced" : "Needs Review"

  return (
    <main className="mx-auto w-full max-w-360 px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <section className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Patient Health Overview
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Good day, {dashboard?.user_name || "Patient"}. Here&apos;s your live summary for today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="min-w-37.5" asChild>
            <Link href="/patient/find-doctor">
              <CalendarCheck className="h-4 w-4" />
              Schedule Visit
            </Link>
          </Button>
          <Button className="min-w-37.5" asChild>
            <Link href="/analytics">
              <ShieldPlus className="h-4 w-4" />
              Health Report
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Link href="/analytics" className="xl:col-span-7 block transition-transform hover:scale-[1.01]">
          <HealthScoreCard
            score={healthScore}
            maxScore={100}
            activityLabel={activityLabel}
            nutritionLabel={nutritionLabel}
            statusLabel={scoreStatus}
          />
        </Link>

        <Link href="/analytics" className="xl:col-span-5 block transition-transform hover:scale-[1.01]">
          <MedicationTrendChart
            values={medicationTrend.values}
            labels={medicationTrend.labels}
            adherenceRate={medicationTrend.adherence_rate}
            deltaPercent={medicationTrend.delta_percent}
          />
        </Link>

        <div className="xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">Upcoming Appointments</h2>
            <Link href="/patient/appointments" className="text-sm font-semibold text-primary hover:text-primary/80">
              See all
            </Link>
          </div>
          <div className="space-y-4">
            {(appointments.length > 0 ? appointments : [
              {
                appointmentKey: "no-upcoming-appointments",
                doctorName: "No upcoming appointments",
                specialty: "Your schedule is clear",
                dateTime: "-",
                location: "-",
                status: "",
                actionLabel: "Book Now",
                actionVariant: "outline" as const,
              },
            ]).map((appointment) => {
              const { appointmentKey, ...appointmentCardProps } = appointment
              return <AppointmentCard key={appointmentKey} {...appointmentCardProps} />
            })}
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">AI Health Insights</h2>
            <Link href="/analytics" className="text-sm font-semibold text-primary hover:text-primary/80">
              Full Analytics
            </Link>
          </div>
          <div className="space-y-4">
            {(insights.length > 0 ? insights : [
              {
                iconName: "Pill",
                title: "No insights yet",
                description: "Start logging health metrics and reminders to unlock personalized insights.",
                tone: "info" as const,
              },
            ]).map((insight) => (
              <AIInsightCard key={insight.title} {...insight} />
            ))}
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">Quick Health Stats</h2>
            <Link href="/analytics" className="text-sm font-semibold text-primary hover:text-primary/80">
              View Details
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(quickStats.length > 0 ? quickStats : [
              {
                iconName: "Footprints",
                value: "N/A",
                label: "Steps Today",
                trend: "-",
                trendType: "neutral" as const,
              },
            ]).map((stat) => (
              <HealthStatCard key={stat.label} {...stat} />
            ))}
          </div>

          <div className="mt-4">
            <DeviceConnectionCard
              title={dashboard?.device_connection_status.title || "Health Device Sync"}
              lastSynced={
                dashboard?.device_connection_status.last_synced
                  ? formatSyncLabel(dashboard.device_connection_status.last_synced)
                  : "No sync yet"
              }
            />
          </div>
        </div>
      </section>
    </main>
  )
}
