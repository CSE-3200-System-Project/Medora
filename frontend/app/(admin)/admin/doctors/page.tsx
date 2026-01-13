"use client";

import React, { useEffect, useState, Suspense } from "react";
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
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  User,
  Search,
  Ban,
  Unlock,
} from "lucide-react";
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

function DoctorsPageContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams?.get('tab') || 'all';
  
  const [statusFilter, setStatusFilter] = useState(defaultTab);
  const [search, setSearch] = useState("");
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [pendingDoctors, setPendingDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [isApproving, setIsApproving] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [allDocs, pendingDocs] = await Promise.all([
        getAllDoctors(),
        getPendingDoctors(),
      ]);
      setAllDoctors(allDocs.doctors || []);
      setPendingDoctors(pendingDocs.doctors || []);
    } catch (error) {
      console.error("Failed to fetch doctors:", error);
    } finally {
      setLoading(false);
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
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Unknown</Badge>;
    }
  };

  const verifiedDoctors = allDoctors.filter(d => d.verification_status === 'verified');
  const rejectedDoctors = allDoctors.filter(d => d.verification_status === 'rejected');

  // Filter by status and search
  const filteredDoctors = allDoctors
    .filter(d => {
      if (statusFilter === "all") return true;
      return d.verification_status === statusFilter;
    })
    .filter(d => 
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase())
    );

  const handleBan = async (doctor: Doctor) => {
    if (!confirm(`Are you sure you want to ban ${doctor.name}?`)) return;
    try {
      await banUser(doctor.id);
      await fetchData();
    } catch (error) {
      alert("Failed to ban user");
    }
  };

  const handleUnban = async (doctor: Doctor) => {
    try {
      await unbanUser(doctor.id);
      await fetchData();
    } catch (error) {
      alert("Failed to unban user");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AdminNavbar />
      
      <main className="p-4 sm:p-6 max-w-[1600px] mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
            Doctor Management
          </h1>
          <p className="text-slate-400">
            Review and verify doctor registrations
          </p>
        </div>

        {/* Filters */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-700/80 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {["all", "pending", "verified", "rejected"].map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={`border-slate-600 ${
                  statusFilter === status
                    ? "bg-primary text-white border-primary"
                    : "text-slate-300 hover:bg-slate-700/60"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} ({
                  status === "all" ? allDoctors.length :
                  status === "pending" ? pendingDoctors.length :
                  status === "verified" ? verifiedDoctors.length :
                  rejectedDoctors.length
                })
              </Button>
            ))}
          </div>
        </div>

        {/* Doctors Grid */}
        <DoctorGrid 
          doctors={filteredDoctors} 
          onVerify={handleVerify} 
          getVerificationBadge={getVerificationBadge}
          showActions={statusFilter === 'pending'}
          onBan={handleBan}
          onUnban={handleUnban}
        />

        {/* Verification Dialog */}
        <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-[95vw] sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {isApproving ? "Approve" : "Reject"} Doctor Verification
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {isApproving 
                  ? "This will verify the doctor and allow them to access the platform." 
                  : "This will reject the doctor's application."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label className="text-slate-300">Doctor Name</Label>
                <p className="text-white font-semibold">{selectedDoctor?.name}</p>
              </div>
              <div>
                <Label className="text-slate-300">BMDC Number</Label>
                <p className="text-white">{selectedDoctor?.bmdc_number || "N/A"}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-slate-300">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Add any notes about this verification..."
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowVerifyDialog(false)}
                disabled={processing}
                className="border-slate-600 text-slate-300 hover:bg-slate-700/60"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmVerification}
                disabled={processing}
                className={isApproving ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              >
                {processing ? "Processing..." : (isApproving ? "Approve" : "Reject")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
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
      <Card className="bg-slate-700/60 border-slate-600/50">
        <CardContent className="p-12 text-center">
          <p className="text-slate-400">No doctors found in this category</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {doctors.map((doctor) => (
        <Card key={doctor.id} className="bg-slate-700/60 border-slate-600/50 hover:border-primary/50 transition-colors">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-primary-light" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{doctor.name}</h3>
                  <p className="text-sm text-slate-400">{doctor.specialization || "No specialty"}</p>
                </div>
              </div>
              {getVerificationBadge(doctor.verification_status)}
            </div>

            <div className="space-y-2 mb-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-slate-400 min-w-0">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{doctor.email}</span>
              </div>
              {doctor.phone && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="h-4 w-4" />
                  <span>{doctor.phone}</span>
                </div>
              )}
              {doctor.bmdc_number && (
                <div className="flex items-center gap-2 text-slate-400">
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

            {(showActions || doctor.verification_status === 'pending') && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <Button
                  size="sm"
                  onClick={() => onVerify(doctor, true)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onVerify(doctor, false)}
                  className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            )}

            {/* Ban/Unban Status and Actions */}
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-600/50 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 sm:justify-between">
              {doctor.account_status === "banned" ? (
                <>
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    <Ban className="h-3 w-3 mr-1" />
                    Banned
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => onUnban(doctor)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Unlock className="h-4 w-4 mr-1" />
                    Unban
                  </Button>
                </>
              ) : (
                <>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Active
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onBan(doctor)}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
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
    </div>
  );
}

export default function DoctorsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface">
        <AdminNavbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
          <div className="animate-pulse">Loading...</div>
        </main>
      </div>
    }>
      <DoctorsPageContent />
    </Suspense>
  );
}
