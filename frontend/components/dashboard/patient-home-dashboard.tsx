import Link from "next/link"
import { CalendarCheck, CircleCheck, CircleDashed, ShieldPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AppointmentCard,
  DeviceConnectionCard,
  HealthStatCard,
  RecordCoverageCard,
} from "@/components/dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveServerLocale } from "@/i18n/locale"
import { loadNamespacedMessages } from "@/i18n/message-loader"
import { getPatientDashboard } from "@/lib/patient-dashboard-actions"

type MessageTree = Record<string, unknown>

const iconNameByStatLabel: Record<string, string> = {
  "Steps Today": "Footprints",
  "Sleep hours": "MoonStar",
  "Heart rate": "Heart",
  "Blood Pressure": "Waves",
}

const quickStatKeyByLabel: Record<string, string> = {
  "steps today": "patientHome.quickStats.stepsToday",
  "sleep hours": "patientHome.quickStats.sleepHours",
  "heart rate": "patientHome.quickStats.heartRate",
  "blood pressure": "patientHome.quickStats.bloodPressure",
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

function translateQuickStatLabel(label: string, t: ReturnType<typeof createTranslator>) {
  const key = quickStatKeyByLabel[label.trim().toLowerCase()]
  if (!key) {
    return label
  }

  return t(key, label)
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

  const quickStats = (dashboard?.today_health_stats ?? []).map((item) => ({
    iconName: iconNameByStatLabel[item.label] ?? "Heart",
    value: item.value,
    label: translateQuickStatLabel(item.label, t),
    trend: item.value === "N/A"
      ? t("patientHome.quickStats.noRecord", "No record")
      : t("patientHome.quickStats.recordedToday", "Recorded today"),
    trendType: "neutral" as const,
  }))

  const defaultUserName = t("patientHome.defaultUserName", "Patient")
  const coverage = dashboard?.record_coverage ?? null
  const coverageLabels = {
    title: t("patientHome.recordCoverage.title", "Today's record coverage"),
    summary: t("patientHome.recordCoverage.summary", "{recorded} of {total} displayed measurement groups have records today (UTC).", {
      recorded: coverage?.recorded_groups ?? "—", total: coverage?.total_groups ?? "—",
    }),
    unavailable: t("patientHome.recordCoverage.unavailable", "Record coverage unavailable"),
    recorded: t("patientHome.recordCoverage.recorded", "Recorded"),
    notRecorded: t("patientHome.recordCoverage.notRecorded", "No record"),
    recordedGroups: t("patientHome.recordCoverage.recordedGroups", "Groups with records"),
    missingGroups: t("patientHome.recordCoverage.missingGroups", "Groups without records"),
    details: t("patientHome.recordCoverage.details", "See inputs and calculation"),
    formula: t("patientHome.recordCoverage.formula", "Coverage = 100 × recorded groups ÷ 4. The displayed groups are steps, sleep hours, heart rate, and blood pressure. Blood pressure requires both systolic and diastolic records. Zero counts as a recorded value. Non-finite values and records outside today's UTC window are excluded."),
    scope: t("patientHome.recordCoverage.scope", "Stored-data coverage only, not a health score. There is no recommendation to record all four groups."),
    quality: t("patientHome.recordCoverage.quality", "Stored readings may be manually entered or device-sourced. Coverage does not verify their accuracy, clinical meaning, or whether a reading was newly measured."),
    window: t("patientHome.recordCoverage.window", "Record timestamp window (UTC; end exclusive)"),
    asOf: t("patientHome.recordCoverage.asOf", "Snapshot (Bangladesh time)"),
    none: t("patientHome.recordCoverage.none", "None"),
    groups: {
      steps: t("patientHome.recordCoverage.steps", "Steps"),
      sleep: t("patientHome.recordCoverage.sleep", "Sleep hours"),
      heart_rate: t("patientHome.recordCoverage.heartRate", "Heart rate"),
      blood_pressure: t("patientHome.recordCoverage.bloodPressure", "Blood pressure"),
    },
  }
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
        <div className="xl:col-span-7"><RecordCoverageCard coverage={coverage} labels={coverageLabels} locale={localeResolution.locale} /></div>
        <Card className="h-full border-border/70 bg-card/95 shadow-sm xl:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">{t("patientHome.recordCoverage.groupStatus", "Today's measurement groups")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("patientHome.recordCoverage.groupStatusDescription", "Stored records in today's UTC window")}</p>
          </CardHeader>
          <CardContent>
            {coverage ? (
              <ul className="space-y-3">
                {coverage.groups.map((group) => {
                  const Icon = group.recorded ? CircleCheck : CircleDashed
                  return (
                    <li key={group.key} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
                      <span className="text-sm font-medium">{coverageLabels.groups[group.key as keyof typeof coverageLabels.groups] ?? group.key}</span>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                        {group.recorded ? coverageLabels.recorded : coverageLabels.notRecorded}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{coverageLabels.unavailable}</p>
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-6">
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

        <div className="xl:col-span-6">
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
