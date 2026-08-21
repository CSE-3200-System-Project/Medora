"use server";

/**
 * Arohon surfaces, from the server.
 *
 * Recording the outcome of an L3 escalation is the only new write here, and it exists
 * because Lokkhon axis A counts false positives. A fixture set says what the rules do;
 * only the live surface says what a person did when the takeover appeared in front of
 * them.
 *
 * Nothing in this payload identifies a person or repeats what they typed. The
 * `correlationId` is a random token the backend minted when it produced the surface, so
 * an outcome joins back to its own escalation and to nothing else.
 */

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export type EscalationOutcome = "dismissed" | "acted" | "expired";
export type EscalationMode = "emergency_takeover" | "crisis_support";

export type RecordEscalationOutcomeInput = {
  correlationId: string;
  riskClass: string;
  autonomyTier: string;
  escalationMode: EscalationMode;
  outcome: EscalationOutcome;
  locale: string;
  surfacedAt: string;
};

/**
 * Record how an L3 surface resolved.
 *
 * Never throws. A failed measurement write must not surface an error dialog on top of an
 * emergency screen, and it must not stop the person from reaching the call button. The
 * boolean is for tests and diagnostics, not for the interface to branch on.
 */
export async function recordEscalationOutcome(
  input: RecordEscalationOutcomeInput,
): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/arohon/escalation-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Frontend is camelCase, backend is snake_case, and the conversion is explicit
      // because there is no automatic mapper across this boundary.
      body: JSON.stringify({
        correlation_id: input.correlationId,
        risk_class: input.riskClass,
        autonomy_tier: input.autonomyTier,
        escalation_mode: input.escalationMode,
        outcome: input.outcome,
        locale: input.locale,
        surfaced_at: input.surfacedAt,
      }),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type ArohonTier = {
  tier: string;
  rank: number;
  human_gate: string;
  constraint: string;
};

export type ArohonCeiling = {
  risk_class: string;
  ceiling: string;
  l4_eligible_with_grant: boolean;
};

export type ArohonPolicy = {
  tiers: ArohonTier[];
  ceilings: ArohonCeiling[];
  feature_tiers: { feature: string; declared_tier: string }[];
  notes: Record<string, string>;
};

/**
 * The published tier ladder and ceiling table.
 *
 * Cached for an hour: this is a specification that changes on deploy, not per request,
 * and re-fetching it on every render would be a round trip for a constant.
 */
export async function fetchArohonPolicy(): Promise<ArohonPolicy | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/arohon/policy`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    return (await response.json()) as ArohonPolicy;
  } catch {
    return null;
  }
}
