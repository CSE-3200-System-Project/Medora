"use client";

import React, { useState, useEffect } from "react";
import { AvailabilityManager } from "@/components/doctor/availability-manager";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppBackground } from "@/components/ui/app-background";
import { MedoraLoader } from "@/components/ui/medora-loader";

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

  if (loading) {
    return (
      <AppBackground className="min-h-screen flex items-center justify-center">
        <MedoraLoader size="lg" label="Loading schedule..." />
      </AppBackground>
    );
  }

  return (
    <AppBackground className="min-h-screen animate-page-enter">
      {/* Mobile-First Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border">
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
              Manage your availability, leave, and special dates
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 max-w-4xl mx-auto">
        {profile?.id ? (
          <AvailabilityManager doctorId={profile.id} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Unable to load doctor profile.
          </p>
        )}
      </div>
    </AppBackground>
  );
}
