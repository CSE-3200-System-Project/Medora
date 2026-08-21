"use client";

/**
 * The L3 self-harm path.
 *
 * Same rung of the Arohon ladder as the emergency takeover and a deliberately different
 * screen. That difference is the specification's actual contribution, so it has to be
 * visible here and not only recorded in a log.
 *
 * What is absent is as designed as what is present:
 *
 * - No countdown, and nothing opens a dialer on its own. Every call is a tap the person
 *   chooses to make.
 * - No autonomous notification. L4 is structurally unreachable for this risk class, and
 *   the screen states that in words rather than leaving the person to wonder whether
 *   something was just sent about them.
 * - No method content anywhere, and no clinical advice. This is a bridge to a person,
 *   not counselling, and Medora does not counsel.
 * - Closing is always available, immediately, with no friction and nothing recorded
 *   about why.
 *
 * Helplines arrive already resolved against Asia/Dhaka time, so a line that operates
 * 3 PM to 3 AM shows as closed at 6 AM with its opening time, instead of sending someone
 * in crisis to a dead ring.
 */

import { HeartHandshake, Phone, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ArohonEscalation } from "./arohon-types";
import { helplineName, helplineNote } from "./arohon-types";

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

export type CrisisSupportProps = {
  escalation: ArohonEscalation;
  locale: string;
  t: Translator;
  onResolve: (outcome: "dismissed" | "acted") => void;
  onBrowse: () => void;
};

export function CrisisSupport({ escalation, locale, t, onResolve, onBrowse }: CrisisSupportProps) {
  const openLines = escalation.helplines.filter((item) => item.open_now);
  const closedLines = escalation.helplines.filter((item) => !item.open_now);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arohon-crisis-title"
      aria-describedby="arohon-crisis-subtitle"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HeartHandshake className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="arohon-crisis-title" className="text-lg font-semibold text-foreground sm:text-xl">
              {t("crisis.title")}
            </h2>
            <p id="arohon-crisis-subtitle" className="mt-1 text-sm text-muted-foreground">
              {t("crisis.subtitle")}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary">
            {t("crisis.tierBadge")}
          </span>
        </div>

        {/* The person is told, on screen, that nothing was sent on their behalf. An
            assurance nobody can see is not an assurance. */}
        {!escalation.autonomousNotification ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">{t("crisis.noAutonomousAction")}</p>
              <p className="text-xs text-muted-foreground">{t("crisis.agency")}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("crisis.talkToSomeone")}
          </h3>

          <ul className="mt-2 space-y-2">
            {openLines.map((helpline) => (
              <li key={helpline.key}>
                <a
                  href={`tel:${helpline.number}`}
                  onClick={() => onResolve("acted")}
                  className={cn(
                    "flex min-h-11 items-start justify-between gap-3 rounded-lg border border-border px-3 py-3",
                    "transition-colors hover:bg-accent",
                  )}
                >
                  <span className="min-w-0 space-y-0.5">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {helplineName(helpline, locale)}
                    </span>
                    <span className="block text-xs text-success">{t("crisis.openNow")}</span>
                    {helplineNote(helpline, locale) ? (
                      <span className="block text-xs text-muted-foreground">
                        {helplineNote(helpline, locale)}
                      </span>
                    ) : null}
                    {helpline.reliability !== "operational" ? (
                      <span className="block text-xs text-warning">{t("crisis.reportedDegraded")}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
                    <Phone className="size-4" aria-hidden="true" />
                    {helpline.number}
                  </span>
                </a>
              </li>
            ))}

            {/* Closed lines stay listed with their hours. Hiding them would make the
                screen look emptier than the world actually is at 4 AM. */}
            {closedLines.map((helpline) => (
              <li
                key={helpline.key}
                className="flex min-h-11 items-start justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-3 opacity-70"
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {helplineName(helpline, locale)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("crisis.closedNow")}
                    {helpline.opens_at ? ` · ${t("crisis.opensAt", { time: helpline.opens_at })}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">{helpline.number}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 space-y-2">
          <Button variant="outline" size="lg" className="w-full" onClick={onBrowse}>
            {t("crisis.browse")}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-muted-foreground"
            onClick={() => onResolve("dismissed")}
          >
            <X className="size-4" aria-hidden="true" />
            {t("crisis.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
