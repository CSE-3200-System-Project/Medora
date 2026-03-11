"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Ban,
  Unlock,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { getAllPatients, banUser, unbanUser } from "@/lib/admin-actions";

type Patient = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  onboarding_completed: boolean;
  created_at?: string;
  blood_group?: string;
  city?: string;
  account_status?: string;
};

type AdminPatientsClientProps = {
  initialPatients: Patient[];
  initialTotal: number;
  initialPage?: number;
};

export function AdminPatientsClient({ initialPatients, initialTotal, initialPage = 0 }: AdminPatientsClientProps) {
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const limit = 12;
  const hasMounted = useRef(false);

  const [banConfirmDialog, setBanConfirmDialog] = useState<{
    isOpen: boolean;
    patient: Patient | null;
  }>({ isOpen: false, patient: null });

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllPatients(limit, page * limit);
      setPatients(data.patients || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch patients:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, page]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    void fetchPatients();
  }, [fetchPatients]);

  const filteredPatients = patients.filter(
    (patient) => patient.name.toLowerCase().includes(search.toLowerCase()) || patient.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / limit);

  const handleBan = async (patient: Patient) => {
    setBanConfirmDialog({ isOpen: true, patient });
  };

  const confirmBan = async () => {
    if (!banConfirmDialog.patient) return;
    try {
      await banUser(banConfirmDialog.patient.id);
      setPatients((previousPatients) =>
        previousPatients.map((patient) =>
          patient.id === banConfirmDialog.patient?.id
            ? { ...patient, account_status: "banned" }
            : patient,
        ),
      );
      setBanConfirmDialog({ isOpen: false, patient: null });
    } catch {
      alert("Failed to ban user");
    }
  };

  const handleUnban = async (patient: Patient) => {
    try {
      await unbanUser(patient.id);
      setPatients((previousPatients) =>
        previousPatients.map((existingPatient) =>
          existingPatient.id === patient.id
            ? { ...existingPatient, account_status: "active" }
            : existingPatient,
        ),
      );
    } catch {
      alert("Failed to unban user");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      <AdminNavbar />

      <main className="p-4 sm:p-6 max-w-400 mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">Patient Management</h1>
          <p className="text-slate-400">View and manage patient accounts</p>
        </div>

        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-700/80 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>
          <div className="text-slate-400 text-sm">
            Total Patients: <span className="text-white font-semibold">{total}</span>
          </div>
        </div>

        {loading ? (
          <Card className="bg-slate-700/60 border-slate-600/50">
            <CardContent className="p-12 text-center">
              <p className="text-slate-400">Loading patients...</p>
            </CardContent>
          </Card>
        ) : filteredPatients.length === 0 ? (
          <Card className="bg-slate-700/60 border-slate-600/50">
            <CardContent className="p-12 text-center">
              <p className="text-slate-400">No patients found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
              {filteredPatients.map((patient) => (
                <Card key={patient.id} className="bg-slate-700/60 border-slate-600/50 hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                          <User className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{patient.name}</h3>
                          {patient.blood_group && <p className="text-sm text-slate-400">{patient.blood_group}</p>}
                        </div>
                      </div>
                      {patient.onboarding_completed ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          <XCircle className="h-3 w-3 mr-1" />
                          Incomplete
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-slate-400 min-w-0">
                        <Mail className="h-4 w-4 shrink-0" />
                        <span className="truncate">{patient.email}</span>
                      </div>
                      {patient.phone && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Phone className="h-4 w-4" />
                          <span>{patient.phone}</span>
                        </div>
                      )}
                      {patient.city && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <MapPin className="h-4 w-4" />
                          <span>{patient.city}</span>
                        </div>
                      )}
                      {patient.created_at && (
                        <div className="text-xs text-slate-500 mt-2">Joined: {new Date(patient.created_at).toLocaleDateString()}</div>
                      )}
                    </div>

                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-600/50 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 sm:justify-between">
                      {patient.account_status === "banned" ? (
                        <>
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            <Ban className="h-3 w-3 mr-1" />
                            Banned
                          </Badge>
                          <Button size="sm" onClick={() => handleUnban(patient)} className="bg-green-600 hover:bg-green-700">
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
                            onClick={() => handleBan(patient)}
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-slate-400 text-sm">
                  Page {page + 1} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}

        <ConfirmationDialog
          isOpen={banConfirmDialog.isOpen}
          onClose={() => setBanConfirmDialog({ isOpen: false, patient: null })}
          onConfirm={confirmBan}
          title="Ban Patient"
          description={`Are you sure you want to ban ${banConfirmDialog.patient?.name}? They will no longer be able to access their account.`}
          confirmText="Ban User"
          variant="danger"
        />
      </main>
    </div>
  );
}

