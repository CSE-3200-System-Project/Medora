"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendDoctorProfile } from "@/components/doctor-profile/types";

interface DoctorAboutCardProps {
  doctor: BackendDoctorProfile;
}

export function DoctorAboutCard({ doctor }: DoctorAboutCardProps) {
  const tags = (doctor.services || doctor.sub_specializations || []).slice(0, 6);
  const aboutText =
    doctor.about ||
    `${doctor.title ? `${doctor.title} ` : ""}${doctor.first_name} ${doctor.last_name} provides patient-focused care with a strong emphasis on evidence-based treatment and clear communication.`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
    >
      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold text-foreground">About Dr. {doctor.last_name}</CardTitle>
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
    </motion.section>
  );
}

