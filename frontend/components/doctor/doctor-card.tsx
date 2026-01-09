import React from "react";
import Link from "next/link";
import { MapPin, Clock, Video, Stethoscope, Sparkles } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  };
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  return (
    <Link href={`/patient/doctor/${doctor.profile_id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200 border-border/50 cursor-pointer">
        <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar / Image */}
          <div className="shrink-0">
            <Avatar className="h-24 w-24 md:h-32 md:w-32 rounded-xl border-2 border-primary/10">
              <AvatarImage src={doctor.profile_photo_url} alt={`${doctor.first_name} ${doctor.last_name}`} className="object-cover" />
              <AvatarFallback className="rounded-xl text-2xl bg-primary/5 text-primary">
                {doctor.first_name?.[0]}{doctor.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {doctor.title} {doctor.first_name} {doctor.last_name}
                </h3>
                <p className="text-sm text-muted-foreground font-medium mb-1">
                  {doctor.qualifications}
                </p>
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Stethoscope className="h-4 w-4" />
                  <span>{doctor.specialization}</span>
                </div>
              </div>
              {doctor.years_of_experience && (
                <Badge variant="secondary" className="hidden md:flex">
                  {doctor.years_of_experience} Years Exp.
                </Badge>
              )}
            </div>

            {/* AI Reason */}
            {doctor.reason && (
                <div className="mt-2 mb-3 p-2.5 bg-blue-50/50 border border-blue-100/50 rounded-lg flex gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-900/80 leading-relaxed">
                        <span className="font-semibold text-blue-700">AI Match:</span> {doctor.reason}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-sm text-muted-foreground mt-3">
              {doctor.hospital_name && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{doctor.hospital_name}</p>
                    <p className="text-xs">{doctor.hospital_address}</p>
                  </div>
                </div>
              )}
              
              {doctor.visiting_hours && (
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Availability</p>
                    <p className="text-xs">{doctor.visiting_hours}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-3">
              {doctor.consultation_mode?.includes("video") && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Video className="h-3 w-3 mr-1" /> Video Consult
                </Badge>
              )}
              {/* Add more tags based on services if available */}
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="bg-surface/50 p-4 flex items-center justify-between border-t border-border/50">
        <div className="text-sm">
          <span className="text-muted-foreground">Consultation Fee: </span>
          <span className="font-bold text-primary text-lg">
            ৳{doctor.consultation_fee || "N/A"}
          </span>
        </div>
        <Button>Book Appointment</Button>
      </CardFooter>
    </Card>
    </Link>
  );
}
