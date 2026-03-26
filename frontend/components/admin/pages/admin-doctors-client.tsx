"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScrollContainer } from "@/components/ui/table";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  User,
  Ban,
  Unlock,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { getPendingDoctors, getAllDoctors, verifyDoctor, banUser, unbanUser } from "@/lib/admin-actions";

type Doctor = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  bmdc_number?: string;
  specialization?: string;
  bmdc_document_url?: string;
  created_at?: string;
  verification_status?: string;
  verified_at?: string;
  account_status?: string;
};

type AdminDoctorsClientProps = {
  initialAllDoctors: Doctor[];
  initialPendingDoctors: Doctor[];
};

function DoctorsPageContent({ initialAllDoctors, initialPendingDoctors }: AdminDoctorsClientProps) {
  const searchParams = useSearchParams();
  const defaultTab = searchParams?.get("tab") || "all";

  const [statusFilter, setStatusFilter] = useState(defaultTab);
  const [search, setSearch] = useState("");
  const [allDoctors, setAllDoctors] = useState<Doctor[]>(initialAllDoctors);
  const [pendingDoctors, setPendingDoctors] = useState<Doctor[]>(initialPendingDoctors);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [isApproving, setIsApproving] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [banConfirmDialog, setBanConfirmDialog] = useState<{
    isOpen: boolean;
    doctor: Doctor | null;
  }>({ isOpen: false, doctor: null });

  const fetchData = async () => {
    try {
      const [allDocs, pendingDocs] = await Promise.all([getAllDoctors(), getPendingDoctors()]);
      setAllDoctors(allDocs.doctors || []);
      setPendingDoctors(pendingDocs.doctors || []);
    } catch (error) {
      console.error("Failed to fetch doctors:", error);
    }
  };

  const handleVerify = (doctor: Doctor, approve: boolean) => {
    setSelectedDoctor(doctor);
    setIsApproving(approve);
    setVerificationNotes("");
    setShowVerifyDialog(true);
  };

  const confirmVerification = async () => {
    if (!selectedDoctor) return;

    setProcessing(true);
    try {
      await verifyDoctor(selectedDoctor.id, isApproving, verificationNotes);
      setShowVerifyDialog(false);
      await fetchData();
    } catch (error) {
      console.error("Verification failed:", error);
      alert("Verification failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const getVerificationBadge = (status?: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Verified</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge className="bg-muted/30 text-muted-foreground border-border/30">Unknown</Badge>;
    }
  };

  const verifiedDoctors = allDoctors.filter((d) => d.verification_status === "verified");
  const rejectedDoctors = allDoctors.filter((d) => d.verification_status === "rejected");
  const statusOptions = ["all", "pending", "verified", "rejected"] as const;

  const filteredDoctors = allDoctors
    .filter((d) => {
      if (statusFilter === "all") return true;
      return d.verification_status === statusFilter;
    })
    .filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.email.toLowerCase().includes(search.toLowerCase()));

  const handleBan = async (doctor: Doctor) => {
    setBanConfirmDialog({ isOpen: true, doctor });
  };

  const confirmBan = async () => {
    if (!banConfirmDialog.doctor) return;
    try {
      await banUser(banConfirmDialog.doctor.id);
      await fetchData();
      setBanConfirmDialog({ isOpen: false, doctor: null });
    } catch {
      alert("Failed to ban user");
    }
  };

  const handleUnban = async (doctor: Doctor) => {
    try {
      await unbanUser(doctor.id);
      await fetchData();
    } catch {
      alert("Failed to unban user");
    }
  };

  return (
    <>
      <AdminNavbar />

      <main className="p-4 sm:p-6 max-w-400 mx-auto pt-(--nav-content-offset)">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">Doctor Management</h1>
          <p className="text-muted-foreground">Review and verify doctor registrations</p>
        </div>

        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          <div className="w-full sm:w-96">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-card/80 border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="lg:hidden">
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 bg-card/80 border-border text-foreground"
              aria-label="Filter doctors by status"
            >
              {statusOptions.map((status) => {
                const count =
                  status === "all"
                    ? allDoctors.length
                    : status === "pending"
                    ? pendingDoctors.length
                    : status === "verified"
                    ? verifiedDoctors.length
                    : rejectedDoctors.length;

                return (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                  </option>
                );
              })}
            </Select>
          </div>

          <div className="hidden lg:flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={`border-border ${
                  statusFilter === status ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-card/60"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} ({
                  status === "all"
                    ? allDoctors.length
                    : status === "pending"
                    ? pendingDoctors.length
                    : status === "verified"
                    ? verifiedDoctors.length
                    : rejectedDoctors.length
                })
              </Button>
            ))}
          </div>
        </div>

        <DoctorGrid
          doctors={filteredDoctors}
          onVerify={handleVerify}
          getVerificationBadge={getVerificationBadge}
          showActions={statusFilter === "pending"}
          onBan={handleBan}
          onUnban={handleUnban}
        />

        <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
          <DialogContent className="bg-card border-border text-foreground max-w-[95vw] sm:max-w-106.25">
            <DialogHeader>
              <DialogTitle>{isApproving ? "Approve" : "Reject"} Doctor Verification</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {isApproving
                  ? "This will verify the doctor and allow them to access the platform."
                  : "This will reject the doctor's application."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Doctor Name</Label>
                <p className="text-foreground font-semibold">{selectedDoctor?.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">BMDC Number</Label>
                <p className="text-foreground">{selectedDoctor?.bmdc_number || "N/A"}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-muted-foreground">
                  Notes (Optional)
                </Label>
                <Textarea
                  id="notes"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Add any notes about this verification..."
                  className="bg-background border-border text-foreground"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowVerifyDialog(false)}
                disabled={processing}
                className="border-border text-muted-foreground hover:bg-card/60"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmVerification}
                disabled={processing}
                className={isApproving ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              >
                {processing ? "Processing..." : isApproving ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmationDialog
          isOpen={banConfirmDialog.isOpen}
          onClose={() => setBanConfirmDialog({ isOpen: false, doctor: null })}
          onConfirm={confirmBan}
          title="Ban Doctor"
          description={`Are you sure you want to ban ${banConfirmDialog.doctor?.name}? They will no longer be able to access their account or receive appointments.`}
          confirmText="Ban User"
          variant="danger"
        />
      </main>
    </>
  );
}

function DoctorGrid({
  doctors,
  onVerify,
  getVerificationBadge,
  showActions = false,
  onBan,
  onUnban,
}: {
  doctors: Doctor[];
  onVerify: (doctor: Doctor, approve: boolean) => void;
  getVerificationBadge: (status?: string) => React.ReactNode;
  showActions?: boolean;
  onBan: (doctor: Doctor) => void;
  onUnban: (doctor: Doctor) => void;
}) {
  if (doctors.length === 0) {
    return (
      <Card className="bg-card/60 border-border/50">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No doctors found in this category</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ResponsiveGrid pattern="thirds" gap="sm" className="lg:hidden">
        {doctors.map((doctor) => (
          <Card key={doctor.id} className="bg-card/60 border-border/50 hover:border-primary/50 transition-colors">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="h-6 w-6 text-primary-light" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{doctor.name}</h3>
                    <p className="text-sm text-muted-foreground">{doctor.specialization || "No specialty"}</p>
                  </div>
                </div>
                {getVerificationBadge(doctor.verification_status)}
              </div>

              <div className="space-y-2 mb-4 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{doctor.email}</span>
                </div>
                {doctor.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{doctor.phone}</span>
                  </div>
                )}
                {doctor.bmdc_number && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>BMDC: {doctor.bmdc_number}</span>
                  </div>
                )}
              </div>

              {doctor.bmdc_document_url && (
                <a
                  href={doctor.bmdc_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary-light hover:text-primary mb-4"
                >
                  <ExternalLink className="h-4 w-4" />
                  View BMDC Document
                </a>
              )}

              {(showActions || doctor.verification_status === "pending") && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button size="sm" onClick={() => onVerify(doctor, true)} className="flex-1 min-w-28 bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onVerify(doctor, false)}
                    className="flex-1 min-w-28 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50 flex flex-wrap items-center gap-2 sm:justify-between">
                {doctor.account_status === "banned" ? (
                  <>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      <Ban className="h-3 w-3 mr-1" />
                      Banned
                    </Badge>
                    <Button size="sm" onClick={() => onUnban(doctor)} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
                      <Unlock className="h-4 w-4 mr-1" />
                      Unban
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onBan(doctor)}
                      className="w-full sm:w-auto border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Ban User
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </ResponsiveGrid>

      <div className="hidden lg:block">
        <TableScrollContainer className="border-border/50 bg-card/40">
          <Table>
            <TableHeader className="bg-card/60 border-border/50">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Doctor</TableHead>
                <TableHead className="text-muted-foreground">Contact</TableHead>
                <TableHead className="text-muted-foreground">BMDC</TableHead>
                <TableHead className="text-muted-foreground">Verification</TableHead>
                <TableHead className="text-muted-foreground">Account</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor.id} className="border-border/30 hover:bg-card/40">
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{doctor.name}</p>
                      <p className="text-xs text-muted-foreground">{doctor.specialization || "No specialty"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground wrap-break-word">{doctor.email}</p>
                    {doctor.phone && <p className="text-xs text-muted-foreground">{doctor.phone}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-foreground">{doctor.bmdc_number || "N/A"}</p>
                      {doctor.bmdc_document_url && (
                        <a
                          href={doctor.bmdc_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-light hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Document
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getVerificationBadge(doctor.verification_status)}</TableCell>
                  <TableCell>
                    {doctor.account_status === "banned" ? (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Banned</Badge>
                    ) : (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {(showActions || doctor.verification_status === "pending") && (
                        <>
                          <Button size="sm" onClick={() => onVerify(doctor, true)} className="bg-green-600 hover:bg-green-700">
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onVerify(doctor, false)}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {doctor.account_status === "banned" ? (
                        <Button size="sm" onClick={() => onUnban(doctor)} className="bg-green-600 hover:bg-green-700">
                          Unban
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onBan(doctor)}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          Ban
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>
    </>
  );
}

export function AdminDoctorsClient(props: AdminDoctorsClientProps) {
  return (
    <Suspense
      fallback={
        <>
          <AdminNavbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-(--nav-content-offset)">
            <div className="flex items-center justify-center min-h-[50vh]">
              <MedoraLoader size="lg" label="Loading doctors..." />
            </div>
          </main>
        </>
      }
    >
      <DoctorsPageContent {...props} />
    </Suspense>
  );
}



