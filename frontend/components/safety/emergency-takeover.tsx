"use client";

/**
 * The L3 emergency takeover.
 *
 * Shown when the deterministic red-flag screen matched a physical emergency class. It
 * covers the screen because a specialty list is the wrong thing to be reading in the
 * next thirty seconds.
 *
 * On the countdown, and why it is not autodialling: a PWA cannot place a call, and it
 * should not try. What the countdown does is navigate to a `tel:` URL, which opens the
 * device dialer with the number filled in. The person still presses call. The countdown
 * is prominently cancellable throughout, and cancelling leaves the call button in place
 * rather than closing the screen.
 *
 * Dismissal is a first-class action, not a hidden escape. The rules over-trigger on five
 * of thirty reviewed fixtures, which is the correct trade for a recall-first detector,
 * and someone who was not having an emergency must be able to say so in one tap. That
 * dismissal is recorded as a labelled false positive for Lokkhon axis A.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, MapPin, Phone, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ArohonEscalation } from "./arohon-types";
import { helplineName } from "./arohon-types";

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

const COUNTDOWN_SECONDS = 10;

export type EmergencyTakeoverProps = {
  escalation: ArohonEscalation;
  locale: string;
  t: Translator;
  onResolve: (outcome: "dismissed" | "acted") => void;
  onBrowse: () => void;
  /**
   * Opens the device dialer when the countdown reaches zero. Off in tests and in the
   * recorded demo, so neither ever puts a real number in front of a real dialer.
   */
  autoOpenDialer?: boolean;
};

export function EmergencyTakeover({
  escalation,
  locale,
  t,
  onResolve,
  onBrowse,
  autoOpenDialer = true,
}: EmergencyTakeoverProps) {
  const primary = escalation.helplines.find((item) => item.open_now) ?? escalation.helplines[0];
  const primaryNumber = primary?.number ?? "999";

  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [countdownCancelled, setCountdownCancelled] = useState(false);
  const [dialerFailed, setDialerFailed] = useState(false);
  const [locationState, setLocationState] = useState<"idle" | "copied" | "unavailable">("idle");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the panel so a screen reader announces the emergency rather than leaving the
  // caret behind in the search box the person just typed into.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // One effect drives the whole countdown, and the dial attempt happens inside the timer
  // callback rather than in an effect body, so reaching zero does not cascade a render.
  useEffect(() => {
    if (countdownCancelled || secondsLeft <= 0) return;

    const timer = window.setTimeout(() => {
      const next = secondsLeft - 1;
      setSecondsLeft(next);
      if (next > 0 || !autoOpenDialer) return;

      try {
        window.location.href = `tel:${primaryNumber}`;
        onResolve("acted");
      } catch {
        // Some browsers refuse a navigation with no user gesture behind it. The button
        // is still there, so say so instead of failing silently.
        setDialerFailed(true);
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsLeft, countdownCancelled, autoOpenDialer, primaryNumber, onResolve]);

  const copyLocation = useCallback(() => {
    if (!navigator.geolocation || !navigator.clipboard) {
      setLocationState("unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        navigator.clipboard
          .writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
          .then(() => setLocationState("copied"))
          .catch(() => setLocationState("unavailable"));
      },
      () => setLocationState("unavailable"),
    );
  }, []);

  const riskLabel = t(`common.riskClass.${escalation.riskClass}`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-destructive/95 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="arohon-takeover-title"
      aria-describedby="arohon-takeover-subtitle"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-lg outline-none sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="arohon-takeover-title" className="text-lg font-semibold text-foreground sm:text-xl">
              {t("takeover.title")}
            </h2>
            <p id="arohon-takeover-subtitle" className="mt-1 text-sm text-muted-foreground">
              {t("takeover.subtitle")}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive">
            {t("takeover.tierBadge")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("takeover.riskLabel")}: {riskLabel}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          <Button
            variant="emergency"
            size="lg"
            className="w-full text-base"
            asChild
            onClick={() => onResolve("acted")}
          >
            <a href={`tel:${primaryNumber}`}>
              <Phone className="size-5" aria-hidden="true" />
              {t("takeover.callAction", { number: primaryNumber })}
            </a>
          </Button>

          {!countdownCancelled && secondsLeft > 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <p className="text-sm text-foreground" aria-live="polite">
                {t("takeover.openingDialer", { seconds: secondsLeft })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCountdownCancelled(true)}
              >
                {t("takeover.cancelCountdown")}
              </Button>
            </div>
          ) : null}

          {countdownCancelled ? (
            <p className="text-sm text-muted-foreground">{t("takeover.countdownCancelled")}</p>
          ) : null}

          {dialerFailed ? (
            <p className="text-sm text-destructive">{t("takeover.dialerFailed")}</p>
          ) : null}
        </div>

        {escalation.helplines.length > 1 ? (
          <div className="mt-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("common.helplines")}
            </h3>
            <ul className="mt-2 space-y-2">
              {escalation.helplines.slice(1).map((helpline) => (
                <li key={helpline.key}>
                  <a
                    href={`tel:${helpline.number}`}
                    onClick={() => onResolve("acted")}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2",
                      "text-sm text-foreground transition-colors hover:bg-accent",
                    )}
                  >
                    <span className="min-w-0 truncate">{helplineName(helpline, locale)}</span>
                    <span className="shrink-0 font-medium">{helpline.number}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 space-y-2">
          <Button variant="outline" size="lg" className="w-full" onClick={copyLocation}>
            <MapPin className="size-4" aria-hidden="true" />
            {locationState === "copied"
              ? t("takeover.locationCopied")
              : locationState === "unavailable"
                ? t("takeover.locationUnavailable")
                : t("takeover.copyLocation")}
          </Button>

          <Button variant="ghost" size="lg" className="w-full" onClick={onBrowse}>
            {t("takeover.browse")}
          </Button>

          <Button
            variant="ghost"
            size="lg"
            className="w-full text-muted-foreground"
            onClick={() => onResolve("dismissed")}
          >
            <X className="size-4" aria-hidden="true" />
            {t("takeover.dismiss")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("takeover.dismissHint")}</p>
        </div>

        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          {t("takeover.notADiagnosis")}
        </p>
      </div>
    </div>
  );
}
