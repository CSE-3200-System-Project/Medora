"use client";

import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyAppointments, updateAppointment } from "@/lib/appointment-actions";
import { Calendar, Clock, User, CheckCircle2, XCircle } from "lucide-react";

export default function DoctorAppointmentsPage() {
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
  
  const handleStatusUpdate = async (id: string, status: string) => {
      try {
          await updateAppointment(id, { status });
          loadAppointments(); // Refresh
      } catch (err) {
          alert("Failed to update status");
      }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-primary-more-light to-accent">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 md:pt-28">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Appointments Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your patient bookings and schedule
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
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appt) => (
              <Card key={appt.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-3">
                         <div className="flex items-center gap-2">
                             <Badge variant={appt.status === 'CONFIRMED' ? 'default' : appt.status === 'PENDING' ? 'outline' : 'secondary'}>
                                {appt.status}
                             </Badge>
                             <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(appt.appointment_date).toLocaleDateString()}
                             </span>
                         </div>
                         
                         <div>
                             <h3 className="font-bold text-lg text-foreground">{appt.reason}</h3>
                              <p className="text-sm font-semibold text-primary mt-1">Patient ID: {appt.patient_id}</p>
                             <p className="text-sm text-muted-foreground mt-1">
                                {appt.notes}
                             </p>
                         </div>
                    </div>
                    
                    <div className="flex items-center gap-2 border-l md:pl-6 border-border/50">
                        {appt.status === 'PENDING' && (
                            <>
                                <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleStatusUpdate(appt.id, 'CONFIRMED')}>
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleStatusUpdate(appt.id, 'CANCELLED')}>
                                    <XCircle className="h-4 w-4 mr-1" /> Decline
                                </Button>
                            </>
                        )}
                        {appt.status === 'CONFIRMED' && (
                             <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(appt.id, 'COMPLETED')}>
                                    Mark Complete
                             </Button>
                        )}
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
