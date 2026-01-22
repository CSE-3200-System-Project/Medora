"use client";

import React, { useState, useEffect } from "react";
import { ScheduleSetter } from "@/components/doctor/schedule-setter";
import { updateDoctorSchedule } from "@/lib/auth-actions";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DoctorSchedulePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/profile");
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (
    dayTimeSlots: Record<string, string[]>,
    duration: number
  ) => {
    try {
      await updateDoctorSchedule(dayTimeSlots, duration);
      alert("Schedule updated successfully!");
      router.push("/doctor/home");
    } catch (error: any) {
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Mobile-First Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground sm:text-xl">
              Schedule Settings
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Set your available days and hours
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <ScheduleSetter
          initialDayTimeSlots={profile?.day_time_slots}
          initialAvailableDays={profile?.available_days || []}
          initialTimeSlots={profile?.time_slots || ""}
          appointmentDuration={profile?.appointment_duration || 30}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
