"use client";

import React from "react";
import { Calendar, Clock, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { respondToRescheduleRequest } from "@/lib/appointment-actions";
import { Badge } from "@/components/ui/badge";

interface RescheduleNotificationCardProps {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: {
      appointment_id?: string;
      new_appointment_time?: string;
      doctor_id?: string;
      [key: string]: any;
    };
  };
  doctorName: string;
  onResponseSubmitted?: () => void;
  onError?: (error: string) => void;
}

export function RescheduleNotificationCard({
  notification,
  doctorName,
  onResponseSubmitted,
  onError,
}: RescheduleNotificationCardProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [responded, setResponded] = React.useState(false);
  const [responseResult, setResponseResult] = React.useState<"accepted" | "rejected" | null>(null);

  const appointmentId = notification.data?.appointment_id;
  const newAppointmentTime = notification.data?.new_appointment_time
    ? new Date(notification.data.new_appointment_time).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const handleAccept = async () => {
    if (!appointmentId) {
      onError?.("Appointment ID not found in notification");
      return;
    }

    setIsLoading(true);
    try {
      await respondToRescheduleRequest(appointmentId, true);
      setResponded(true);
      setResponseResult("accepted");
      onResponseSubmitted?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to accept reschedule";
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!appointmentId) {
      onError?.("Appointment ID not found in notification");
      return;
    }

    setIsLoading(true);
    try {
      await respondToRescheduleRequest(appointmentId, false);
      setResponded(true);
      setResponseResult("rejected");
      onResponseSubmitted?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject reschedule";
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (responded && responseResult) {
    return (
      <Card className="border-border/60 bg-surface/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {responseResult === "accepted" ? (
              <>
                <Check className="h-5 w-5 text-success" />
                Reschedule Accepted
              </>
            ) : (
              <>
                <X className="h-5 w-5 text-destructive" />
                Reschedule Rejected
              </>
            )}
          </CardTitle>
          <CardDescription>
            {responseResult === "accepted"
              ? `You have accepted the rescheduled appointment with ${doctorName} on ${newAppointmentTime}`
              : `You have declined the rescheduling request. Please contact ${doctorName} if you'd like to reschedule.`}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200/60 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-amber-600" />
          Appointment Reschedule Request
        </CardTitle>
        <CardDescription>Dr. {doctorName} has proposed a new appointment time</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Message */}
        <p className="text-sm text-foreground">{notification.message}</p>

        {/* Proposed Time */}
        {newAppointmentTime && (
          <div className="rounded-lg border border-amber-200/60 bg-card p-3 dark:border-amber-900/40 dark:bg-background">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Proposed Date & Time
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{newAppointmentTime}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
          >
            <X className="mr-2 h-4 w-4" />
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
          >
            <Check className="mr-2 h-4 w-4" />
            {isLoading ? "Processing..." : "Accept"}
          </Button>
        </div>

        {/* Info Text */}
        <p className="text-xs text-muted-foreground">
          Your response will be sent immediately to Dr. {doctorName}. You can always reach out to contact the doctor directly if you have questions.
        </p>
      </CardContent>
    </Card>
  );
}

