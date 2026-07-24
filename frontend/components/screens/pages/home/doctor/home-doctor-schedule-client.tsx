"use client";

import { AvailabilityManager } from "@/components/doctor/availability-manager";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppBackground } from "@/components/ui/app-background";
import { useServerResolvedCurrentUser } from "@/lib/current-user-context";

export default function DoctorSchedulePage() {
  const router = useRouter();
  const currentUser = useServerResolvedCurrentUser();

  return (
    <AppBackground className="min-h-dvh min-h-app animate-page-enter">
      {/* Mobile-First Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9"
            aria-label="Go back"
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
        {currentUser?.id ? (
          <AvailabilityManager doctorId={currentUser.id} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Unable to load doctor profile.
          </p>
        )}
      </div>
    </AppBackground>
  );
}
