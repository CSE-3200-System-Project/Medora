"use client";

import { memo } from "react";
import { Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendDoctorProfile } from "@/components/doctor/doctor-profile/types";
import { useT } from "@/i18n/client";

interface DoctorSpecializationsCardProps {
  doctor: BackendDoctorProfile;
}

export const DoctorSpecializationsCard = memo(function DoctorSpecializationsCard({ doctor }: DoctorSpecializationsCardProps) {
  const tCommon = useT("common");

  // Only show if we have sub_specializations that are different from services
  const subSpecs = doctor.sub_specializations || [];
  const services = doctor.services || [];

  // Check if sub_specializations is meaningfully different from services
  const isMeaningfullyDifferent = subSpecs.length > 0 && 
    JSON.stringify(subSpecs.sort()) !== JSON.stringify(services.sort());

  if (!isMeaningfullyDifferent) {
    return null;
  }

  return (
    <section className="animate-fade-in-up">
      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            <CardTitle className="text-2xl font-bold text-foreground">{tCommon("doctorProfile.specializations.title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5">
            {subSpecs.slice(0, 8).map((spec) => (
              <span
                key={spec}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm"
              >
                {spec}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
})
