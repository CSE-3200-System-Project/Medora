"use client";

import React, { useEffect, useState } from "react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { getAllAppointments } from "@/lib/admin-actions";

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

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchAppointments();
  }, [page]);

  const fetchAppointments = async () => {
    try {
      const data = await getAllAppointments(limit, page * limit);
      setAppointments(data.appointments || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Confirmed</Badge>;
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>;
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = 
      apt.doctor.name.toLowerCase().includes(search.toLowerCase()) ||
      apt.patient.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(total / limit);

  const statuses = ["all", "pending", "confirmed", "completed", "cancelled"];
  const statusCounts = {
    all: appointments.length,
    pending: appointments.filter(a => a.status === "pending").length,
    confirmed: appointments.filter(a => a.status === "confirmed").length,
    completed: appointments.filter(a => a.status === "completed").length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AdminNavbar />
      
      <main className="p-4 md:p-6 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Appointment Management
          </h1>
          <p className="text-slate-400">
            View and monitor all platform appointments
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by doctor or patient name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-700/80 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
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
                {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status as keyof typeof statusCounts]})
              </Button>
            ))}
          </div>
        </div>

        {/* Appointments List */}
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
            <div className="space-y-4 mb-6">
              {filteredAppointments.map((appointment) => (
                <Card key={appointment.id} className="bg-slate-700/60 border-slate-600/50 hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      {/* Date & Time */}
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">
                            {new Date(appointment.appointment_date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-slate-400">
                            {new Date(appointment.appointment_date).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Patient */}
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-purple-400" />
                        <div>
                          <p className="text-xs text-slate-400">Patient</p>
                          <p className="text-white font-medium">{appointment.patient.name}</p>
                        </div>
                      </div>

                      {/* Doctor */}
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-400" />
                        <div>
                          <p className="text-xs text-slate-400">Doctor</p>
                          <p className="text-white font-medium">{appointment.doctor.name}</p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex items-center justify-between md:justify-end">
                        {getStatusBadge(appointment.status)}
                      </div>
                    </div>

                    {appointment.reason && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <p className="text-sm text-slate-400">
                          <span className="font-medium">Reason:</span> {appointment.reason}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
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
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
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
