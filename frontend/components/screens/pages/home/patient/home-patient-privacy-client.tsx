"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  Shield, Eye, Clock, User, AlertCircle,
  CheckCircle, XCircle, RefreshCw, History,
  Building, Stethoscope, Settings2,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppBackground } from "@/components/ui/app-background"
import { Navbar } from "@/components/ui/navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { PageLoadingShell } from "@/components/ui/page-loading-shell"
import { CardSkeleton } from "@/components/ui/skeleton-loaders"
import { Switch } from "@/components/ui/switch"
import {
  getMyAccessHistory,
  getMyDoctorAccess,
  revokeDoctorAccess,
  restoreDoctorAccess
} from "@/lib/patient-access-actions"
import {
  listPatientDoctors,
  getSharingForDoctor,
  updateSharingForDoctor,
  bulkUpdateSharing,
} from "@/lib/patient-data-sharing-actions"
import {
  getPatientAIAccess,
  updatePatientAIAccess,
  type PatientAIAccessResponse,
} from "@/lib/patient-ai-access-actions"
import {
  type PatientDoctorListItem,
  type DoctorSharingSummary,
  type SharingCategories,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
} from "@/lib/patient-data-sharing-types"
import { formatMeridiemTime } from "@/lib/utils"
import { useT } from "@/i18n/client"

interface AccessHistoryItem {
  id: string
  doctor_id: string
  doctor_name: string
  doctor_specialization: string | null
  doctor_photo_url: string | null
  access_type: string
  accessed_at: string
}

interface DoctorAccess {
  doctor_id: string
  doctor_name: string
  doctor_specialization: string | null
  doctor_photo_url: string | null
  hospital_name: string | null
  access_status: string
  appointment_count: number
  last_access: string | null
  revoked_at: string | null
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Operation failed"
}

export default function PatientPrivacyPage() {
  const tCommon = useT("common")
  const [accessHistory, setAccessHistory] = useState<AccessHistoryItem[]>([])
  const [doctorAccess, setDoctorAccess] = useState<DoctorAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'sharing' | 'doctors' | 'history'>('sharing')

  // Data sharing state
  const [patientDoctors, setPatientDoctors] = useState<PatientDoctorListItem[]>([])
  const [sharingData, setSharingData] = useState<Record<string, DoctorSharingSummary>>({})
  const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null)
  const [sharingLoading, setSharingLoading] = useState<Record<string, boolean>>({})
  const [loadingSharingList, setLoadingSharingList] = useState(true)
  const [aiAccess, setAiAccess] = useState<PatientAIAccessResponse | null>(null)
  const [aiAccessLoading, setAiAccessLoading] = useState(true)
  const [aiAccessSaving, setAiAccessSaving] = useState<Record<string, boolean>>({})

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    type: 'revoke' | 'restore'
    doctorId: string
    doctorName: string
  }>({
    isOpen: false,
    type: 'revoke',
    doctorId: '',
    doctorName: ''
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [historyData, accessData] = await Promise.all([
        getMyAccessHistory(),
        getMyDoctorAccess()
      ])

      setAccessHistory(historyData.access_history || [])
      setDoctorAccess(accessData.doctors || [])
    } catch (err) {
      console.error("Failed to load privacy data:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSharingData = async () => {
    setLoadingSharingList(true)
    try {
      const doctors = await listPatientDoctors()
      setPatientDoctors(doctors)

      // Load sharing prefs for each doctor
      const sharingMap: Record<string, DoctorSharingSummary> = {}
      await Promise.all(
        doctors.map(async (doc) => {
          try {
            const data = await getSharingForDoctor(doc.doctor_id)
            sharingMap[doc.doctor_id] = data
          } catch {
            // Default all to false if no record exists
          }
        })
      )
      setSharingData(sharingMap)
    } catch (err) {
      console.error("Failed to load sharing data:", err)
    } finally {
      setLoadingSharingList(false)
    }
  }

  const fetchAIAccess = async () => {
    setAiAccessLoading(true)
    try {
      const data = await getPatientAIAccess()
      setAiAccess(data)
    } catch (err) {
      console.error("Failed to load AI access settings:", err)
    } finally {
      setAiAccessLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchSharingData()
    fetchAIAccess()
  }, [])

  const handleToggleAIAccess = async (
    key: "ai_personal_context_enabled" | "ai_general_chat_enabled",
    value: boolean
  ) => {
    setAiAccessSaving(prev => ({ ...prev, [key]: true }))
    try {
      const updated = await updatePatientAIAccess({ [key]: value })
      setAiAccess(updated)
    } catch (err) {
      alert(getErrorMessage(err) || "Failed to update AI access settings")
    } finally {
      setAiAccessSaving(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleRevokeAccess = async () => {
    try {
      await revokeDoctorAccess(confirmDialog.doctorId)
      setDoctorAccess(prev =>
        prev.map(d =>
          d.doctor_id === confirmDialog.doctorId
            ? { ...d, access_status: 'revoked', revoked_at: new Date().toISOString() }
            : d
        )
      )
    } catch (err) {
      alert(getErrorMessage(err) || "Failed to revoke access")
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    }
  }

  const handleRestoreAccess = async () => {
    try {
      await restoreDoctorAccess(confirmDialog.doctorId)
      setDoctorAccess(prev =>
        prev.map(d =>
          d.doctor_id === confirmDialog.doctorId
            ? { ...d, access_status: 'active', revoked_at: null }
            : d
        )
      )
    } catch (err) {
      alert(getErrorMessage(err) || "Failed to restore access")
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    }
  }

  const openConfirmDialog = (type: 'revoke' | 'restore', doctorId: string, doctorName: string) => {
    setConfirmDialog({ isOpen: true, type, doctorId, doctorName })
  }

  const handleToggleCategory = async (
    doctorId: string,
    category: keyof SharingCategories,
    newValue: boolean
  ) => {
    const key = `${doctorId}_${category}`
    setSharingLoading(prev => ({ ...prev, [key]: true }))

    try {
      const updated = await updateSharingForDoctor(doctorId, { [category]: newValue })
      setSharingData(prev => ({
        ...prev,
        [doctorId]: {
          ...prev[doctorId],
          sharing: updated,
        }
      }))
    } catch (err) {
      console.error("Failed to toggle:", err)
    } finally {
      setSharingLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleBulkToggle = async (doctorId: string, shareAll: boolean) => {
    const key = `${doctorId}_bulk`
    setSharingLoading(prev => ({ ...prev, [key]: true }))

    try {
      const updated = await bulkUpdateSharing(doctorId, shareAll)
      setSharingData(prev => ({
        ...prev,
        [doctorId]: {
          ...prev[doctorId],
          sharing: updated,
        }
      }))
    } catch (err) {
      console.error("Failed to bulk toggle:", err)
    } finally {
      setSharingLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const getSharedCount = (doctorId: string): number => {
    const data = sharingData[doctorId]
    if (!data) return 0
    const categoryKeys = Object.keys(CATEGORY_LABELS) as (keyof SharingCategories)[]
    return categoryKeys.filter((key) => Boolean(data.sharing?.[key])).length
  }

  const formatAccessType = (type: string) => {
    const types: Record<string, string> = {
      'view_profile': 'Viewed Profile',
      'view_medical_history': 'Viewed Medical History',
      'view_medications': 'Viewed Medications',
      'view_allergies': 'Viewed Allergies',
      'view_chronic_conditions': 'Viewed Chronic Conditions',
      'view_family_history': 'Viewed Family History',
      'view_full_record': 'Viewed Full Record',
    }
    return types[type] || type
  }

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="container mx-auto max-w-6xl px-4 py-6 pt-(--nav-content-offset)">
          <PageLoadingShell label="Loading privacy settings..." cardCount={4} />
        </main>
      </AppBackground>
    )
  }

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.type === 'revoke' ? handleRevokeAccess : handleRestoreAccess}
        title={confirmDialog.type === 'revoke' ? tCommon("privacy.dialogs.revokeTitle") : tCommon("privacy.dialogs.restoreTitle")}
        description={
          confirmDialog.type === 'revoke'
            ? tCommon("privacy.dialogs.revokeDescription", { doctorName: confirmDialog.doctorName })
            : tCommon("privacy.dialogs.restoreDescription", { doctorName: confirmDialog.doctorName })
        }
        confirmText={confirmDialog.type === 'revoke' ? tCommon("privacy.actions.revokeAccess") : tCommon("privacy.actions.restoreAccess")}
        variant={confirmDialog.type === 'revoke' ? 'danger' : 'info'}
      />

      <div className="container mx-auto max-w-6xl px-4 py-6 pt-(--nav-content-offset)">
        {/* Header */}
        <div className="mb-6">

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{tCommon("privacy.title")}</h1>
              <p className="text-muted-foreground">{tCommon("privacy.subtitle")}</p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <Card className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">You have full control over your data</p>
                <p>Choose exactly which categories of your medical data each doctor can see. Toggle individual categories or share/revoke everything at once. Changes take effect immediately.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <Button
            variant={activeTab === 'sharing' ? 'default' : 'outline'}
            onClick={() => setActiveTab('sharing')}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Settings2 className="w-4 h-4" />
            {tCommon("privacy.tabs.sharing")}
          </Button>
          <Button
            variant={activeTab === 'doctors' ? 'default' : 'outline'}
            onClick={() => setActiveTab('doctors')}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Stethoscope className="w-4 h-4" />
            {tCommon("privacy.tabs.doctors")}
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <History className="w-4 h-4" />
            {tCommon("privacy.tabs.history")}
          </Button>
        </div>

        {/* ─── DATA SHARING TAB ─── */}
        {activeTab === 'sharing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{tCommon("privacy.sharing.perDoctor")}</h2>
              <Button variant="ghost" size="sm" onClick={fetchSharingData}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>

            <Card className="rounded-xl border-primary/25 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tCommon("privacy.aiControls.title")}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage AI access separately for personal-data context and general-purpose chat.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-background/70 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tCommon("privacy.aiControls.personalTitle")}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Category-wise sharing for Chorui AI with doctor-specific controls below.
                      </p>
                    </div>
                    <Switch
                      checked={!!aiAccess?.ai_personal_context_enabled}
                      onCheckedChange={(val) => handleToggleAIAccess("ai_personal_context_enabled", val)}
                      disabled={aiAccessLoading || !!aiAccessSaving["ai_personal_context_enabled"]}
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-background/70 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tCommon("privacy.aiControls.generalTitle")}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Allow patient-only general Chorui chat even when personal information sharing is disabled.
                      </p>
                    </div>
                    <Switch
                      checked={!!aiAccess?.ai_general_chat_enabled}
                      onCheckedChange={(val) => handleToggleAIAccess("ai_general_chat_enabled", val)}
                      disabled={aiAccessLoading || !!aiAccessSaving["ai_general_chat_enabled"]}
                    />
                  </div>
                </div>

                {!aiAccessLoading && !aiAccess?.ai_personal_context_enabled && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                    Personal information sharing for AI is disabled. Doctors cannot retrieve your personal record context through Chorui AI.
                  </div>
                )}
              </CardContent>
            </Card>

            {loadingSharingList ? (
              <Card>
                <CardContent className="space-y-4 py-6">
                  <div className="flex justify-center py-1">
                    <MedoraLoader size="sm" label={tCommon("privacy.loadingDoctors")} />
                  </div>
                  <div className="grid gap-3">
                    <CardSkeleton />
                    <CardSkeleton />
                  </div>
                </CardContent>
              </Card>
            ) : patientDoctors.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">{tCommon("privacy.empty.doctorsTitle")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Doctors you have appointments with will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {patientDoctors.map((doc) => {
                  const isExpanded = expandedDoctor === doc.doctor_id
                  const sharedCount = getSharedCount(doc.doctor_id)
                  const totalCategories = Object.keys(CATEGORY_LABELS).length
                  const allShared = sharedCount === totalCategories
                  const noneShared = sharedCount === 0
                  const sharing = sharingData[doc.doctor_id]?.sharing

                  return (
                    <Card key={doc.doctor_id} className="rounded-xl overflow-hidden">
                      {/* Doctor header - clickable to expand */}
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedDoctor(isExpanded ? null : doc.doctor_id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                            {doc.doctor_photo_url ? (
                              <Image
                                src={doc.doctor_photo_url}
                                alt={doc.doctor_name}
                                width={44}
                                height={44}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <User className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{doc.doctor_name}</h3>
                            {doc.specialization && (
                              <p className="text-sm text-muted-foreground">{doc.specialization}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Sharing summary badge */}
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            allShared
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : noneShared
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}>
                            {sharedCount}/{totalCategories} shared
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Expanded: category toggles */}
                      {isExpanded && (
                        <div className="border-t">
                          {/* Bulk actions */}
                          <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              {tCommon("privacy.sharing.quickActions")}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                                onClick={() => handleBulkToggle(doc.doctor_id, true)}
                                disabled={
                                  !!sharingLoading[`${doc.doctor_id}_bulk`] ||
                                  !aiAccess?.ai_personal_context_enabled
                                }
                              >
                                {sharingLoading[`${doc.doctor_id}_bulk`] ? (
                                  <ButtonLoader className="w-3 h-3" />
                                ) : (
                                  <ToggleRight className="w-3 h-3" />
                                )}
                                {tCommon("privacy.actions.shareAll")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1 text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                                onClick={() => handleBulkToggle(doc.doctor_id, false)}
                                disabled={
                                  !!sharingLoading[`${doc.doctor_id}_bulk`] ||
                                  !aiAccess?.ai_personal_context_enabled
                                }
                              >
                                {sharingLoading[`${doc.doctor_id}_bulk`] ? (
                                  <ButtonLoader className="w-3 h-3" />
                                ) : (
                                  <ToggleLeft className="w-3 h-3" />
                                )}
                                {tCommon("privacy.actions.revokeAll")}
                              </Button>
                            </div>
                          </div>

                          {/* Category list */}
                          <div className="divide-y">
                            {(Object.keys(CATEGORY_LABELS) as (keyof SharingCategories)[]).map(
                              (category) => {
                                const isOn = sharing?.[category] ?? false
                                const loadingKey = `${doc.doctor_id}_${category}`
                                const isToggling = !!sharingLoading[loadingKey]

                                return (
                                  <div
                                    key={category}
                                    className="px-4 py-3 flex items-center justify-between"
                                  >
                                    <div className="pr-4">
                                      <p className="text-sm font-medium text-foreground">
                                        {CATEGORY_LABELS[category]}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {CATEGORY_DESCRIPTIONS[category]}
                                      </p>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-2">
                                      {isToggling && (
                                        <ButtonLoader className="w-3 h-3 text-muted-foreground" />
                                      )}
                                      <Switch
                                        checked={isOn}
                                        onCheckedChange={(val) =>
                                          handleToggleCategory(doc.doctor_id, category, val)
                                        }
                                        disabled={isToggling || !aiAccess?.ai_personal_context_enabled}
                                      />
                                    </div>
                                  </div>
                                )
                              }
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── DOCTOR ACCESS TAB ─── */}
        {activeTab === 'doctors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{tCommon("privacy.doctors.title")}</h2>
              <Button variant="ghost" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>

            {doctorAccess.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No doctors have accessed your records yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {doctorAccess.map((doctor) => (
                  <Card key={doctor.doctor_id} className={`rounded-xl ${doctor.access_status === 'revoked' ? 'opacity-60' : ''}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                            {doctor.doctor_photo_url ? (
                              <Image
                                src={doctor.doctor_photo_url}
                                alt={doctor.doctor_name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <User className="w-6 h-6 text-primary" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{doctor.doctor_name}</h3>
                            {doctor.doctor_specialization && (
                              <p className="text-sm text-muted-foreground">{doctor.doctor_specialization}</p>
                            )}
                            {doctor.hospital_name && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {doctor.hospital_name}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {doctor.access_status === 'revoked' ? (
                            <>
                              <span className="text-xs text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                Revoked
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openConfirmDialog('restore', doctor.doctor_id, doctor.doctor_name)}
                              >
                                Restore
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Active
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                                onClick={() => openConfirmDialog('revoke', doctor.doctor_id, doctor.doctor_name)}
                              >
                                Revoke
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                        <span>{doctor.appointment_count} appointment(s)</span>
                        {doctor.last_access && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Last access: {new Date(doctor.last_access).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── HISTORY TAB ─── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{tCommon("privacy.history.title")}</h2>
              <Button variant="ghost" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>

            {accessHistory.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">{tCommon("privacy.empty.historyTitle")}</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-xl">
                <CardContent className="p-0">
                  <div className="divide-y">
                    {accessHistory.map((item) => (
                      <div key={item.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                            {item.doctor_photo_url ? (
                              <Image
                                src={item.doctor_photo_url}
                                alt={item.doctor_name}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <User className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.doctor_name}</p>
                            <p className="text-xs text-muted-foreground">{formatAccessType(item.access_type)}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.accessed_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatMeridiemTime(item.accessed_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppBackground>
  )
}
