"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { AdminNavbar } from "@/components/admin/admin-navbar";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { Select } from "@/components/ui/select-native";
import { BulkActionsBar } from "../patients/BulkActionsBar";
import { InsightsPanel } from "../patients/InsightsPanel";
import { PatientCharts } from "../patients/PatientCharts";
import { PatientStats } from "../patients/PatientStats";
import { PatientTable } from "../patients/PatientTable";
import type {
  PatientChartsPayload,
  PatientInsightsPayload,
  PatientRecord,
  PatientsListPayload,
  PatientStatsSummary,
  PatientStatusFilter,
} from "@/components/admin/patients/types";
import { toast } from "@/lib/notify";

type AdminPatientsClientProps = {
  initialPatients: PatientRecord[];
  initialTotal: number;
  initialPage?: number;
  initialError?: string | null;
};

type TranslateFn = {
  (key: string, values?: Record<string, string | number>): string;
  raw: (key: string) => string;
};

const textMap: Record<string, string> = {
  "title": "Patient Management",
  "subtitle": "Monitor and manage patient accounts",
  "searchPlaceholder": "Search by name, email or phone",
  "filterAriaLabel": "Filter patients by status",
  "filters.status.all": "All",
  "filters.status.active": "Active",
  "filters.status.incomplete": "Incomplete",
  "filters.status.banned": "Banned",
  "loading": "Loading patients...",
  "empty": "No patients found",
  "loadError": "Failed to load patients",
  "actions.retry": "Retry",
  "actions.addPatient": "Add Patient",
  "actions.viewProfile": "View Profile",
  "actions.editPatient": "Edit Patient",
  "actions.activateAccount": "Toggle Account",
  "actions.activate": "Activate",
  "actions.deactivate": "Deactivate",
  "actions.banPatient": "Ban/Unban",
  "actions.ban": "Ban",
  "actions.unban": "Unban",
  "actions.deletePatient": "Delete",
  "actions.viewReports": "View Reports",
  "status.active": "Active",
  "status.incomplete": "Incomplete",
  "status.banned": "Banned",
  "table.patient": "Patient",
  "table.contact": "Contact",
  "table.status": "Status",
  "table.onboarding": "Onboarding",
  "table.onboardingProgress": "Onboarding Progress",
  "table.joinedDate": "Joined",
  "table.actions": "Actions",
  "table.selectAllPatients": "Select all patients",
  "table.selectPatient": "Select patient",
  "pagination.previous": "Previous",
  "pagination.next": "Next",
  "pagination.page": "Page",
  "stats.totalPatients": "Total Patients",
  "stats.activePatients": "Active Patients",
  "stats.incompleteProfiles": "Incomplete Profiles",
  "stats.bannedPatients": "Banned Patients",
  "charts.growthTitle": "Growth",
  "charts.statusTitle": "Status Distribution",
  "charts.totalLabel": "Total",
  "bulk.selected": "Selected",
  "bulk.activate": "Activate",
  "bulk.ban": "Ban",
  "bulk.delete": "Delete",
  "insights.todaysRegistrations": "Today's Registrations",
  "insights.pendingReviews": "Pending Reviews",
  "insights.recentActivity": "Recent Activity",
  "insights.emptyActivity": "No recent activity",
  "errors.createFailed": "Failed to create patient",
  "errors.updateFailed": "Failed to update patient",
  "errors.deleteFailed": "Failed to delete patient",
  "errors.bulkFailed": "Failed to apply bulk action",
  "messages.createdSuccess": "Patient created successfully",
  "messages.updatedSuccess": "Patient updated successfully",
  "messages.deletedSuccess": "Patient deleted successfully",
  "messages.bulkSuccess": "Bulk action completed",
  "modals.add.title": "Add Patient",
  "modals.add.submit": "Create",
  "modals.common.cancel": "Cancel",
  "modals.common.saving": "Saving...",
  "modals.fields.name": "Name",
  "modals.fields.email": "Email",
  "modals.fields.phone": "Phone",
  "modals.fields.status": "Status",
  "modals.fields.city": "City",
  "modals.fields.bloodGroup": "Blood Group",
  "modals.reports.title": "Medical Reports",
  "modals.reports.empty": "No reports available",
  "modals.reports.unknownReport": "Unknown report",
  "dialogs.ban.title": "Ban Patient",
  "dialogs.ban.description": "Ban {name}?",
  "dialogs.ban.confirm": "Confirm Ban",
  "dialogs.activate.title": "Activate Patient",
  "dialogs.activate.description": "Activate {name}?",
  "dialogs.activate.confirm": "Activate",
  "dialogs.deactivate.title": "Deactivate Patient",
  "dialogs.deactivate.description": "Deactivate {name}?",
  "dialogs.deactivate.confirm": "Deactivate",
  "dialogs.delete.title": "Delete Patient",
  "dialogs.delete.description": "Delete {name}?",
  "dialogs.delete.confirm": "Delete",
  "dialogs.bulk.activateTitle": "Activate Selected Patients",
  "dialogs.bulk.banTitle": "Ban Selected Patients",
  "dialogs.bulk.deleteTitle": "Delete Selected Patients",
  "dialogs.bulk.description": "Apply action to {count} selected patients?",
};

function createTranslator(): TranslateFn {
  const translate = ((key: string, values?: Record<string, string | number>) => {
    const template = textMap[key] || key;
    if (!values) {
      return template;
    }

    return Object.entries(values).reduce((result, [name, value]) => {
      return result.replaceAll(`{${name}}`, String(value));
    }, template);
  }) as TranslateFn;

  translate.raw = (key: string) => textMap[key] || key;
  return translate;
}

type PatientDetail = {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  status: "active" | "banned" | "suspended";
  onboarding_completed: boolean;
  city?: string;
  blood_group?: string;
  created_at?: string;
  updated_at?: string;
  date_of_birth?: string;
  gender?: string;
  medical_reports_count: number;
  medical_tests?: Array<Record<string, unknown>>;
};

type PatientFormState = {
  name: string;
  email: string;
  phone: string;
  status: "active" | "banned";
  city: string;
  bloodGroup: string;
};

const PAGE_SIZE = 12;
const DEFAULT_BAN_REASON = "Moderation action by admin";
const DEFAULT_DELETE_REASON = "Removed by admin";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const fallback = "Request failed";
    let detail = fallback;
    try {
      const payload = await response.json();
      detail = payload?.detail || fallback;
    } catch {
      detail = fallback;
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

type BasicModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

function BasicModal({ open, title, onClose, children, footer }: BasicModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !isMounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isMounted]);

  if (!open || !isMounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label={title}
      />
      <div className="relative z-10 w-full max-w-xl rounded-xl border border-border/70 bg-card p-5 shadow-lg animate-in fade-in zoom-in-95 duration-200 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
        <div className="space-y-4">{children}</div>
        {footer ? <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

function AdminPatientsContent({ initialPatients, initialTotal, initialPage = 1, initialError = null }: AdminPatientsClientProps) {
  const t = createTranslator();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PatientStatusFilter>("all");
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  const [banTarget, setBanTarget] = useState<PatientRecord | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ patient: PatientRecord; action: "activate" | "deactivate" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientRecord | null>(null);
  const [bulkAction, setBulkAction] = useState<"activate" | "ban" | "delete" | null>(null);

  const [addForm, setAddForm] = useState<PatientFormState>({
    name: "",
    email: "",
    phone: "",
    status: "active",
    city: "",
    bloodGroup: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchValue]);

  const patientQueryKey = useMemo(
    () => ["admin-patients", page, PAGE_SIZE, debouncedSearch, statusFilter] as const,
    [page, debouncedSearch, statusFilter],
  );

  const patientsQuery = useQuery<PatientsListPayload>({
    queryKey: patientQueryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search: debouncedSearch,
        status: statusFilter,
      });
      return requestJson<PatientsListPayload>(`/api/admin/patients?${params.toString()}`);
    },
    initialData:
      initialPatients.length > 0
        ? {
            patients: initialPatients,
            total: initialTotal,
            page: Math.max(1, initialPage),
            pageSize: PAGE_SIZE,
          }
        : undefined,
  });

  const detailQuery = useQuery<PatientDetail>({
    queryKey: ["admin-patient-detail", detailId],
    queryFn: () => requestJson<PatientDetail>(`/api/admin/patients/${detailId}`),
    enabled: Boolean(detailId),
  });

  const statsQuery = useQuery<PatientStatsSummary>({
    queryKey: ["admin-patients-stats"],
    queryFn: () => requestJson<PatientStatsSummary>("/api/admin/patients/stats"),
  });

  const chartsQuery = useQuery<PatientChartsPayload>({
    queryKey: ["admin-patients-charts"],
    queryFn: () => requestJson<PatientChartsPayload>("/api/admin/patients/charts"),
  });

  const insightsQuery = useQuery<PatientInsightsPayload>({
    queryKey: ["admin-patients-insights"],
    queryFn: () => requestJson<PatientInsightsPayload>("/api/admin/patients/insights"),
  });

  const invalidateAdminPatientQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-patients"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-patients-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-patients-charts"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-patients-insights"] }),
    ]);
  };

  const createPatientMutation = useMutation({
    mutationFn: (payload: PatientFormState) =>
      requestJson<PatientRecord>("/api/admin/patients", {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          status: payload.status,
          city: payload.city,
          blood_group: payload.bloodGroup,
        }),
      }),
    onSuccess: async () => {
      setIsAddOpen(false);
      setAddForm({ name: "", email: "", phone: "", status: "active", city: "", bloodGroup: "" });
      toast.success(t("messages.createdSuccess"));
      await invalidateAdminPatientQueries();
    },
    onError: () => {
      toast.error(t("errors.createFailed"));
    },
  });

  const patchPatientMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      requestJson(`/api/admin/patients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-patients"] });
      const previous = queryClient.getQueryData<PatientsListPayload>(patientQueryKey);

      if (previous) {
        const action = typeof payload.action === "string" ? payload.action : null;
        const nextPatients = previous.patients.map((item) => {
          if (item.id !== id) {
            return item;
          }

          let nextStatus = item.account_status;
          if (action === "activate" || action === "unban") {
            nextStatus = "active";
          }
          if (action === "ban") {
            nextStatus = "banned";
          }
          if (action === "deactivate") {
            nextStatus = "suspended";
          }

          return {
            ...item,
            account_status: nextStatus,
            first_name: (payload.first_name as string | undefined) ?? item.first_name,
            last_name: (payload.last_name as string | undefined) ?? item.last_name,
            phone: (payload.phone as string | undefined) ?? item.phone,
            city: (payload.city as string | undefined) ?? item.city,
            blood_group: (payload.blood_group as string | undefined) ?? item.blood_group,
            onboarding_completed:
              typeof payload.onboarding_completed === "boolean"
                ? payload.onboarding_completed
                : item.onboarding_completed,
          };
        });

        queryClient.setQueryData<PatientsListPayload>(patientQueryKey, {
          ...previous,
          patients: nextPatients,
        });
      }

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(patientQueryKey, context.previous);
      }
    },
    onSettled: invalidateAdminPatientQueries,
  });

  const deletePatientMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      requestJson(`/api/admin/patients/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: reason || DEFAULT_DELETE_REASON }),
      }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-patients"] });
      const previous = queryClient.getQueryData<PatientsListPayload>(patientQueryKey);

      if (previous) {
        queryClient.setQueryData<PatientsListPayload>(patientQueryKey, {
          ...previous,
          patients: previous.patients.filter((item) => item.id !== id),
          total: Math.max(0, previous.total - 1),
        });
      }

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(patientQueryKey, context.previous);
      }
    },
    onSettled: invalidateAdminPatientQueries,
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: { action: string; patient_ids: string[]; reason?: string }) =>
      requestJson("/api/admin/patients/bulk-action", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onMutate: async ({ action, patient_ids }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-patients"] });
      const previous = queryClient.getQueryData<PatientsListPayload>(patientQueryKey);

      if (previous) {
        if (action === "delete") {
          queryClient.setQueryData<PatientsListPayload>(patientQueryKey, {
            ...previous,
            patients: previous.patients.filter((item) => !patient_ids.includes(item.id)),
            total: Math.max(0, previous.total - patient_ids.length),
          });
        } else {
          queryClient.setQueryData<PatientsListPayload>(patientQueryKey, {
            ...previous,
            patients: previous.patients.map((item) => {
              if (!patient_ids.includes(item.id)) {
                return item;
              }
              return {
                ...item,
                account_status: action === "ban" ? "banned" : "active",
              };
            }),
          });
        }
      }

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(patientQueryKey, context.previous);
      }
    },
    onSuccess: () => setSelectedIds([]),
    onSettled: invalidateAdminPatientQueries,
  });

  const patients = useMemo(() => patientsQuery.data?.patients || [], [patientsQuery.data?.patients]);
  const total = patientsQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeSelectedIds = useMemo(
    () => selectedIds.filter((id) => patients.some((patient) => patient.id === id)),
    [selectedIds, patients],
  );

  const isMutating =
    patchPatientMutation.isPending ||
    deletePatientMutation.isPending ||
    bulkMutation.isPending ||
    createPatientMutation.isPending;

  const handleToggleOne = (patientId: string, selected: boolean) => {
    setSelectedIds((previous) => {
      if (selected) {
        return Array.from(new Set([...previous, patientId]));
      }
      return previous.filter((id) => id !== patientId);
    });
  };

  const handleToggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(patients.map((patient) => patient.id));
  };

  const runPatchAction = async (patient: PatientRecord, action: string) => {
    const payload: Record<string, unknown> = { action };
    if (action === "ban") {
      payload.reason = DEFAULT_BAN_REASON;
    }

    try {
      await patchPatientMutation.mutateAsync({
        id: patient.id,
        payload,
      });
      toast.success(t("messages.updatedSuccess"));
    } catch {
      toast.error(t("errors.updateFailed"));
    }
  };

  const handlePageChange = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    setPage(safePage);
  };

  const statsFallback: PatientStatsSummary = {
    total,
    active: patients.filter((item) => item.account_status === "active" && item.onboarding_completed).length,
    incomplete: patients.filter((item) => item.account_status !== "banned" && !item.onboarding_completed).length,
    banned: patients.filter((item) => item.account_status === "banned").length,
  };

  const chartsFallback: PatientChartsPayload = {
    growth: [],
    distribution: [
      { name: t("status.active"), value: statsFallback.active, color: "#1D63D6" },
      { name: t("status.incomplete"), value: statsFallback.incomplete, color: "#D97706" },
      { name: t("status.banned"), value: statsFallback.banned, color: "#DC2626" },
    ],
  };

  const insightsFallback: PatientInsightsPayload = {
    todaysRegistrations: 0,
    pendingReviews: statsFallback.incomplete,
    recentActivity: [],
  };

  return (
    <>
      <AdminNavbar />

      <main className="mx-auto max-w-7xl space-y-6 p-4 pt-(--nav-content-offset) sm:p-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground md:text-base">{t("subtitle")}</p>
        </section>

        <PatientStats
          stats={statsQuery.data || statsFallback}
          labels={{
            total: t("stats.totalPatients"),
            active: t("stats.activePatients"),
            incomplete: t("stats.incompleteProfiles"),
            banned: t("stats.bannedPatients"),
          }}
        />

        <PatientCharts
          charts={chartsQuery.data || chartsFallback}
          labels={{
            growthTitle: t("charts.growthTitle"),
            statusTitle: t("charts.statusTitle"),
            totalLabel: t("charts.totalLabel"),
          }}
        />

        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full sm:max-w-md"
              />
              <Select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as PatientStatusFilter);
                  setPage(1);
                }}
                aria-label={t("filterAriaLabel")}
                className="w-full sm:w-55"
              >
                <option value="all">{t("filters.status.all")}</option>
                <option value="active">{t("filters.status.active")}</option>
                <option value="incomplete">{t("filters.status.incomplete")}</option>
                <option value="banned">{t("filters.status.banned")}</option>
              </Select>
            </div>

            <Button type="button" onClick={() => setIsAddOpen(true)} className="touch-target lg:shrink-0">
              <UserPlus className="mr-2 h-4 w-4" />
              {t("actions.addPatient")}
            </Button>
          </div>
        </section>

        {initialError ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{initialError || t("loadError")}</p>
            <Button type="button" variant="outline" onClick={() => router.refresh()}>
              {t("actions.retry")}
            </Button>
          </section>
        ) : null}

        <BulkActionsBar
          selectedCount={activeSelectedIds.length}
          labels={{
            selected: t("bulk.selected"),
            activate: t("bulk.activate"),
            ban: t("bulk.ban"),
            delete: t("bulk.delete"),
          }}
          onActivate={() => setBulkAction("activate")}
          onBan={() => setBulkAction("ban")}
          onDelete={() => setBulkAction("delete")}
          disabled={isMutating}
        />

        {patientsQuery.isLoading ? (
          <Card className="rounded-2xl border-border/60">
            <CardContent className="space-y-4 py-6">
              <div className="flex items-center justify-center">
                <MedoraLoader size="md" label={t("loading")} />
              </div>
              <CardSkeleton />
              <CardSkeleton />
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl">
            <PatientTable
              patients={patients}
              selectedIds={activeSelectedIds}
              onToggleAll={handleToggleAll}
              onToggleOne={handleToggleOne}
              columns={{
                patient: t("table.patient"),
                contact: t("table.contact"),
                status: t("table.status"),
                onboarding: t("table.onboarding"),
                joinedDate: t("table.joinedDate"),
                actions: t("table.actions"),
              }}
              labels={{
                active: t("status.active"),
                incomplete: t("status.incomplete"),
                banned: t("status.banned"),
                onboarding: t("table.onboardingProgress"),
                selectAllPatients: t("table.selectAllPatients"),
                selectPatient: String(t.raw("table.selectPatient")),
                viewProfile: t("actions.viewProfile"),
                editPatient: t("actions.editPatient"),
                toggleActive: t("actions.activateAccount"),
                activate: t("actions.activate"),
                deactivate: t("actions.deactivate"),
                toggleBan: t("actions.banPatient"),
                ban: t("actions.ban"),
                unban: t("actions.unban"),
                deletePatient: t("actions.deletePatient"),
                viewReports: t("actions.viewReports"),
                empty: t("empty"),
                previous: t("pagination.previous"),
                next: t("pagination.next"),
                page: t("pagination.page"),
              }}
              page={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onViewProfile={(patient) => {
                router.push(`/admin/patients/${patient.id}/profile`);
              }}
              onEditPatient={(patient) => {
                router.push(`/admin/patients/${patient.id}/edit`);
              }}
              onToggleActive={(patient) => {
                const action = patient.account_status === "active" ? "deactivate" : "activate";
                setStatusTarget({ patient, action });
              }}
              onToggleBan={(patient) => {
                if (patient.account_status === "banned") {
                  void runPatchAction(patient, "unban");
                  return;
                }
                setBanTarget(patient);
              }}
              onDeletePatient={(patient) => setDeleteTarget(patient)}
              onViewReports={(patient) => {
                setDetailId(patient.id);
                setIsReportsOpen(true);
              }}
            />
          </div>
        )}

        <InsightsPanel
          insights={insightsQuery.data || insightsFallback}
          labels={{
            todaysRegistrations: t("insights.todaysRegistrations"),
            pendingReviews: t("insights.pendingReviews"),
            recentActivity: t("insights.recentActivity"),
            emptyActivity: t("insights.emptyActivity"),
          }}
        />
      </main>

      <BasicModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={t("modals.add.title")}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
              {t("modals.common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={createPatientMutation.isPending || !addForm.name || !addForm.email}
              onClick={() => {
                createPatientMutation.mutate(addForm);
              }}
            >
              {createPatientMutation.isPending ? t("modals.common.saving") : t("modals.add.submit")}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="add-name">{t("modals.fields.name")}</Label>
            <Input id="add-name" value={addForm.name} onChange={(event) => setAddForm((prev) => ({ ...prev, name: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-email">{t("modals.fields.email")}</Label>
            <Input id="add-email" type="email" value={addForm.email} onChange={(event) => setAddForm((prev) => ({ ...prev, email: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-phone">{t("modals.fields.phone")}</Label>
            <Input id="add-phone" value={addForm.phone} onChange={(event) => setAddForm((prev) => ({ ...prev, phone: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-status">{t("modals.fields.status")}</Label>
            <Select id="add-status" value={addForm.status} onChange={(event) => setAddForm((prev) => ({ ...prev, status: event.target.value as "active" | "banned" }))}>
              <option value="active">{t("status.active")}</option>
              <option value="banned">{t("status.banned")}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-city">{t("modals.fields.city")}</Label>
            <Input id="add-city" value={addForm.city} onChange={(event) => setAddForm((prev) => ({ ...prev, city: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-blood">{t("modals.fields.bloodGroup")}</Label>
            <Input id="add-blood" value={addForm.bloodGroup} onChange={(event) => setAddForm((prev) => ({ ...prev, bloodGroup: event.target.value }))} />
          </div>
        </div>
      </BasicModal>

      <BasicModal
        open={isReportsOpen}
        onClose={() => {
          setIsReportsOpen(false);
          setDetailId(null);
        }}
        title={t("modals.reports.title")}
      >
        {detailQuery.isLoading || !detailQuery.data ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <MedoraLoader size="sm" label={t("loading")} />
            </div>
            <CardSkeleton className="h-16" />
          </div>
        ) : detailQuery.data.medical_tests && detailQuery.data.medical_tests.length > 0 ? (
          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-3 text-sm">
            {detailQuery.data.medical_tests.map((test, index) => (
              <li key={`${detailQuery.data.id}-test-${index}`} className="rounded-md border border-border/50 p-2">
                <p className="font-medium text-foreground">{String(test.test_name || test.name || t("modals.reports.unknownReport"))}</p>
                <p className="text-xs text-muted-foreground">{String(test.test_date || test.date || "-")}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("modals.reports.empty")}</p>
        )}
      </BasicModal>

      <ConfirmationDialog
        isOpen={banTarget !== null}
        onClose={() => setBanTarget(null)}
        onConfirm={() => {
          if (!banTarget) return;
          void runPatchAction(banTarget, "ban");
          setBanTarget(null);
        }}
        title={t("dialogs.ban.title")}
        description={t("dialogs.ban.description", { name: banTarget?.name || "" })}
        confirmText={t("dialogs.ban.confirm")}
        isLoading={patchPatientMutation.isPending}
        variant="danger"
      />

      <ConfirmationDialog
        isOpen={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => {
          if (!statusTarget) return;
          void runPatchAction(statusTarget.patient, statusTarget.action);
          setStatusTarget(null);
        }}
        title={statusTarget?.action === "activate" ? t("dialogs.activate.title") : t("dialogs.deactivate.title")}
        description={
          statusTarget?.action === "activate"
            ? t("dialogs.activate.description", { name: statusTarget?.patient?.name || "" })
            : t("dialogs.deactivate.description", { name: statusTarget?.patient?.name || "" })
        }
        confirmText={statusTarget?.action === "activate" ? t("dialogs.activate.confirm") : t("dialogs.deactivate.confirm")}
        isLoading={patchPatientMutation.isPending}
        variant="warning"
      />

      <ConfirmationDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePatientMutation.mutate({ id: deleteTarget.id, reason: DEFAULT_DELETE_REASON }, {
            onError: () => {
              toast.error(t("errors.deleteFailed"));
            },
            onSuccess: () => {
              toast.success(t("messages.deletedSuccess"));
            },
          });
          setDeleteTarget(null);
        }}
        title={t("dialogs.delete.title")}
        description={t("dialogs.delete.description", { name: deleteTarget?.name || "" })}
        confirmText={t("dialogs.delete.confirm")}
        isLoading={deletePatientMutation.isPending}
        variant="danger"
      />

      <ConfirmationDialog
        isOpen={bulkAction !== null}
        onClose={() => setBulkAction(null)}
        onConfirm={() => {
          if (!bulkAction || activeSelectedIds.length === 0) return;
          const reason =
            bulkAction === "ban"
              ? DEFAULT_BAN_REASON
              : bulkAction === "delete"
              ? DEFAULT_DELETE_REASON
              : undefined;

          bulkMutation.mutate(
            {
              action: bulkAction,
              patient_ids: activeSelectedIds,
              reason,
            },
            {
              onError: () => {
                toast.error(t("errors.bulkFailed"));
              },
              onSuccess: () => {
                toast.success(t("messages.bulkSuccess"));
              },
            },
          );
          setBulkAction(null);
        }}
        title={
          bulkAction === "activate"
            ? t("dialogs.bulk.activateTitle")
            : bulkAction === "ban"
            ? t("dialogs.bulk.banTitle")
            : t("dialogs.bulk.deleteTitle")
        }
        description={t("dialogs.bulk.description", { count: activeSelectedIds.length })}
        confirmText={
          bulkAction === "activate"
            ? t("bulk.activate")
            : bulkAction === "ban"
            ? t("bulk.ban")
            : t("bulk.delete")
        }
        isLoading={bulkMutation.isPending}
        variant={bulkAction === "delete" ? "danger" : "warning"}
      />
    </>
  );
}

export function AdminPatientsClient(props: AdminPatientsClientProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AdminPatientsContent {...props} />
    </QueryClientProvider>
  );
}
