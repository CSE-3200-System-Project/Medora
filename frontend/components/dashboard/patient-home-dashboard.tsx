"use client"

import { CalendarCheck, Droplets, Footprints, Heart, MoonStar, Pill, ShieldPlus, Waves } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AIInsightCard,
  AppointmentCard,
  DeviceConnectionCard,
  HealthScoreCard,
  HealthStatCard,
  MedicationTrendChart,
} from "@/components/dashboard"

const medicationTrend = {
  labels: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
  values: [68, 80, 72, 89, 86, 94, 92],
  adherenceRate: 92,
  deltaPercent: 2.4,
}

const appointments = [
  {
    doctorName: "Dr. Sarah Miller",
    specialty: "Cardiology Specialist",
    dateTime: "Oct 24, 10:30 AM",
    location: "Virtual Clinic",
    status: "ONLINE",
    actionLabel: "Join Visit",
    actionVariant: "default" as const,
  },
  {
    doctorName: "Dr. James Wilson",
    specialty: "Primary Care Physician",
    dateTime: "Oct 28, 02:00 PM",
    location: "Main St. Med Center",
    actionLabel: "Reschedule",
    actionVariant: "outline" as const,
  },
]

const insights = [
  {
    icon: Pill,
    title: "Medication Adherence",
    description: "You've hit 100% adherence for 3 days. Your blood pressure stability is improving.",
    tone: "success" as const,
  },
  {
    icon: MoonStar,
    title: "Sleep Quality Decline",
    description: "Deep sleep fell by 15% this week. Reduce screen time 1 hour before bed.",
    tone: "warning" as const,
  },
  {
    icon: Droplets,
    title: "Hydration Levels",
    description: "Hydration goal met 5 days in a row. Recovery markers are trending positive.",
    tone: "info" as const,
  },
]

const quickStats = [
  {
    icon: Footprints,
    value: "8,432",
    label: "Steps Today",
    trend: "+12%",
    trendType: "up" as const,
  },
  {
    icon: MoonStar,
    value: "7h 20m",
    label: "Avg Sleep",
    trend: "Stable",
    trendType: "neutral" as const,
  },
  {
    icon: Heart,
    value: "72",
    label: "BPM (Resting)",
    trend: "-2%",
    trendType: "down" as const,
  },
  {
    icon: Waves,
    value: "120/80",
    label: "Blood Pressure",
    trend: "Normal",
    trendType: "up" as const,
  },
]

export function PatientHomeDashboard() {
  return (
    <main className="mx-auto w-full max-w-360 px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <section className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Patient Health Overview
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Good morning, Alex. Here&apos;s your health summary for today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="min-w-37.5">
            <CalendarCheck className="h-4 w-4" />
            Schedule Visit
          </Button>
          <Button className="min-w-37.5">
            <ShieldPlus className="h-4 w-4" />
            Health Report
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <HealthScoreCard
            score={85}
            maxScore={100}
            activityLabel="High"
            nutritionLabel="Optimal"
            statusLabel="Excellent"
          />
        </div>

        <div className="xl:col-span-5">
          <MedicationTrendChart
            values={medicationTrend.values}
            labels={medicationTrend.labels}
            adherenceRate={medicationTrend.adherenceRate}
            deltaPercent={medicationTrend.deltaPercent}
          />
        </div>

        <div className="xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">Upcoming Appointments</h2>
            <button type="button" className="text-sm font-semibold text-primary hover:text-primary/80">
              See all
            </button>
          </div>
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <AppointmentCard key={appointment.doctorName} {...appointment} />
            ))}
          </div>
        </div>

        <div className="xl:col-span-4">
          <h2 className="mb-4 text-2xl font-semibold text-foreground">AI Health Insights</h2>
          <div className="space-y-4">
            {insights.map((insight) => (
              <AIInsightCard key={insight.title} {...insight} />
            ))}
          </div>
        </div>

        <div className="xl:col-span-4">
          <h2 className="mb-4 text-2xl font-semibold text-foreground">Quick Health Stats</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quickStats.map((stat) => (
              <HealthStatCard key={stat.label} {...stat} />
            ))}
          </div>

          <div className="mt-4">
            <DeviceConnectionCard title="Apple Health Connected" lastSynced="5 minutes ago" />
          </div>
        </div>
      </section>
    </main>
  )
}
