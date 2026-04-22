import React from "react";
import Link from "next/link";
import { MapPin, Clock, Video, Stethoscope, Sparkles, Navigation } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppI18n, useT } from "@/i18n/client";

function toIntlLocale(locale: string) {
  return locale === "bn" ? "bn-BD" : "en-US";
}

interface DoctorCardProps {
  doctor: {
    profile_id: string;
    first_name: string;
    last_name: string;
    title?: string;
    specialization: string;
    qualifications?: string;
    years_of_experience?: number;
    hospital_name?: string;
    hospital_address?: string;
    hospital_city?: string;
    consultation_fee?: number;
    profile_photo_url?: string;
    visiting_hours?: string;
    consultation_mode?: string;
    reason?: string;
    score?: number;
    distance_km?: number;
  };
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  const { locale } = useAppI18n();
  const tCommon = useT("common");

  return (
    <Link href={`/patient/doctor/${doctor.profile_id}`} className="block">
      <Card 
        hoverable
        className="overflow-hidden border-border/50"
      >
        <CardContent>
          {/* Mobile-first: stack vertically, then side-by-side on md+ */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
            {/* Avatar / Image - centered on mobile */}
            <div className="shrink-0 flex justify-center sm:justify-start">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 rounded-xl border-2 border-primary/10">
                <AvatarImage 
                  src={doctor.profile_photo_url} 
                  alt={`${doctor.first_name} ${doctor.last_name}`} 
                  className="object-cover" 
                />
                <AvatarFallback className="rounded-xl text-xl sm:text-2xl bg-primary/5 text-primary">
                  {doctor.first_name?.[0]}{doctor.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Info section */}
            <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
              {/* Name and badges row */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                    {doctor.title} {doctor.first_name} {doctor.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium mt-0.5">
                    {doctor.qualifications}
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-primary font-semibold mt-1">
                    <Stethoscope className="h-4 w-4" />
                    <span className="text-sm">{doctor.specialization}</span>
                  </div>
                </div>
                
                {/* Experience & Distance badges - hidden on mobile, shown on sm+ */}
                <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
                  {doctor.years_of_experience && (
                    <Badge variant="secondary" className="text-xs">
                      {tCommon("findDoctor.doctorCard.yearsExperience", {
                        count: doctor.years_of_experience,
                      })}
                    </Badge>
                  )}
                  {doctor.distance_km !== undefined && doctor.distance_km !== null && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-xs">
                      <Navigation className="h-3 w-3 mr-1" />
                      {doctor.distance_km < 1
                        ? tCommon("findDoctor.doctorCard.metersAway", {
                            count: Math.round(doctor.distance_km * 1000),
                          })
                        : tCommon("findDoctor.doctorCard.kmAway", {
                            count: doctor.distance_km.toFixed(1),
                          })
                      }
                    </Badge>
                  )}
                </div>
              </div>

              {/* AI Reason */}
              {doctor.reason && (
                <div className="p-2.5 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/50 rounded-lg flex gap-2 text-left">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900/80 dark:text-blue-200 leading-relaxed">
                    <span className="font-semibold text-blue-700 dark:text-blue-300">{tCommon("findDoctor.doctorCard.aiMatch")}:</span> {doctor.reason}
                  </p>
                </div>
              )}

              {/* Location and hours - responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 gap-x-4 text-sm text-muted-foreground mt-2">
                {doctor.hospital_name && (
                  <div className="flex items-start gap-2 justify-center sm:justify-start text-left">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{doctor.hospital_name}</p>
                      <p className="text-xs truncate">{doctor.hospital_address}</p>
                    </div>
                  </div>
                )}
                
                {doctor.visiting_hours && (
                  <div className="flex items-start gap-2 justify-center sm:justify-start text-left">
                    <Clock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{tCommon("findDoctor.doctorCard.availability")}</p>
                      <p className="text-xs">{doctor.visiting_hours}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile-only badges row */}
              <div className="flex flex-wrap gap-2 justify-center sm:hidden mt-2">
                {doctor.years_of_experience && (
                  <Badge variant="secondary" className="text-xs">
                    {tCommon("findDoctor.doctorCard.yearsExperienceShort", {
                      count: doctor.years_of_experience,
                    })}
                  </Badge>
                )}
                {doctor.distance_km !== undefined && doctor.distance_km !== null && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-xs">
                    <Navigation className="h-3 w-3 mr-1" />
                    {doctor.distance_km < 1
                      ? tCommon("findDoctor.doctorCard.metersAway", {
                          count: Math.round(doctor.distance_km * 1000),
                        })
                      : tCommon("findDoctor.doctorCard.kmAway", {
                          count: doctor.distance_km.toFixed(1),
                        })
                    }
                  </Badge>
                )}
                {doctor.consultation_mode?.includes("video") && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 text-xs">
                    <Video className="h-3 w-3 mr-1" /> {tCommon("findDoctor.doctorCard.video")}
                  </Badge>
                )}
              </div>

              {/* Desktop-only video badge */}
              <div className="hidden sm:flex flex-wrap gap-2 mt-2">
                {doctor.consultation_mode?.includes("video") && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 text-xs">
                    <Video className="h-3 w-3 mr-1" /> {tCommon("findDoctor.doctorCard.videoConsult")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-center sm:text-left">
            <span className="text-muted-foreground">{tCommon("findDoctor.doctorCard.consultationFee")}: </span>
            <span className="font-bold text-primary text-lg">
              {doctor.consultation_fee !== undefined && doctor.consultation_fee !== null
                ? `৳${doctor.consultation_fee.toLocaleString(toIntlLocale(locale))}`
                : tCommon("findDoctor.doctorCard.notAvailable")}
            </span>
          </div>
          <Button className="w-full sm:w-auto" size="lg">
            {tCommon("findDoctor.doctorCard.bookAppointment")}
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
