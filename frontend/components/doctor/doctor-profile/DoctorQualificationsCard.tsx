"use client";

import { memo } from "react";
import { Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendDoctorProfile } from "@/components/doctor/doctor-profile/types";
import { useT } from "@/i18n/client";

interface DoctorQualificationsCardProps {
  doctor: BackendDoctorProfile;
}

export const DoctorQualificationsCard = memo(function DoctorQualificationsCard({ doctor }: DoctorQualificationsCardProps) {
  const tCommon = useT("common");

  if (!doctor.qualifications) {
    return null;
  }

  const qualifications = doctor.qualifications
    .split(",")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  if (qualifications.length === 0) {
    return null;
  }

  return (
    <section className="animate-fade-in-up">
      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <CardTitle className="text-2xl font-bold text-foreground">{tCommon("doctorProfile.qualifications.title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {qualifications.map((qual, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg bg-primary-more-light p-3 dark:bg-card/50"
            >
              <div className="mt-1 h-2 w-2 min-w-2 rounded-full bg-primary" />
              <p className="text-sm font-medium leading-relaxed text-foreground/85">{qual}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
})

