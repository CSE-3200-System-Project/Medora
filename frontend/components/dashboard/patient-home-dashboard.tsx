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
import { resolveServerLocale } from "@/i18n/locale"
import { loadNamespacedMessages } from "@/i18n/message-loader"
import { getPatientDashboard } from "@/lib/patient-dashboard-actions"

type MessageTree = Record<string, unknown>

const iconNameByStatLabel: Record<string, string> = {
  "Steps Today": "Footprints",
  "Avg Sleep": "MoonStar",
  "BPM (Resting)": "Heart",
  "Blood Pressure": "Waves",
}

const insightIconNameByTitle: Record<string, string> = {
  "Medication Adherence": "Pill",
  "Sleep Monitoring": "MoonStar",
  "Sleep Tracking": "MoonStar",
  "Blood Pressure Tracking": "Activity",
  "Blood Pressure": "Activity",
  "Daily Movement": "Footprints",
  "Resting Heart Rate": "Heart",
  "Body Mass Index": "Scale",
  "Chronic Care": "HeartPulse",
  "Active Medications": "Pill",
  "Hydration": "Droplets",
  "Lifestyle": "Activity",
  "Smoking": "AlertTriangle",
  "Vaccinations": "Syringe",
  "Next Appointment": "CalendarClock",
}

const insightTitleKeyByTitle: Record<string, string> = {
  "Medication Adherence": "patientHome.insightTitles.medicationAdherence",
  "Sleep Monitoring": "patientHome.insightTitles.sleepMonitoring",
  "Blood Pressure Tracking": "patientHome.insightTitles.bloodPressureTracking",
}

const quickStatKeyByLabel: Record<string, string> = {
  "steps today": "patientHome.quickStats.stepsToday",
  "avg sleep": "patientHome.quickStats.avgSleep",
  "bpm (resting)": "patientHome.quickStats.bpmResting",
  "blood pressure": "patientHome.quickStats.bloodPressure",
}

const weekdayKeyByLabel: Record<string, string> = {
  MON: "mon",
  MONDAY: "mon",
  TUE: "tue",
  TUESDAY: "tue",
  WED: "wed",
  WEDNESDAY: "wed",
  THU: "thu",
  THURSDAY: "thu",
  FRI: "fri",
  FRIDAY: "fri",
  SAT: "sat",
  SATURDAY: "sat",
  SUN: "sun",
  SUNDAY: "sun",
}

const appointmentStatusKeyByStatus: Record<string, string> = {
  CONFIRMED: "patientHome.appointmentCard.status.confirmed",
  PENDING: "patientHome.appointmentCard.status.pending",
  CANCELLED: "patientHome.appointmentCard.status.cancelled",
  COMPLETED: "patientHome.appointmentCard.status.completed",
}

function readMessage(messages: MessageTree, key: string): string | null {
  const segments = key.split(".")
  let current: unknown = messages

  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null
    }
    if (!(segment in current)) {
      return null
    }
    current = (current as MessageTree)[segment]
  }

  return typeof current === "string" ? current : null
}

function createTranslator(messages: MessageTree) {
  return (key: string, fallback: string, values?: Record<string, string | number>) => {
    const template = readMessage(messages, key) ?? fallback
    if (!values) {
      return template
    }

    return Object.entries(values).reduce((output, [name, value]) => {
      return output.replaceAll(`{${name}}`, String(value))
    }, template)
  }
}

function toIntlLocale(locale: string) {
  return locale === "bn" ? "bn-BD" : "en-US"
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString(toIntlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function translateWeekdayLabel(label: string, t: ReturnType<typeof createTranslator>) {
  const weekdayKey = weekdayKeyByLabel[label.trim().toUpperCase()]
  if (!weekdayKey) {
    return label
  }

  return t(`patientHome.medicationTrend.weekdayShort.${weekdayKey}`, label)
}

function translateQuickStatLabel(label: string, t: ReturnType<typeof createTranslator>) {
  const key = quickStatKeyByLabel[label.trim().toLowerCase()]
  if (!key) {
    return label
  }

  return t(key, label)
}

function translateInsightTitle(title: string, t: ReturnType<typeof createTranslator>) {
  const key = insightTitleKeyByTitle[title]
  if (!key) {
    return title
  }

  return t(key, title)
}

function translateAppointmentStatus(status: string, t: ReturnType<typeof createTranslator>) {
  const key = appointmentStatusKeyByStatus[status.trim().toUpperCase()]
  if (!key) {
    return status
  }

  return t(key, status)
}

export async function PatientHomeDashboard() {
  const localeResolution = await resolveServerLocale()
  const localizedMessages = await loadNamespacedMessages(localeResolution.locale, ["common"])
  const t = createTranslator(localizedMessages.common)

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

  const medicationLabels = medicationTrend.labels.map((label) => translateWeekdayLabel(label, t))

  const appointments = (dashboard?.upcoming_appointments ?? []).map((item) => ({
    appointmentKey: item.id || `${item.doctor_name}-${item.appointment_date}-${item.status}`,
    doctorName: item.doctor_name,
    specialty: item.specialty || t("patientHome.appointmentCard.generalConsultation", "General Consultation"),
    dateTime: formatDateTime(item.appointment_date, localeResolution.locale),
    location: t("patientHome.appointmentCard.medoraConsultation", "Medora Consultation"),
    avatarUrl: item.doctor_photo_url ?? undefined,
    status: item.status ? translateAppointmentStatus(item.status, t) : "",
    actionLabel:
      item.status.toUpperCase() === "CONFIRMED"
        ? t("patientHome.appointmentCard.actionJoinVisit", "Join Visit")
        : t("patientHome.appointmentCard.actionManage", "Manage"),
    actionVariant: item.status.toUpperCase() === "CONFIRMED" ? ("default" as const) : ("outline" as const),
  }))

  const insights = (dashboard?.ai_insights ?? []).map((item) => ({
    iconName: item.icon || insightIconNameByTitle[item.title] || "Activity",
    title: translateInsightTitle(item.title, t),
    description: item.description,
    tone: item.tone,
  }))

  const quickStats = (dashboard?.today_health_stats ?? []).map((item) => ({
    iconName: iconNameByStatLabel[item.label] ?? "Heart",
    value: item.value,
    label: translateQuickStatLabel(item.label, t),
    trend: item.trend,
    trendType: item.trend_type,
  }))

  const healthScore = dashboard?.health_score ?? 0
  const scoreStatus =
    healthScore >= 80
      ? t("patientHome.healthScoreCard.status.excellent", "Excellent")
      : healthScore >= 60
      ? t("patientHome.healthScoreCard.status.improving", "Improving")
      : t("patientHome.healthScoreCard.status.needsAttention", "Needs Attention")
  const activityLabel =
    healthScore >= 75
      ? t("patientHome.healthScoreCard.activityLevels.high", "High")
      : healthScore >= 50
      ? t("patientHome.healthScoreCard.activityLevels.moderate", "Moderate")
      : t("patientHome.healthScoreCard.activityLevels.low", "Low")
  const nutritionLabel =
    healthScore >= 70
      ? t("patientHome.healthScoreCard.nutritionLevels.balanced", "Balanced")
      : t("patientHome.healthScoreCard.nutritionLevels.needsReview", "Needs Review")
  const defaultUserName = t("patientHome.defaultUserName", "Patient")
  const adherenceDelta = medicationTrend.delta_percent
  const adherenceDeltaLabel = `${adherenceDelta >= 0 ? "+" : ""}${adherenceDelta.toFixed(1)}%`
  const scoreImprovementLabel =
    dashboard?.score_breakdown?.summary ||
    t(
      "patientHome.healthScoreCard.improvementMessage",
      "Adherence trend {delta} over the last week.",
      { delta: adherenceDeltaLabel },
    )
  const deviceSyncTitle = dashboard?.device_connection_status.title
    ? t("patientHome.deviceSync.title", dashboard.device_connection_status.title)
    : t("patientHome.deviceSync.title", "Health Device Sync")

  return (
    <main className="mx-auto w-full max-w-360 px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <section className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("patientHome.title", "Patient Health Overview")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t("patientHome.greeting", "Good day, {name}. Here's your live summary for today.", {
              name: dashboard?.user_name || defaultUserName,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="min-w-37.5" asChild>
            <Link href="/patient/find-doctor">
              <CalendarCheck className="h-4 w-4" />
              {t("patientHome.scheduleVisit", "Schedule Visit")}
            </Link>
          </Button>
          <Button className="min-w-37.5" asChild>
            <Link href="/patient/analytics">
              <ShieldPlus className="h-4 w-4" />
              {t("patientHome.healthReport", "Health Report")}
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <HealthScoreCard
            score={healthScore}
            maxScore={100}
            title={t("patientHome.healthScoreCard.title", "Overall Health Score")}
            improvementMessage={scoreImprovementLabel}
            activityTitle={t("patientHome.healthScoreCard.activity", "Activity")}
            nutritionTitle={t("patientHome.healthScoreCard.nutrition", "Nutrition")}
            viewDetailsLabel={t("patientHome.healthScoreCard.viewDetails", "View details")}
            activityLabel={activityLabel}
            nutritionLabel={nutritionLabel}
            statusLabel={scoreStatus}
            breakdown={dashboard?.score_breakdown ?? null}
            bmi={dashboard?.bmi ?? null}
            chronicConditions={dashboard?.chronic_conditions ?? []}
            activeMedicationsCount={dashboard?.active_medications_count ?? 0}
          />
        </div>

        <Link href="/patient/analytics" className="xl:col-span-5 block transition-transform hover:scale-[1.01]">
          <MedicationTrendChart
            values={medicationTrend.values}
            labels={medicationLabels}
            adherenceRate={medicationTrend.adherence_rate}
            deltaPercent={medicationTrend.delta_percent}
            title={t("patientHome.medicationTrend.title", "Medication Trend")}
            subtitle={t("patientHome.medicationTrend.subtitle", "Last 7 days adherence")}
          />
        </Link>

        <div className="xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">
              {t("patientHome.sections.upcomingAppointments", "Upcoming Appointments")}
            </h2>
            <Link href="/patient/appointments" className="text-sm font-semibold text-primary hover:text-primary/80">
              {t("patientHome.sections.seeAll", "See all")}
            </Link>
          </div>
          <div className="space-y-4">
            {(appointments.length > 0 ? appointments : [
              {
                appointmentKey: "no-upcoming-appointments",
                doctorName: t("patientHome.emptyStates.noUpcomingAppointments", "No upcoming appointments"),
                specialty: t("patientHome.emptyStates.scheduleClear", "Your schedule is clear"),
                dateTime: "-",
                location: "-",
                avatarUrl: undefined,
                status: "",
                actionLabel: t("patientHome.emptyStates.bookNow", "Book Now"),
                actionVariant: "outline" as const,
              },
            ]).map((appointment) => {
              const { appointmentKey, ...appointmentCardProps } = appointment
              return (
                <AppointmentCard
                  key={appointmentKey}
                  dateTimeLabel={t("patientHome.appointmentCard.dateTime", "Date & Time")}
                  locationLabel={t("patientHome.appointmentCard.location", "Location")}
                  {...appointmentCardProps}
                />
              )
            })}
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">
              {t("patientHome.sections.aiHealthInsights", "AI Health Insights")}
            </h2>
            <Link href="/patient/analytics" className="text-sm font-semibold text-primary hover:text-primary/80">
              {t("patientHome.sections.fullAnalytics", "Full Analytics")}
            </Link>
          </div>
          <div className="scrollbar-themed max-h-130 space-y-4 overflow-y-auto pr-1">
            {(insights.length > 0 ? insights : [
              {
                iconName: "Pill",
                title: t("patientHome.emptyStates.noInsights", "No insights yet"),
                description: t("patientHome.emptyStates.startLogging", "Start logging health metrics and reminders to unlock personalized insights."),
                tone: "info" as const,
              },
            ]).map((insight) => (
              <AIInsightCard key={insight.title} {...insight} />
            ))}
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">
              {t("patientHome.sections.quickHealthStats", "Quick Health Stats")}
            </h2>
            <Link href="/patient/analytics" className="text-sm font-semibold text-primary hover:text-primary/80">
              {t("patientHome.sections.viewDetails", "View Details")}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(quickStats.length > 0 ? quickStats : [
              {
                iconName: "Footprints",
                value: t("patientHome.emptyStates.notAvailable", "N/A"),
                label: t("patientHome.quickStats.stepsToday", "Steps Today"),
                trend: "-",
                trendType: "neutral" as const,
              },
            ]).map((stat) => (
              <HealthStatCard key={stat.label} {...stat} />
            ))}
          </div>

          <div className="mt-4">
            <DeviceConnectionCard
              title={deviceSyncTitle}
              lastSynced={
                dashboard?.device_connection_status.last_synced
                  ? formatDateTime(dashboard.device_connection_status.last_synced, localeResolution.locale)
                  : t("patientHome.deviceSync.noSyncYet", "No sync yet")
              }
              lastSyncedLabel={t("patientHome.deviceSync.lastSynced", "Last synced")}
              manageDevicesLabel={t("patientHome.deviceSync.manageDevices", "Manage Devices")}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
