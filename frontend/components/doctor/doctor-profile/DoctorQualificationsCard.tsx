"use client";

import { motion } from "framer-motion";
import { Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendDoctorProfile } from "@/components/doctor/doctor-profile/types";

interface DoctorQualificationsCardProps {
  doctor: BackendDoctorProfile;
}

export function DoctorQualificationsCard({ doctor }: DoctorQualificationsCardProps) {
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
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
    >
      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <CardTitle className="text-2xl font-bold text-foreground">Qualifications</CardTitle>
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
    </motion.section>
  );
}

