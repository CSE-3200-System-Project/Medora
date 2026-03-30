"use client";

import { Ban, CheckCircle2, Users, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PatientStatsSummary } from "./types";

type PatientStatsProps = {
  stats: PatientStatsSummary;
  labels: {
    total: string;
    active: string;
    incomplete: string;
    banned: string;
  };
};

export function PatientStats({ stats, labels }: PatientStatsProps) {
  const cards = [
    { key: "total", label: labels.total, value: stats.total, icon: Users, iconClass: "text-primary" },
    { key: "active", label: labels.active, value: stats.active, icon: CheckCircle2, iconClass: "text-emerald-600" },
    { key: "incomplete", label: labels.incomplete, value: stats.incomplete, icon: UserX, iconClass: "text-amber-600" },
    { key: "banned", label: labels.banned, value: stats.banned, icon: Ban, iconClass: "text-red-600" },
  ] as const;

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key} className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{card.value.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <Icon className={`h-5 w-5 ${card.iconClass}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
