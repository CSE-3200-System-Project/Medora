"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listMedicalReports,
  type MedicalReportListItem,
} from "@/lib/medical-report-actions";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import {
  ArrowLeft,
  ArrowRight,
  FlaskConical,
  CheckCircle2,
  Clock,
  MessageSquare,
  AlertTriangle,
  ShieldOff,
} from "lucide-react";

export default function DoctorPatientReportsPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [reports, setReports] = React.useState<MedicalReportListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (patientId) loadReports();
  }, [patientId]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listMedicalReports(patientId, 50, 0);
      setReports(data);
    } catch (err: any) {
      console.error("Failed to load patient reports:", err);
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="max-w-6xl mx-auto py-8 pt-[var(--nav-content-offset)]">
          <PageLoadingShell label="Loading patient reports..." cardCount={4} />
        </main>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto py-8 pt-[var(--nav-content-offset)]">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1"
          onClick={() => router.push(`/doctor/patient/${patientId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patient
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Patient Lab Reports
          </h1>
          <p className="text-muted-foreground mt-2">
            View and annotate uploaded test reports
          </p>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/10 mb-6">
            <CardContent className="p-6 text-center text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {reports.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <ShieldOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium">
                No reports available
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                This patient has not shared any lab reports with you, or has no uploaded reports yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => {
              return (
                <Card
                  key={report.id}
                  className="rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/doctor/patient/${patientId}/reports/${report.id}`
                    )
                  }
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          <FlaskConical className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">
                              {report.file_name || "Lab Report"}
                            </h3>
                            {report.parsed ? (
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Processed
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                          {report.summary && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {report.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>
                              {new Date(
                                report.created_at
                              ).toLocaleDateString()}
                            </span>
                            {report.result_count > 0 && (
                              <span className="flex items-center gap-1">
                                <FlaskConical className="h-3 w-3" />
                                {report.result_count} tests
                              </span>
                            )}
                            {report.comment_count > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {report.comment_count} notes
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </AppBackground>
  );
}
