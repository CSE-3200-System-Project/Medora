"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScrollContainer } from "@/components/ui/table";
import { Calendar, User, Search, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { getAllAppointments, overrideAppointmentStatus } from "@/lib/admin-actions";
import { parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils";

type Appointment = {
  id: string;
  appointment_date: string;
  status: string;
  reason?: string;
  doctor: {
    id?: string;
    name: string;
  };
  patient: {
    id?: string;
    name: string;
  };
};

type AdminAppointmentsClientProps = {
  initialAppointments: Appointment[];
  initialTotal: number;
  initialPage?: number;
};

export function AdminAppointmentsClient({ initialAppointments, initialTotal, initialPage = 0 }: AdminAppointmentsClientProps) {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const hasMounted = useRef(false);
  const [overridingId, setOverridingId] = useState<string | null>(null);
  const limit = 10;

  const handleOverrideStatus = async (appointmentId: string, newStatus: string) => {
    setOverridingId(appointmentId);
    try {
      await overrideAppointmentStatus(appointmentId, newStatus, "Admin override");
      await fetchAppointments();
    } catch (error) {
      console.error("Failed to override status:", error);
    } finally {
      setOverridingId(null);
    }
  };

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllAppointments(limit, page * limit);
      setAppointments(data.appointments || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, page]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    void fetchAppointments();
  }, [fetchAppointments]);

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "confirmed":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Confirmed</Badge>;
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
      case "pending_admin_review":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Admin Review</Badge>;
      case "pending_doctor_confirmation":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Doctor Confirm</Badge>;
      case "pending_patient_confirmation":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Patient Confirm</Badge>;
      case "reschedule_requested":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Reschedule</Badge>;
      case "cancel_requested":
        return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">Cancel Req</Badge>;
      case "no_show":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">No Show</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>;
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch = apt.doctor.name.toLowerCase().includes(search.toLowerCase()) || apt.patient.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(total / limit);

  const statuses = [
    "all", "pending", "confirmed", "completed", "cancelled",
    "pending_admin_review", "reschedule_requested", "no_show",
  ];
  const statusCounts: Record<string, number> = { all: appointments.length };
  for (const s of statuses.filter((s) => s !== "all")) {
    statusCounts[s] = appointments.filter((a) => a.status === s).length;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      <AdminNavbar />

      <main className="p-4 sm:p-6 max-w-400 mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">Appointment Management</h1>
          <p className="text-slate-400">View and monitor all platform appointments</p>
        </div>

        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by doctor or patient name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-700/80 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>

          <div className="lg:hidden">
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 bg-slate-700/80 border-slate-600 text-white"
              aria-label="Filter appointments by status"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status as keyof typeof statusCounts]})
                </option>
              ))}
            </Select>
          </div>

          <div className="hidden lg:flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={`border-slate-600 ${
                  statusFilter === status ? "bg-primary text-white border-primary" : "text-slate-300 hover:bg-slate-700/60"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status as keyof typeof statusCounts]})
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <Card className="bg-slate-700/60 border-slate-600/50">
            <CardContent className="p-12 text-center">
              <p className="text-slate-400">Loading appointments...</p>
            </CardContent>
          </Card>
        ) : filteredAppointments.length === 0 ? (
          <Card className="bg-slate-700/60 border-slate-600/50">
            <CardContent className="p-12 text-center">
              <p className="text-slate-400">No appointments found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3 sm:space-y-4 mb-6 lg:hidden">
              {filteredAppointments.map((appointment) => (
                <Card key={appointment.id} className="bg-slate-700/60 border-slate-600/50 hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                          <Calendar className="h-6 w-6 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{new Date(appointment.appointment_date).toLocaleDateString()}</p>
                          <p className="text-sm text-slate-400">
                            {new Date(appointment.appointment_date).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 text-purple-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400">Patient</p>
                          <p className="text-sm sm:text-base text-white font-medium truncate">{appointment.patient.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400">Doctor</p>
                          <p className="text-sm sm:text-base text-white font-medium truncate">{appointment.doctor.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-start sm:justify-between lg:justify-end">{getStatusBadge(appointment.status)}</div>
                    </div>

                    {appointment.reason && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50">
                        {(() => {
                          const { consultationType, appointmentType } = parseCompositeReason(appointment.reason || "");
                          const ct = humanizeConsultationType(consultationType);
                          const at = humanizeAppointmentType(appointmentType);

                          return (
                            <p className="text-sm text-slate-400">
                              <span className="font-medium">Reason:</span> {ct || appointment.reason}
                              {at ? ` - ${at}` : ""}
                            </p>
                          );
                        })()}
                      </div>
                    )}

                    {!["completed", "cancelled", "no_show"].includes(appointment.status.toLowerCase()) && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-orange-400" />
                          <span className="text-xs text-slate-400 font-medium">Override:</span>
                          <Select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) handleOverrideStatus(appointment.id, e.target.value);
                            }}
                            disabled={overridingId === appointment.id}
                            className="h-7 text-xs bg-slate-800/60 border-slate-600 text-slate-300 flex-1"
                            aria-label="Override status"
                          >
                            <option value="">
                              {overridingId === appointment.id ? "Updating..." : "Select status..."}
                            </option>
                            <option value="CONFIRMED">Confirm</option>
                            <option value="CANCELLED">Cancel</option>
                            <option value="COMPLETED">Complete</option>
                            <option value="NO_SHOW">No Show</option>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="hidden lg:block mb-6">
              <TableScrollContainer className="border-slate-600/50 bg-slate-700/40">
                <Table>
                  <TableHeader className="bg-slate-800/60 border-slate-600/50">
                    <TableRow className="border-slate-600/50 hover:bg-transparent">
                      <TableHead className="text-slate-300">Date & Time</TableHead>
                      <TableHead className="text-slate-300">Patient</TableHead>
                      <TableHead className="text-slate-300">Doctor</TableHead>
                      <TableHead className="text-slate-300">Reason</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((appointment) => {
                      const { consultationType, appointmentType } = parseCompositeReason(appointment.reason || "");
                      const ct = humanizeConsultationType(consultationType);
                      const at = humanizeAppointmentType(appointmentType);
                      const reasonLabel = appointment.reason ? `${ct || appointment.reason}${at ? ` - ${at}` : ""}` : "N/A";
                      const isTerminal = ["completed", "cancelled", "no_show"].includes(appointment.status.toLowerCase());

                      return (
                        <TableRow key={appointment.id} className="border-slate-600/30 hover:bg-slate-700/40">
                          <TableCell>
                            <p className="text-white font-medium">{new Date(appointment.appointment_date).toLocaleDateString()}</p>
                            <p className="text-xs text-slate-400">
                              {new Date(appointment.appointment_date).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </TableCell>
                          <TableCell className="text-slate-200">{appointment.patient.name}</TableCell>
                          <TableCell className="text-slate-200">{appointment.doctor.name}</TableCell>
                          <TableCell className="text-slate-300 wrap-break-word">{reasonLabel}</TableCell>
                          <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                          <TableCell>
                            {isTerminal ? (
                              <span className="text-xs text-slate-500">—</span>
                            ) : (
                              <Select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) handleOverrideStatus(appointment.id, e.target.value);
                                }}
                                disabled={overridingId === appointment.id}
                                className="h-8 text-xs bg-slate-800/60 border-slate-600 text-slate-300 w-36"
                                aria-label="Override status"
                              >
                                <option value="">
                                  {overridingId === appointment.id ? "Updating..." : "Override..."}
                                </option>
                                <option value="CONFIRMED">Confirm</option>
                                <option value="CANCELLED">Cancel</option>
                                <option value="COMPLETED">Complete</option>
                                <option value="NO_SHOW">No Show</option>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableScrollContainer>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
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
                <div className="text-slate-400 text-sm px-2">
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
      </main>
    </div>
  );
}

