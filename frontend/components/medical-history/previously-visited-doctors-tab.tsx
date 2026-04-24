"use client";

import React from "react";
import Link from "next/link";
import { UserRound, Stethoscope, MapPin, Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getPreviouslyVisitedDoctors } from "@/lib/appointment-actions";

type VisitedDoctor = {
  doctor_id: string;
  profile_id: string;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  specialization?: string | null;
  profile_photo_url?: string | null;
  hospital_name?: string | null;
  hospital_city?: string | null;
  last_visit?: string | null;
};

function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function PreviouslyVisitedDoctorsTab() {
  const [doctors, setDoctors] = React.useState<VisitedDoctor[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPreviouslyVisitedDoctors();
        if (!cancelled) setDoctors(data?.doctors ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Loading your doctors…
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <UserRound className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            You haven&apos;t completed any appointments yet. Doctors you&apos;ve visited will appear here so you can revisit their profiles and leave reviews.
          </p>
          <Button asChild size="sm">
            <Link href="/patient/find-doctor">Find a doctor</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {doctors.map((doc) => {
        const name = `${doc.title ? doc.title + " " : ""}${doc.first_name ?? ""} ${doc.last_name ?? ""}`.trim();
        const initials = `${doc.first_name?.[0] ?? ""}${doc.last_name?.[0] ?? ""}`.toUpperCase() || "DR";
        return (
          <Link
            key={doc.doctor_id}
            href={`/patient/doctor/${doc.profile_id}`}
            className="block"
          >
            <Card hoverable className="h-full border-border/50 transition-colors">
              <CardContent className="flex items-start gap-4">
                <Avatar className="h-14 w-14 shrink-0 rounded-xl border-2 border-primary/10">
                  <AvatarImage src={doc.profile_photo_url ?? undefined} alt={name} />
                  <AvatarFallback className="rounded-xl bg-primary/5 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h3 className="font-semibold text-foreground truncate">{name || "Doctor"}</h3>
                  {doc.specialization && (
                    <div className="flex items-center gap-1.5 text-sm text-primary">
                      <Stethoscope className="h-3.5 w-3.5" />
                      <span className="truncate">{doc.specialization}</span>
                    </div>
                  )}
                  {doc.hospital_name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {doc.hospital_name}
                        {doc.hospital_city ? `, ${doc.hospital_city}` : ""}
                      </span>
                    </div>
                  )}
                  {doc.last_visit && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Last visit: {formatDate(doc.last_visit)}</span>
                    </div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground self-center shrink-0" />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
