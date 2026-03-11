"use client";

import React from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Calendar, Clock, Phone, Mail, CheckCircle2 } from "lucide-react";
import { getDoctorPatients } from "@/lib/appointment-actions";

interface Patient {
  patient_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  photo_url?: string | null;
  total_visits: number;
  last_visit: string;
  first_visit: string;
}

export function DoctorPatientList() {
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loading, setLoading] = React.useState(true);

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

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            My Patients
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-accent/50 rounded-lg animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-200 rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (patients.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            My Patients
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No patients with completed appointments yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Patients will appear here after completing their appointments
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            My Patients
          </span>
          <Badge variant="secondary">{patients.length} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {patients.map((patient) => (
            <div
              key={patient.patient_id}
              className="flex items-start gap-4 p-4 bg-accent/30 hover:bg-accent/50 rounded-xl transition-colors"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {patient.photo_url ? (
                  <Image
                    src={patient.photo_url}
                    alt={`${patient.first_name} ${patient.last_name}`}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <User className="w-6 h-6 text-primary" />
                )}
              </div>

              {/* Patient Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-foreground truncate">
                    {patient.first_name} {patient.last_name}
                  </h4>
                  <Badge variant="success" className="text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {patient.total_visits} {patient.total_visits === 1 ? 'visit' : 'visits'}
                  </Badge>
                </div>

                {/* Contact info */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {patient.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3" />
                      {patient.email}
                    </span>
                  )}
                  {patient.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {patient.phone}
                    </span>
                  )}
                </div>

                {/* Visit dates */}
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    Last: {formatDate(patient.last_visit)}
                  </span>
                  {patient.first_visit !== patient.last_visit && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      First: {formatDate(patient.first_visit)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
