"use client";

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendDoctorProfile } from "@/components/doctor/doctor-profile/types";
import { useT } from "@/i18n/client";

interface DoctorAboutCardProps {
  doctor: BackendDoctorProfile;
}

export const DoctorAboutCard = memo(function DoctorAboutCard({ doctor }: DoctorAboutCardProps) {
  const tCommon = useT("common");
  const tags = (doctor.services || doctor.sub_specializations || []).slice(0, 6);
  const aboutText =
    doctor.about ||
    tCommon("doctorProfile.about.fallbackText", {
      title: doctor.title ? `${doctor.title} ` : "",
      firstName: doctor.first_name,
      lastName: doctor.last_name,
    });

  return (
    <section className="animate-fade-in-up">
      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold text-foreground">
            {tCommon("doctorProfile.about.title", { lastName: doctor.last_name })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-pretty text-base leading-8 text-foreground/85">{aboutText}</p>
          <div className="flex flex-wrap gap-2.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-muted/50 px-3 py-1.5 text-sm font-semibold text-foreground dark:bg-card dark:text-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
})

