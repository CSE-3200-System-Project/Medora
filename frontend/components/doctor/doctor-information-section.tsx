"use client";

import React from "react";
import Image from "next/image";
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

  const buildDirectionsUrl = (location: any) => {
    if (typeof location?.latitude === "number" && typeof location?.longitude === "number") {
      return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`;
    }

    const destination = [location?.name, location?.address, location?.city, location?.country]
      .filter(Boolean)
      .join(", ");

    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(destination)}`;
  };

  const displayedServices = showAllServices 
    ? doctor.services 
    : doctor.services?.slice(0, 6);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Doctor Header Card - Blue Background */}
      <Card className="rounded-2xl shadow-lg border-primary/20 bg-linear-to-br from-primary-more-light/70 to-accent/70 dark:from-card dark:to-card">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Profile Photo */}
            <div className="shrink-0">
              <Avatar className="h-32 w-32 md:h-40 md:w-40 rounded-2xl border-4 border-white shadow-xl">
                {doctor.profile_photo_url ? (
                  <Image
                    src={doctor.profile_photo_url}
                    alt={`${doctor.first_name} ${doctor.last_name}`}
                    width={160}
                    height={160}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full bg-primary flex items-center justify-center text-4xl font-bold text-white">
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
                <p className="text-base md:text-lg text-foreground font-semibold mt-1">
                  {doctor.qualifications}
                </p>
              </div>

              {/* Specialization */}
              <div className="inline-flex items-center gap-2 bg-background/80 rounded-lg px-3 py-2 border border-border/50">
                <Award className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold text-foreground">
                  {doctor.speciality_name || doctor.specialization || "General Physician"}
                </span>
              </div>

              {/* Experience and Status */}
              <div className="flex flex-wrap gap-3 md:gap-4">
                {doctor.years_of_experience && (
                  <div className="flex items-center gap-2 bg-background/80 rounded-lg px-3 py-1.5 border border-border/50">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {doctor.years_of_experience} Years of Experience Overall
                    </span>
                  </div>
                )}
                
                {doctor.bmdc_verified ? (
                  <Badge variant="default" className="bg-success text-primary-foreground font-semibold">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    BMDC Verified
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="font-semibold">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    BMDC Reg.: Coming Soon
                  </Badge>
                )}

                {doctor.bmdc_number && (
                  <span className="text-sm font-semibold text-foreground bg-background/80 rounded-lg px-3 py-1.5 border border-border/50">
                    ID: {doctor.bmdc_number}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About the Doctor - Immediately after profile */}
      {doctor.about && (
        <Card className="rounded-2xl shadow-md border-primary/10 bg-linear-to-br from-background to-accent/20 dark:from-card dark:to-card">
          <CardHeader className="border-b border-primary/10">
            <h2 className="text-xl font-bold text-foreground">About Dr. {doctor.last_name}</h2>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-foreground leading-relaxed whitespace-pre-line font-medium">
              {doctor.about}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hospital/Location Info */}
      {doctor.locations && doctor.locations.length > 0 && (
        <Card className="rounded-2xl shadow-md border-primary/10 bg-linear-to-br from-background to-primary-more-light/40 dark:from-card dark:to-card">
          <CardHeader className="border-b border-primary/10">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Practice Locations
            </h2>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {doctor.locations.map((location: any, index: number) => (
              <div key={index} className="pb-4 last:pb-0 bg-background/80 rounded-lg p-4 border border-border/40">
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <span className="inline-block bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded mb-2">
                      {index === 0 ? "Primary Hospital" : `Chamber ${index}`}
                    </span>
                    <h3 className="font-bold text-foreground text-lg mb-1">
                      {location.name}
                    </h3>
                    <p className="text-foreground text-sm mb-2 font-medium">
                      {location.address}, {location.city}, {location.country}
                    </p>
                  </div>
                </div>
                {location.availability && (
                  <div className="inline-flex items-center gap-2 text-sm text-foreground mb-3 ml-7 bg-accent/30 rounded px-2 py-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{location.availability}</span>
                  </div>
                )}
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="text-primary border-primary hover:bg-primary hover:text-primary-foreground font-semibold ml-7"
                >
                  <a href={buildDirectionsUrl(location)} target="_blank" rel="noopener noreferrer">
                  <MapPin className="h-4 w-4 mr-2" />
                  Get Direction
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Services/Conditions Treated */}
      {doctor.services && doctor.services.length > 0 && (
        <Card className="rounded-2xl shadow-md border-primary/10 bg-linear-to-br from-background to-accent/20 dark:from-card dark:to-card">
          <CardHeader className="border-b border-primary/10">
            <h2 className="text-xl font-bold text-foreground">
              Serves for:
            </h2>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {displayedServices?.map((service: string, index: number) => (
                <Badge 
                  key={index} 
                  variant="secondary"
                  className="bg-primary-light/40 text-primary border border-primary/20 px-3 py-1.5 font-semibold hover:bg-primary-light/60"
                >
                  {service}
                </Badge>
              ))}
            </div>
            {doctor.services.length > 6 && (
              <Button 
                variant="link" 
                className="text-primary mt-3 px-0 font-bold hover:underline"
                onClick={() => setShowAllServices(!showAllServices)}
              >
                {showAllServices ? "View less" : "View more"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Specializations */}
      {doctor.sub_specializations && doctor.sub_specializations.length > 0 && (
        <Card className="rounded-2xl shadow-md border-primary/10">
          <CardHeader className="bg-accent/20 border-b border-primary/10">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Field of Concentration
            </h2>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {doctor.sub_specializations.map((spec: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-foreground font-medium">{spec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Work Experience */}
      {doctor.work_experience && doctor.work_experience.length > 0 && (
        <Card className="rounded-2xl shadow-md border-primary/10">
          <CardHeader className="bg-primary-more-light/20 border-b border-primary/10">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Work Experiences
            </h2>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {doctor.work_experience.map((exp: any, index: number) => (
                <div key={index} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
                  <div className="h-2 w-2 bg-primary rounded-full mt-2 shrink-0"></div>
                  <div>
                    <p className="text-foreground font-bold">{exp.position}</p>
                    <p className="text-foreground font-medium">{exp.hospital}</p>
                    <p className="text-sm text-muted-foreground font-medium">
                      {exp.current && <span className="text-success font-semibold">Current</span>}
                      {exp.from_year && exp.to_year && ` ${exp.from_year} - ${exp.to_year}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {doctor.education && doctor.education.length > 0 && (
        <Card className="rounded-2xl shadow-md border-primary/10">
          <CardHeader className="bg-accent/20 border-b border-primary/10">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Education
            </h2>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {doctor.education.map((edu: any, index: number) => (
                <div key={index} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
                  <GraduationCap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-foreground font-bold">{edu.degree}</p>
                    <p className="text-foreground font-medium">{edu.institution}</p>
                    <p className="text-sm text-muted-foreground font-medium">
                      {edu.year && edu.year}
                      {edu.country && `, ${edu.country}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Languages */}
      {doctor.languages_spoken && doctor.languages_spoken.length > 0 && (
        <Card className="rounded-2xl shadow-md bg-linear-to-r from-primary-more-light/30 to-accent/30 dark:from-card dark:to-card border-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-background rounded-full p-2 border border-border/40">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Languages Spoken</p>
                <p className="text-foreground font-bold">{doctor.languages_spoken.join(", ")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
