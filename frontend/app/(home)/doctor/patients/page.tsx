"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDoctorPatients } from "@/lib/appointment-actions";
import { 
  User, 
  Calendar, 
  Clock, 
  Phone, 
  Mail, 
  CheckCircle2, 
  Search,
  Activity,
  ChevronRight
} from "lucide-react";

interface Patient {
  patient_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  profile_photo_url?: string | null;
  age?: number | null;
  gender?: string | null;
  blood_group?: string | null;
  chronic_conditions?: string[];
  total_visits: number;
  last_visit: string;
  last_reason?: string;
}

export default function DoctorPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await getDoctorPatients();
      setPatients(data.patients || []);
    } catch (error) {
      console.error("Failed to load patients:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Filter patients based on search
  const filteredPatients = patients.filter(patient => {
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || 
           patient.email?.toLowerCase().includes(query) ||
           patient.phone?.includes(query);
  });

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto py-8 pt-24 md:pt-28">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Patients</h1>
          <p className="text-muted-foreground mt-2">
            Patients who have completed appointments with you
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search patients by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
        </div>

        {/* Stats Summary */}
        {!loading && patients.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 stagger-enter">
            <Card hoverable className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{patients.length}</p>
                  <p className="text-xs text-muted-foreground">Total Patients</p>
                </div>
              </CardContent>
            </Card>
            <Card hoverable className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {patients.reduce((sum, p) => sum + p.total_visits, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Visits</p>
                </div>
              </CardContent>
            </Card>
            <Card hoverable className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {patients.filter(p => p.chronic_conditions && p.chronic_conditions.length > 0).length}
                  </p>
                  <p className="text-xs text-muted-foreground">With Conditions</p>
                </div>
              </CardContent>
            </Card>
            <Card hoverable className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {patients.filter(p => p.total_visits > 1).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Repeat Patients</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Patient List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-2xl border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 skeleton rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 skeleton rounded w-40" />
                      <div className="h-4 skeleton rounded w-32" />
                      <div className="h-3 skeleton rounded w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : patients.length === 0 ? (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-12 text-center">
              <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No patients yet</h3>
              <p className="text-muted-foreground">
                Patients will appear here after completing their appointments with you.
              </p>
            </CardContent>
          </Card>
        ) : filteredPatients.length === 0 ? (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-8 text-center">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No patients found matching "{searchQuery}"</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 stagger-enter">
            {filteredPatients.map((patient) => (
              <Card 
                key={patient.patient_id} 
                hoverable
                className="rounded-2xl border-border/50 cursor-pointer"
                onClick={() => router.push(`/doctor/patient/${patient.patient_id}`)}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Avatar and Basic Info */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {patient.profile_photo_url ? (
                          <img 
                            src={patient.profile_photo_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-7 h-7 text-primary" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-foreground hover:text-primary">
                            {patient.first_name} {patient.last_name}
                          </h3>
                          <Badge variant="success" className="text-xs">
                            {patient.total_visits} {patient.total_visits === 1 ? 'visit' : 'visits'}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          {patient.age && (
                            <span>{patient.age} years</span>
                          )}
                          {patient.gender && (
                            <span className="capitalize">{patient.gender}</span>
                          )}
                          {patient.blood_group && (
                            <Badge variant="outline" className="text-xs">
                              {patient.blood_group}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Contact Info */}
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {patient.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {patient.phone}
                            </span>
                          )}
                          {patient.email && (
                            <span className="flex items-center gap-1 truncate max-w-48">
                              <Mail className="w-3 h-3" />
                              {patient.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Right Side - Conditions and Last Visit */}
                    <div className="flex flex-col items-start md:items-end gap-2">
                      {patient.chronic_conditions && patient.chronic_conditions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {patient.chronic_conditions.slice(0, 3).map((condition, idx) => (
                            <Badge 
                              key={idx} 
                              variant="secondary" 
                              className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
                            >
                              {condition}
                            </Badge>
                          ))}
                          {patient.chronic_conditions.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{patient.chronic_conditions.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Last visit: {formatDate(patient.last_visit)}</span>
                      </div>
                      
                      {patient.last_reason && (
                        <p className="text-xs text-muted-foreground truncate max-w-48">
                          {patient.last_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </AppBackground>
  );
}