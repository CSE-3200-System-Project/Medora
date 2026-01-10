"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { getPendingDoctors, getAllDoctors, verifyDoctor } from "@/lib/admin-actions";

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
};

export default function DoctorsPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams?.get('tab') || 'all';
  
  const [activeTab, setActiveTab] = useState(defaultTab);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AdminNavbar />
      
      <main className="p-4 md:p-6 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Doctor Management
          </h1>
          <p className="text-slate-400">
            Review and verify doctor registrations
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-800/50 border border-slate-700/50 mb-6">
            <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              All Doctors ({allDoctors.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              Pending ({pendingDoctors.length})
            </TabsTrigger>
            <TabsTrigger value="verified" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              Verified ({verifiedDoctors.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              Rejected ({rejectedDoctors.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <DoctorGrid doctors={allDoctors} onVerify={handleVerify} getVerificationBadge={getVerificationBadge} />
          </TabsContent>

          <TabsContent value="pending">
            <DoctorGrid doctors={pendingDoctors} onVerify={handleVerify} getVerificationBadge={getVerificationBadge} showActions />
          </TabsContent>

          <TabsContent value="verified">
            <DoctorGrid doctors={verifiedDoctors} onVerify={handleVerify} getVerificationBadge={getVerificationBadge} />
          </TabsContent>

          <TabsContent value="rejected">
            <DoctorGrid doctors={rejectedDoctors} onVerify={handleVerify} getVerificationBadge={getVerificationBadge} />
          </TabsContent>
        </Tabs>

        {/* Verification Dialog */}
        <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
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
                className="border-slate-700 text-slate-300 hover:bg-slate-700"
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
  showActions = false
}: { 
  doctors: Doctor[]; 
  onVerify: (doctor: Doctor, approve: boolean) => void;
  getVerificationBadge: (status?: string) => React.ReactNode;
  showActions?: boolean;
}) {
  if (doctors.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-12 text-center">
          <p className="text-slate-400">No doctors found in this category</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {doctors.map((doctor) => (
        <Card key={doctor.id} className="bg-slate-800/50 border-slate-700/50 hover:border-primary/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary-light" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{doctor.name}</h3>
                  <p className="text-sm text-slate-400">{doctor.specialization || "No specialty"}</p>
                </div>
              </div>
              {getVerificationBadge(doctor.verification_status)}
            </div>

            <div className="space-y-2 mb-4 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Mail className="h-4 w-4" />
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
              <div className="flex gap-2">
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
