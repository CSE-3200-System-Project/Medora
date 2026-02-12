"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { 
  Shield, Eye, Clock, User, AlertCircle, 
  CheckCircle, XCircle, RefreshCw, History,
  Building, ArrowLeft, Stethoscope
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppBackground } from "@/components/ui/app-background"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { 
  getMyAccessHistory, 
  getMyDoctorAccess, 
  revokeDoctorAccess, 
  restoreDoctorAccess 
} from "@/lib/patient-access-actions"

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

export default function PatientPrivacyPage() {
  const router = useRouter()
  
  const [accessHistory, setAccessHistory] = useState<AccessHistoryItem[]>([])
  const [doctorAccess, setDoctorAccess] = useState<DoctorAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'doctors' | 'history'>('doctors')
  
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
    } catch (err: any) {
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRevokeAccess = async () => {
    try {
      await revokeDoctorAccess(confirmDialog.doctorId)
      // Update local state
      setDoctorAccess(prev => 
        prev.map(d => 
          d.doctor_id === confirmDialog.doctorId 
            ? { ...d, access_status: 'revoked', revoked_at: new Date().toISOString() }
            : d
        )
      )
    } catch (err: any) {
      alert(err.message || "Failed to revoke access")
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    }
  }

  const handleRestoreAccess = async () => {
    try {
      await restoreDoctorAccess(confirmDialog.doctorId)
      // Update local state
      setDoctorAccess(prev => 
        prev.map(d => 
          d.doctor_id === confirmDialog.doctorId 
            ? { ...d, access_status: 'active', revoked_at: null }
            : d
        )
      )
    } catch (err: any) {
      alert(err.message || "Failed to restore access")
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    }
  }

  const openConfirmDialog = (type: 'revoke' | 'restore', doctorId: string, doctorName: string) => {
    setConfirmDialog({ isOpen: true, type, doctorId, doctorName })
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
      <AppBackground>
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Loading privacy settings...</p>
          </div>
        </div>
      </AppBackground>
    )
  }

  return (
    <AppBackground className="animate-page-enter">
      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.type === 'revoke' ? handleRevokeAccess : handleRestoreAccess}
        title={confirmDialog.type === 'revoke' ? 'Revoke Doctor Access?' : 'Restore Doctor Access?'}
        description={
          confirmDialog.type === 'revoke'
            ? `${confirmDialog.doctorName} will no longer be able to view your medical records. You can restore access later if needed.`
            : `${confirmDialog.doctorName} will be able to view your medical records again.`
        }
        confirmText={confirmDialog.type === 'revoke' ? 'Revoke Access' : 'Restore Access'}
        variant={confirmDialog.type === 'revoke' ? 'danger' : 'info'}
      />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Privacy & Data Access</h1>
              <p className="text-muted-foreground">Manage who can view your medical records</p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Your data is protected</p>
                <p>Only doctors you have appointments with can access your medical records. You&apos;ll be notified whenever a doctor views your data, and you can revoke their access at any time.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'doctors' ? 'default' : 'outline'}
            onClick={() => setActiveTab('doctors')}
            className="flex items-center gap-2"
          >
            <Stethoscope className="w-4 h-4" />
            Doctor Access
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            Access History
          </Button>
        </div>

        {/* Content */}
        {activeTab === 'doctors' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Doctors with Access</h2>
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
                  <Card key={doctor.doctor_id} className={doctor.access_status === 'revoked' ? 'opacity-60' : ''}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                            {doctor.doctor_photo_url ? (
                              <img 
                                src={doctor.doctor_photo_url} 
                                alt={doctor.doctor_name}
                                className="w-full h-full object-cover"
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
                              <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full flex items-center gap-1">
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
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Active
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
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
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Access History</h2>
              <Button variant="ghost" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
            
            {accessHistory.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No access history yet</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {accessHistory.map((item) => (
                      <div key={item.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                            {item.doctor_photo_url ? (
                              <img 
                                src={item.doctor_photo_url} 
                                alt={item.doctor_name}
                                className="w-full h-full object-cover"
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
                            {new Date(item.accessed_at).toLocaleTimeString()}
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
