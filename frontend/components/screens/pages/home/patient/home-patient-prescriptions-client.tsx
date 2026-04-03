"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getPatientPrescriptions,
  Prescription,
  PrescriptionType,
} from "@/lib/prescription-actions";
import {
  FileText,
  Pill,
  FlaskConical,
  Scissors,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Calendar,
  User,
} from "lucide-react";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";

export default function PatientPrescriptionsPage() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = React.useState<Prescription[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "pending" | "accepted" | "rejected">("all");

  React.useEffect(() => {
    loadPrescriptions();
  }, []);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPatientPrescriptions(undefined, 100, 0);
      setPrescriptions(data.prescriptions);
    } catch (err: any) {
      console.error("Failed to load prescriptions:", err);
      setError(err.message || "Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
  };

  const getPrescriptionIcon = (type: PrescriptionType) => {
    switch (type) {
      case "medication":
        return <Pill className="h-5 w-5" />;
      case "test":
        return <FlaskConical className="h-5 w-5" />;
      case "surgery":
        return <Scissors className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  const getTypeLabel = (type: PrescriptionType) => {
    switch (type) {
      case "medication":
        return "Medication";
      case "test":
        return "Medical Test";
      case "surgery":
        return "Surgery/Procedure";
      default:
        return type;
    }
  };

  const getTypeColor = (type: PrescriptionType) => {
    switch (type) {
      case "medication":
        return "bg-blue-100 text-blue-700";
      case "test":
        return "bg-purple-100 text-purple-700";
      case "surgery":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-muted/50 text-foreground";
    }
  };

  const filteredPrescriptions = prescriptions.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const pendingCount = prescriptions.filter((p) => p.status === "pending").length;

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />
      
      <main className="max-w-6xl mx-auto container-padding py-8 pt-[var(--nav-content-offset)]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            My Prescriptions
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage prescriptions from your doctors
          </p>
        </div>

        {/* Pending Alert */}
        {pendingCount > 0 && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-800">
                You have <strong>{pendingCount}</strong> pending prescription{pendingCount > 1 ? "s" : ""} that require{pendingCount === 1 ? "s" : ""} your review.
              </span>
            </CardContent>
          </Card>
        )}

        {/* Filter Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-6 overflow-hidden">
          {(["all", "pending", "accepted", "rejected"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize whitespace-nowrap"
            >
              {f === "all" ? "All" : f}
              {f === "pending" && pendingCount > 0 && (
                <span className="ml-1 bg-card/20 px-1.5 rounded text-xs">{pendingCount}</span>
              )}
            </Button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center py-2">
              <MedoraLoader size="lg" label="Loading prescriptions..." />
            </div>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="border-destructive">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="text-destructive">{error}</p>
              <Button variant="outline" onClick={loadPrescriptions} className="mt-4">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && filteredPrescriptions.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Prescriptions Found</h3>
              <p className="text-muted-foreground">
                {filter === "all"
                  ? "You don't have any prescriptions yet. They will appear here when your doctor prescribes medications, tests, or procedures."
                  : `No ${filter} prescriptions found.`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Prescriptions List */}
        {!loading && !error && filteredPrescriptions.length > 0 && (
          <div className="space-y-4">
            {filteredPrescriptions.map((prescription) => (
              <Card
                key={prescription.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/patient/prescriptions/${prescription.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${getTypeColor(prescription.type)}`}>
                        {getPrescriptionIcon(prescription.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground">
                            {getTypeLabel(prescription.type)}
                          </span>
                          {getStatusBadge(prescription.status)}
                        </div>
                        
                        {/* Show prescription preview */}
                        {prescription.medications && prescription.medications.length > 0 && (
                          <p className="text-sm text-muted-foreground truncate">
                            {prescription.medications.map(m => m.medicine_name).join(", ")}
                          </p>
                        )}
                        {prescription.tests && prescription.tests.length > 0 && (
                          <p className="text-sm text-muted-foreground truncate">
                            {prescription.tests.map(t => t.test_name).join(", ")}
                          </p>
                        )}
                        {prescription.surgeries && prescription.surgeries.length > 0 && (
                          <p className="text-sm text-muted-foreground truncate">
                            {prescription.surgeries.map(s => s.procedure_name).join(", ")}
                          </p>
                        )}

                        {/* Doctor and Date Info */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {prescription.doctor_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Dr. {prescription.doctor_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(prescription.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </AppBackground>
  );
}


