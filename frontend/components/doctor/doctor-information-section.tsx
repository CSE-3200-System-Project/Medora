"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { 
  MapPin, 
  Clock, 
  Award, 
  Briefcase, 
  GraduationCap,
  Globe,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface DoctorInformationSectionProps {
  doctor: any;
}

export function DoctorInformationSection({ doctor }: DoctorInformationSectionProps) {
  const [showAllServices, setShowAllServices] = React.useState(false);

  const displayedServices = showAllServices 
    ? doctor.services 
    : doctor.services?.slice(0, 6);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Doctor Header Card */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Profile Photo */}
            <div className="shrink-0">
              <Avatar className="h-32 w-32 md:h-40 md:w-40 rounded-2xl">
                {doctor.profile_photo_url ? (
                  <img 
                    src={doctor.profile_photo_url} 
                    alt={`${doctor.first_name} ${doctor.last_name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-primary-more-light flex items-center justify-center text-4xl font-bold text-primary">
                    {doctor.first_name?.[0]}{doctor.last_name?.[0]}
                  </div>
                )}
              </Avatar>
            </div>

            {/* Doctor Info */}
            <div className="flex-1 space-y-3">
              {/* Name and Title */}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {doctor.title ? `${doctor.title} ` : ""}
                  {doctor.first_name} {doctor.last_name}
                </h1>
                <p className="text-base md:text-lg text-muted-foreground mt-1">
                  {doctor.qualifications}
                </p>
              </div>

              {/* Specialization */}
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <span className="text-lg font-medium text-foreground">
                  {doctor.speciality_name || doctor.specialization || "General Physician"}
                </span>
              </div>

              {/* Experience and Status */}
              <div className="flex flex-wrap gap-3 md:gap-4">
                {doctor.years_of_experience && (
                  <div className="flex items-center gap-2 text-foreground">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="text-sm">{doctor.years_of_experience} Years of Experience Overall</span>
                  </div>
                )}
                
                {doctor.bmdc_verified ? (
                  <Badge variant="default" className="bg-success text-white">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    BMDC Verified
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    BMDC Reg.: Coming Soon
                  </Badge>
                )}

                {doctor.bmdc_number && (
                  <span className="text-sm text-muted-foreground">
                    ID: {doctor.bmdc_number}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hospital/Location Info */}
      {doctor.locations && doctor.locations.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Locations
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {doctor.locations.map((location: any, index: number) => (
              <div key={index} className="pb-4 border-b border-border last:border-0 last:pb-0">
                <h3 className="font-semibold text-foreground text-lg mb-2">
                  {location.name}
                </h3>
                <p className="text-muted-foreground text-sm mb-2">
                  {location.address}, {location.city}, {location.country}
                </p>
                {location.availability && (
                  <div className="flex items-center gap-2 text-sm text-foreground mb-3">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{location.availability}</span>
                  </div>
                )}
                <Button variant="outline" size="sm" className="text-primary">
                  <MapPin className="h-4 w-4 mr-2" />
                  Get Direction
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Services/Conditions Treated */}
      {doctor.services && doctor.services.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-foreground">
              Serves for:
            </h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {displayedServices?.map((service: string, index: number) => (
                <Badge 
                  key={index} 
                  variant="secondary"
                  className="bg-accent text-accent-foreground px-3 py-1"
                >
                  {service}
                </Badge>
              ))}
            </div>
            {doctor.services.length > 6 && (
              <Button 
                variant="link" 
                className="text-primary mt-3 px-0"
                onClick={() => setShowAllServices(!showAllServices)}
              >
                {showAllServices ? "View less" : "View more"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* About the Doctor */}
      {doctor.about && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-foreground">About</h2>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed whitespace-pre-line">
              {doctor.about}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Specializations */}
      {doctor.sub_specializations && doctor.sub_specializations.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-foreground">Specializations</h2>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {doctor.sub_specializations.map((spec: string, index: number) => (
                <li key={index} className="text-foreground">{spec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Work Experience */}
      {doctor.work_experience && doctor.work_experience.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-foreground">Work Experiences</h2>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2">
              {doctor.work_experience.map((exp: any, index: number) => (
                <li key={index} className="text-foreground">
                  {exp.position} - {exp.hospital}
                  {exp.current && " (Current)"}
                  {exp.from_year && exp.to_year && ` (${exp.from_year} - ${exp.to_year})`}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {doctor.education && doctor.education.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-foreground">Education</h2>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2">
              {doctor.education.map((edu: any, index: number) => (
                <li key={index} className="text-foreground">
                  <strong>{edu.degree}</strong> - {edu.institution}
                  {edu.year && ` (${edu.year})`}
                  {edu.country && `, ${edu.country}`}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Languages */}
      {doctor.languages_spoken && doctor.languages_spoken.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span>Languages: {doctor.languages_spoken.join(", ")}</span>
        </div>
      )}
    </div>
  );
}
