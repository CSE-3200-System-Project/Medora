"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Bookmark, CheckCircle2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BackendDoctorProfile } from "@/components/doctor-profile/types";

interface DoctorProfileHeaderProps {
  doctor: BackendDoctorProfile;
  onShare: () => void;
}

function getDisplayName(doctor: BackendDoctorProfile) {
  const fullName = `${doctor.first_name} ${doctor.last_name}`.trim();
  return `${doctor.title ? `${doctor.title} ` : ""}${fullName}`.trim();
}

export function DoctorProfileHeader({ doctor, onShare }: DoctorProfileHeaderProps) {
  const specialty = doctor.speciality_name || doctor.specialization || "Specialist";
  const subSpecialty = doctor.sub_specializations?.[0] || "Specialist in Patient Care";
  const experienceText = doctor.years_of_experience
    ? `${doctor.years_of_experience} Years+`
    : "N/A";
  const successRate = "98%";

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      <Card className="rounded-3xl border-border/70 bg-background shadow-sm">
        <CardContent className="space-y-6 p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4 sm:gap-5">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-surface sm:h-28 sm:w-28">
                {doctor.profile_photo_url ? (
                  <Image
                    src={doctor.profile_photo_url}
                    alt={getDisplayName(doctor)}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-primary">
                    {doctor.first_name?.[0]}
                    {doctor.last_name?.[0]}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Badge className="rounded-md bg-primary-more-light px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary-more-light">
                  {specialty}
                </Badge>
                <h1 className="text-balance text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                  {getDisplayName(doctor)}
                </h1>
                <p className="max-w-2xl text-sm font-medium leading-relaxed text-foreground/80 sm:text-base">
                  {doctor.qualifications || "MBBS"} • {subSpecialty}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start">
              <Button
                variant="outline"
                size="icon"
                aria-label="Share doctor profile"
                className="h-10 w-10 rounded-xl"
                onClick={onShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Save doctor"
                className="h-10 w-10 rounded-xl"
              >
                <Bookmark className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/30 p-4 dark:bg-card/50">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Experience</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{experienceText}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 dark:bg-card/50">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Success Rate</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{successRate}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 dark:bg-card/50">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-success-muted">
                <CheckCircle2 className="h-4 w-4" />
                {doctor.bmdc_verified ? "BMDC Verified" : "Verification Pending"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}

