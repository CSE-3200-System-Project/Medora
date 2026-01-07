"use client";

import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyAppointments } from "@/lib/appointment-actions";
import { Calendar, Clock, User, FileText } from "lucide-react";

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const data = await getMyAppointments();
      setAppointments(data);
    } catch (error) {
      console.error("Failed to load appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-primary-more-light to-accent">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 md:pt-28">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">My Appointments</h1>
          <p className="text-muted-foreground mt-2">
            Track your upcoming and past consultations
          </p>
        </div>

        {loading ? (
             <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
             </div>
        ) : appointments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">No appointments found</p>
              <p className="text-muted-foreground">Book an appointment with a doctor to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map((appt) => (
              <Card key={appt.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-3">
                         <div className="flex items-center gap-2">
                             <Badge variant={appt.status === 'CONFIRMED' ? 'default' : 'secondary'}>
                                {appt.status}
                             </Badge>
                             <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(appt.appointment_date).toLocaleDateString()}
                             </span>
                         </div>
                         
                         <div>
                             <h3 className="font-bold text-lg text-foreground">{appt.reason}</h3>
                             <p className="text-sm text-muted-foreground mt-1">
                                {appt.notes}
                             </p>
                         </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 justify-center border-l md:pl-6 border-border/50">
                        {/* Actions could go here, e.g. Cancel */}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
