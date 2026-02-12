"use client";

import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertCircle,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  User,
  Edit,
} from "lucide-react";
import { getDoctorProfile } from "@/lib/auth-actions";
import { useRouter } from "next/navigation";

export default function DoctorProfilePage() {
  const router = useRouter();
  const [doctor, setDoctor] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [showAllServices, setShowAllServices] = React.useState(false);

  React.useEffect(() => {
    loadDoctorProfile();
  }, []);

  const loadDoctorProfile = async () => {
    try {
      const data = await getDoctorProfile();
      setDoctor(data);
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppBackground>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-foreground font-semibold">Loading profile...</p>
          </div>
        </div>
      </AppBackground>
    );
  }

  if (!doctor) {
    return (
      <AppBackground>
        <div className="flex items-center justify-center h-screen">
          <p className="text-foreground">Failed to load profile</p>
        </div>
      </AppBackground>
    );
  }

  const displayedServices = showAllServices
    ? doctor.services
    : doctor.services?.slice(0, 6);

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto container-padding py-8 pt-24 md:pt-28">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              My Profile
            </h1>
            <p className="text-foreground-muted mt-1">
              Manage your professional information
            </p>
          </div>
          <Button
            onClick={() => router.push("/onboarding/doctor")}
            variant="medical"
            size="lg"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </div>

        <div className="space-y-6">
          {/* Doctor Header Card */}
          <Card className="rounded-2xl shadow-lg border-primary/20 bg-gradient-to-br from-white via-primary-more-light/60 to-accent/80">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="shrink-0">
                  <Avatar className="h-32 w-32 md:h-40 md:w-40 rounded-2xl border-4 border-white shadow-xl">
                    {doctor.profile_photo_url ? (
                      <img
                        src={doctor.profile_photo_url}
                        alt={`${doctor.first_name} ${doctor.last_name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-primary flex items-center justify-center text-4xl font-bold text-white">
                        {doctor.first_name?.[0]}{doctor.last_name?.[0]}
                      </div>
                    )}
                  </Avatar>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                      {doctor.title ? `${doctor.title} ` : ""}
                      {doctor.first_name} {doctor.last_name}
                    </h2>
                    <p className="text-base md:text-lg text-foreground font-semibold mt-1">
                      {doctor.qualifications}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-lg px-3 py-2 inline-flex">
                    <Award className="h-5 w-5 text-primary" />
                    <span className="text-lg font-semibold text-foreground">
                      {doctor.speciality_name || doctor.specialization || "General Physician"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 md:gap-4">
                    {doctor.years_of_experience && (
                      <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-lg px-3 py-1.5">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">
                          {doctor.years_of_experience} Years Experience
                        </span>
                      </div>
                    )}

                    {doctor.bmdc_verified ? (
                      <Badge variant="default" className="bg-success text-white font-semibold">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        BMDC Verified
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="font-semibold">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        BMDC Pending
                      </Badge>
                    )}

                    {doctor.bmdc_number && (
                      <span className="text-sm font-semibold text-foreground bg-white/70 backdrop-blur-sm rounded-lg px-3 py-1.5">
                        BMDC: {doctor.bmdc_number}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="rounded-2xl shadow-md border-primary/20 bg-gradient-to-br from-white to-primary-more-light/40">
            <CardHeader className="border-b border-primary/10 bg-primary/5">
              <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctor.email && (
                <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-foreground-muted font-semibold uppercase">Email</p>
                    <p className="text-foreground font-semibold">{doctor.email}</p>
                  </div>
                </div>
              )}
              {doctor.phone && (
                <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-foreground-muted font-semibold uppercase">Phone</p>
                    <p className="text-foreground font-semibold">{doctor.phone}</p>
                  </div>
                </div>
              )}
              {doctor.date_of_birth && (
                <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-foreground-muted font-semibold uppercase">Date of Birth</p>
                    <p className="text-foreground font-semibold">{doctor.date_of_birth}</p>
                  </div>
                </div>
              )}
              {doctor.gender && (
                <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-foreground-muted font-semibold uppercase">Gender</p>
                    <p className="text-foreground font-semibold">{doctor.gender}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* About Section */}
          {doctor.about && (
            <Card className="rounded-2xl shadow-md border-primary/20 bg-gradient-to-br from-white to-accent/30">
              <CardHeader className="border-b border-primary/10 bg-accent/20">
                <CardTitle className="text-xl font-bold text-foreground">
                  About
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-foreground leading-relaxed whitespace-pre-line font-medium">
                  {doctor.about}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Practice Locations */}
          {doctor.locations && doctor.locations.length > 0 && (
            <Card className="rounded-2xl shadow-md border-primary/20 bg-gradient-to-br from-white to-primary-light/20">
              <CardHeader className="border-b border-primary/10 bg-primary/5">
                <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Practice Locations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {doctor.locations.map((location: any, index: number) => (
                  <div
                    key={index}
                    className="pb-4 border-b border-primary/10 last:border-0 last:pb-0 bg-white/60 backdrop-blur-sm rounded-lg p-4"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <span className="inline-block bg-primary text-white text-xs font-semibold px-2 py-0.5 rounded mb-2">
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
                      <div className="flex items-center gap-2 text-sm text-foreground mb-3 ml-7 bg-accent/40 rounded px-2 py-1.5 inline-flex">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{location.availability}</span>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Services */}
          {doctor.services && doctor.services.length > 0 && (
            <Card className="rounded-2xl shadow-md border-primary/20 bg-gradient-to-br from-white to-accent/30">
              <CardHeader className="border-b border-primary/10 bg-accent/20">
                <CardTitle className="text-xl font-bold text-foreground">
                  Services Provided
                </CardTitle>
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

          {/* Sub-Specializations */}
          {doctor.sub_specializations && doctor.sub_specializations.length > 0 && (
            <Card className="rounded-2xl shadow-md border-primary/20 bg-gradient-to-br from-white to-primary-more-light/30">
              <CardHeader className="border-b border-primary/10 bg-primary/5">
                <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Sub-Specializations
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-2">
                  {doctor.sub_specializations.map((spec: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 bg-white/60 rounded-lg p-2">
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
            <Card className="rounded-2xl shadow-md border-primary/20 bg-gradient-to-br from-white to-primary-light/20">
              <CardHeader className="border-b border-primary/10 bg-primary/5">
                <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Work Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {doctor.work_experience.map((exp: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 pb-4 border-b border-border last:border-0 bg-white/60 rounded-lg p-3"
                    >
                      <div className="h-2 w-2 bg-primary rounded-full mt-2 shrink-0"></div>
                      <div>
                        <p className="text-foreground font-bold">{exp.position}</p>
                        <p className="text-foreground font-medium">{exp.hospital}</p>
                        <p className="text-sm text-muted-foreground font-medium">
                          {exp.current && (
                            <span className="text-success font-semibold">Current • </span>
                          )}
                          {exp.from_year && exp.to_year && `${exp.from_year} - ${exp.to_year}`}
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
            <Card className="rounded-2xl shadow-md border-primary/20 bg-gradient-to-br from-white to-accent/30">
              <CardHeader className="border-b border-primary/10 bg-accent/20">
                <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Education
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {doctor.education.map((edu: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 pb-4 border-b border-border last:border-0 bg-white/60 rounded-lg p-3"
                    >
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
            <Card className="rounded-2xl shadow-md bg-gradient-to-r from-primary-more-light/30 to-accent/30 border-primary/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-white rounded-full p-3 shadow-md">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase">
                      Languages Spoken
                    </p>
                    <p className="text-foreground font-bold">
                      {doctor.languages_spoken.join(", ")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </AppBackground>
  );
}
