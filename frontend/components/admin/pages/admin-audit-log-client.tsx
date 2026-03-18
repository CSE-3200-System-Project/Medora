"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScrollContainer,
} from "@/components/ui/table";
import {
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { getAuditLogs } from "@/lib/admin-actions";

type AuditLog = {
  id: string;
  appointment_id: string;
  action_type: string;
  performed_by_id: string;
  performed_by_role: string;
  previous_status: string | null;
  new_status: string | null;
  notes: string | null;
  timestamp: string;
};

type AdminAuditLogClientProps = {
  initialLogs: AuditLog[];
  initialTotal: number;
};

function getActionBadge(action: string) {
  switch (action) {
    case "created":
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          Created
        </Badge>
      );
    case "status_changed":
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          Status Change
        </Badge>
      );
    case "rescheduled":
      return (
        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
          Rescheduled
        </Badge>
      );
    case "reschedule_requested":
      return (
        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
          Reschedule Req
        </Badge>
      );
    case "reschedule_rejected":
      return (
        <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">
          Reschedule Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          Cancelled
        </Badge>
      );
    case "admin_override":
      return (
        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
          Admin Override
        </Badge>
      );
    default:
      return (
        <Badge className="bg-muted/30 text-muted-foreground border-border/30">
          {action}
        </Badge>
      );
  }
}

function getRoleBadge(role: string) {
  switch (role) {
    case "patient":
      return (
        <Badge
          variant="outline"
          className="border-purple-500/50 text-purple-400"
        >
          Patient
        </Badge>
      );
    case "doctor":
      return (
        <Badge variant="outline" className="border-blue-500/50 text-blue-400">
          Doctor
        </Badge>
      );
    case "admin":
      return (
        <Badge
          variant="outline"
          className="border-orange-500/50 text-orange-400"
        >
          Admin
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="border-border/50 text-muted-foreground"
        >
          {role}
        </Badge>
      );
  }
}

export function AdminAuditLogClient({
  initialLogs,
  initialTotal,
}: AdminAuditLogClientProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(initialTotal);
  const [appointmentFilter, setAppointmentFilter] = useState("");
  const hasMounted = useRef(false);
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs(
        appointmentFilter || undefined,
        limit,
        page * limit
      );
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, appointmentFilter]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    void fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-surface to-background">
      <AdminNavbar />

      <main className="p-4 sm:p-6 max-w-400 mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Audit Log
          </h1>
          <p className="text-muted-foreground">
            Track all appointment status changes and actions
          </p>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by appointment ID..."
              value={appointmentFilter}
              onChange={(e) => {
                setAppointmentFilter(e.target.value);
                setPage(0);
              }}
              className="pl-10 bg-card/80 border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {loading ? (
          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">Loading audit logs...</p>
            </CardContent>
          </Card>
        ) : logs.length === 0 ? (
          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No audit logs found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 mb-6 lg:hidden">
              {logs.map((log) => (
                <Card
                  key={log.id}
                  className="bg-card/60 border-border/50"
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      {getActionBadge(log.action_type)}
                      {getRoleBadge(log.performed_by_role)}
                    </div>
                    {log.previous_status && log.new_status && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {log.previous_status}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-foreground font-medium">
                          {log.new_status}
                        </span>
                      </div>
                    )}
                    {log.notes && (
                      <p className="text-xs text-muted-foreground truncate">
                        {log.notes}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block mb-6">
              <TableScrollContainer className="border-border/50 bg-card/40">
                <Table>
                  <TableHeader className="bg-card/60 border-border/50">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-muted-foreground">
                        Timestamp
                      </TableHead>
                      <TableHead className="text-muted-foreground">Action</TableHead>
                      <TableHead className="text-muted-foreground">
                        Performed By
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Status Change
                      </TableHead>
                      <TableHead className="text-muted-foreground">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="border-border/30 hover:bg-card/40"
                      >
                        <TableCell>
                          <p className="text-foreground text-sm">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action_type)}</TableCell>
                        <TableCell>
                          {getRoleBadge(log.performed_by_role)}
                        </TableCell>
                        <TableCell>
                          {log.previous_status && log.new_status ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="text-muted-foreground">
                                {log.previous_status}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="text-foreground">
                                {log.new_status}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {log.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
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
                  className="border-border text-muted-foreground hover:bg-card"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-muted-foreground text-sm px-2">
                  Page {page + 1} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="border-border text-muted-foreground hover:bg-card"
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

