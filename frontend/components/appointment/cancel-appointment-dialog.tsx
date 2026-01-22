"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XCircle, Clock, User, Calendar, Loader2 } from "lucide-react";

interface CancelAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    doctor_name?: string;
    doctor_title?: string;
    patient_name?: string;
    appointment_date: string;
    slot_time?: string | null;
    reason?: string;
  } | null;
  onConfirm: (appointmentId: string, cancellationReason?: string) => Promise<void>;
  userRole?: 'patient' | 'doctor';
}

export function CancelAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onConfirm,
  userRole = 'patient',
}: CancelAppointmentDialogProps) {
  const [cancellationReason, setCancellationReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    if (!appointment) return;
    
    setLoading(true);
    try {
      await onConfirm(appointment.id, cancellationReason || undefined);
      setCancellationReason("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const displayName = userRole === 'patient' 
    ? `${appointment?.doctor_title || 'Dr.'} ${appointment?.doctor_name || 'Doctor'}`
    : appointment?.patient_name || 'Patient';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            Cancel Appointment
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this appointment? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <div className="space-y-4">
            {/* Appointment Summary */}
            <div className="bg-accent/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-primary" />
                <p className="font-semibold text-foreground">{displayName}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(appointment.appointment_date)}</span>
              </div>
              {appointment.slot_time && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Clock className="w-4 h-4" />
                  <span>{appointment.slot_time}</span>
                </div>
              )}
              {appointment.reason && (
                <p className="text-sm text-muted-foreground mt-2 border-t border-border/50 pt-2">
                  {appointment.reason}
                </p>
              )}
            </div>

            {/* Cancellation Reason */}
            <div className="space-y-2">
              <Label htmlFor="cancellation-reason" className="text-sm font-medium">
                Reason for cancellation (optional)
              </Label>
              <Textarea
                id="cancellation-reason"
                placeholder="Let them know why you're cancelling..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Keep Appointment
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel Appointment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
