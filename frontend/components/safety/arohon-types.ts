/**
 * The Arohon fields the backend attaches to a navigation response.
 *
 * `escalationMode` is what the interface branches on. The two modes share a tier — both
 * are L3 — and differ entirely in what the person sees, which is the point: a physical
 * red flag gets a takeover that pushes hard toward a call, and a self-harm disclosure
 * gets support that leaves the choice with them.
 */

export type EscalationMode = "emergency_takeover" | "crisis_support";

export type Helpline = {
  key: string;
  name_en: string;
  name_bn: string;
  number: string;
  always_available: boolean;
  open_now: boolean;
  opens_at: string | null;
  closes_at: string | null;
  reliability: string;
  note_en: string | null;
  note_bn: string | null;
};

export type ArohonEscalation = {
  correlationId: string;
  riskClass: string;
  autonomyTier: string;
  escalationMode: EscalationMode;
  /** Always false on this path. Rendered, not just recorded, so the person can see it. */
  autonomousNotification: boolean;
  helplines: Helpline[];
  safetyMessage: string | null;
  surfacedAt: string;
};

/** The shape the backend actually sends, before camelCase conversion. */
export type ArohonResponseFields = {
  risk_class?: string | null;
  autonomy_tier?: string | null;
  escalation_mode?: string | null;
  autonomous_notification?: boolean;
  helplines?: Helpline[];
  correlation_id?: string | null;
  safety_message?: string | null;
};

function isEscalationMode(value: unknown): value is EscalationMode {
  return value === "emergency_takeover" || value === "crisis_support";
}

/**
 * Build an escalation from a search response, or null when there is nothing to escalate.
 *
 * Returns null unless the backend supplied both a mode and a correlation ID. A takeover
 * with no correlation ID could still be shown, but its outcome could never be joined
 * back to the escalation that produced it, so axis A would count it as neither a true
 * nor a false positive. Rendering an unmeasurable emergency screen is worse than
 * falling back to the plain safety banner.
 */
export function toArohonEscalation(payload: ArohonResponseFields): ArohonEscalation | null {
  const mode = payload.escalation_mode;
  if (!isEscalationMode(mode)) return null;
  if (!payload.correlation_id || !payload.risk_class || !payload.autonomy_tier) return null;

  return {
    correlationId: payload.correlation_id,
    riskClass: payload.risk_class,
    autonomyTier: payload.autonomy_tier,
    escalationMode: mode,
    autonomousNotification: Boolean(payload.autonomous_notification),
    helplines: Array.isArray(payload.helplines) ? payload.helplines : [],
    safetyMessage: payload.safety_message ?? null,
    surfacedAt: new Date().toISOString(),
  };
}

export function helplineName(helpline: Helpline, locale: string): string {
  return locale === "bn" ? helpline.name_bn : helpline.name_en;
}

export function helplineNote(helpline: Helpline, locale: string): string | null {
  return locale === "bn" ? helpline.note_bn : helpline.note_en;
}
