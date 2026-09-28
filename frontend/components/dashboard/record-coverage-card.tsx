import { CircleCheck, CircleDashed, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PatientDashboardRecordCoverage } from "@/lib/patient-dashboard-actions"

export type CoverageLabels = {
  title: string
  summary: string
  unavailable: string
  recorded: string
  notRecorded: string
  recordedGroups: string
  missingGroups: string
  details: string
  formula: string
  scope: string
  quality: string
  window: string
  asOf: string
  none: string
  groups: Record<string, string>
}

export function RecordCoverageCard({ coverage, labels, locale: appLocale }: {
  coverage: PatientDashboardRecordCoverage | null
  labels: CoverageLabels
  locale: string
}) {
  const percent = coverage?.coverage_percent ?? null
  const locale = appLocale === "bn" ? "bn-BD" : "en-US"
  const formatUtcDate = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(date)
  }
  const formatBangladeshDateTime = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dhaka",
    }).format(date)
  }
  return (
    <div className="h-full animate-fade-in-up card-hover">
      <Card className="h-full border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="pb-1"><CardTitle className="text-xl">{labels.title}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[190px_1fr]">
            <div className="mx-auto flex h-46 w-46 items-center justify-center rounded-full bg-muted"
              aria-label={coverage ? labels.summary : labels.unavailable}
              style={percent === null ? undefined : { background: `conic-gradient(var(--primary) ${percent}%, var(--muted) 0)` }}>
              <div className="flex h-39 w-39 flex-col items-center justify-center rounded-full bg-card">
                <span className="text-4xl font-bold tabular-nums">{percent === null ? "—" : `${percent}%`}</span>
                <span className="mt-1 text-sm text-muted-foreground">{coverage ? `${coverage.recorded_groups} / ${coverage.total_groups}` : labels.unavailable}</span>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{coverage ? labels.summary : labels.unavailable}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{labels.recordedGroups}</p>
                  <p className="mt-1 text-xl font-semibold">{coverage?.recorded_groups ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{labels.missingGroups}</p>
                  <p className="mt-1 text-xl font-semibold">{coverage ? coverage.total_groups - coverage.recorded_groups : "—"}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{labels.scope}</p>
            </div>
          </div>
          <details className="mt-5 rounded-xl border border-border/60 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-primary">{labels.details}</summary>
            <div className="mt-3 space-y-3 text-sm">
              <p>{labels.formula}</p>
              <p>{labels.quality}</p>
              {coverage ? <>
                <ul className="space-y-2">{coverage.groups.map(group => {
                  const Icon = group.recorded ? CircleCheck : CircleDashed
                  return <li key={group.key} className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>{labels.groups[group.key] ?? group.key}: {group.recorded ? labels.recorded : labels.notRecorded}</span></li>
                })}</ul>
                <p>{labels.window}: {formatUtcDate(coverage.window_start_utc)} – {formatUtcDate(coverage.window_end_utc)}</p>
                <p>{labels.asOf}: {formatBangladeshDateTime(coverage.as_of_utc)}</p>
              </> : <p className="flex items-center gap-2"><Info className="h-4 w-4" />{labels.unavailable}</p>}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
