"use client";

import { motion } from "framer-motion";
import { Hospital, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendDoctorLocation } from "@/components/doctor-profile/types";

interface DoctorPracticeLocationsProps {
  locations: BackendDoctorLocation[];
}

function createMapUrl(location: BackendDoctorLocation) {
  if (typeof location.latitude === "number" && typeof location.longitude === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
  }
  const query = [location.name, location.address, location.city, location.country]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function getTimeBlock(availability?: string | null) {
  if (!availability) {
    return { days: "Mon, Wed, Fri", time: "09:00 AM - 02:00 PM" };
  }

  const parts = availability.split("|").map((item) => item.trim());
  if (parts.length >= 2) {
    return { days: parts[0], time: parts[1] };
  }

  const parsed = availability.split(/(?=\d{1,2}:\d{2}\s?[AP]M)/i);
  if (parsed.length >= 2) {
    return { days: parsed[0].trim(), time: parsed.slice(1).join(" ").trim() };
  }

  return { days: "Schedule", time: availability };
}

export function DoctorPracticeLocations({ locations }: DoctorPracticeLocationsProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: 0.05 }}
    >
      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">Practice Locations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {locations.map((location) => {
            const timeBlock = getTimeBlock(location.availability);
            return (
              <article
                key={`${location.name}-${location.address}`}
                className="rounded-2xl border border-border p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-more-light text-primary">
                      <Hospital className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-base font-semibold text-foreground">{location.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {[location.address, location.city, location.country].filter(Boolean).join(", ")}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary/85">{timeBlock.days}</p>
                      <p className="text-xs font-semibold text-foreground/75">{timeBlock.time}</p>
                    </div>
                  </div>

                  <a
                    href={createMapUrl(location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    Map
                    <MapPin className="h-3.5 w-3.5" />
                  </a>
                </div>
              </article>
            );
          })}
        </CardContent>
      </Card>
    </motion.section>
  );
}
