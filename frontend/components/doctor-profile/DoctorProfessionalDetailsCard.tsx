"use client";

import { motion } from "framer-motion";
import { Clock, DollarSign, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendDoctorProfile } from "@/components/doctor-profile/types";

interface DoctorProfessionalDetailsCardProps {
  doctor: BackendDoctorProfile;
}

export function DoctorProfessionalDetailsCard({ doctor }: DoctorProfessionalDetailsCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
    >
      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl font-bold text-foreground">Professional Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            {/* Specialization */}
            {doctor.speciality_name && (
              <div className="rounded-lg bg-muted/30 p-4 dark:bg-card/30">
                <div className="flex items-start gap-3">
                  <Briefcase className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialization</p>
                    <p className="mt-1 font-semibold text-foreground">{doctor.speciality_name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Consultation Fee */}
            {doctor.consultation_fee && (
              <div className="rounded-lg bg-muted/30 p-4 dark:bg-card/30">
                <div className="flex items-start gap-3">
                  <DollarSign className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Consultation Fee
                    </p>
                    <p className="mt-1 font-semibold text-foreground">৳ {doctor.consultation_fee.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Appointment Duration */}
            {doctor.appointment_duration && (
              <div className="rounded-lg bg-muted/30 p-4 dark:bg-card/30">
                <div className="flex items-start gap-3">
                  <Clock className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Appointment Duration
                    </p>
                    <p className="mt-1 font-semibold text-foreground">{doctor.appointment_duration} minutes</p>
                  </div>
                </div>
              </div>
            )}

            {/* Years of Experience - if not already shown or want to show again */}
            {doctor.years_of_experience && typeof doctor.years_of_experience === "number" && (
              <div className="rounded-lg bg-muted/30 p-4 dark:bg-card/30">
                <div className="flex items-start gap-3">
                  <Briefcase className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experience</p>
                    <p className="mt-1 font-semibold text-foreground">
                      {doctor.years_of_experience} {doctor.years_of_experience === 1 ? "year" : "years"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}

