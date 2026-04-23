export type MealInstructionValue =
  | "after_meal"
  | "before_meal"
  | "with_meal"
  | "empty_stomach"
  | "any_time";

export interface PatientMedication {
  id: string;
  drug_id: string;
  brand_id?: string;
  display_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  dosage: string;
  frequency: string;
  duration: string;
  status: "current" | "past";
  started_date?: string;
  stopped_date?: string;
  prescribing_doctor?: string;
  notes?: string;
  dose_morning?: boolean;
  dose_afternoon?: boolean;
  dose_evening?: boolean;
  dose_night?: boolean;
  dose_morning_amount?: string;
  dose_afternoon_amount?: string;
  dose_evening_amount?: string;
  dose_night_amount?: string;
  meal_instruction?: MealInstructionValue;
}

export interface BackendPatientMedication {
  name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  generic_name?: string | null;
  prescribing_doctor?: string | null;
  dose_morning?: boolean;
  dose_afternoon?: boolean;
  dose_evening?: boolean;
  dose_night?: boolean;
  dose_morning_amount?: string | null;
  dose_afternoon_amount?: string | null;
  dose_evening_amount?: string | null;
  dose_night_amount?: string | null;
  meal_instruction?: string | null;
  drug_id?: string | null;
  brand_id?: string | null;
  display_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  status?: "current" | "past" | string | null;
  started_date?: string | null;
  stopped_date?: string | null;
  notes?: string | null;
}

export interface DoseSchedule {
  dose_morning: boolean;
  dose_afternoon: boolean;
  dose_evening: boolean;
  dose_night: boolean;
  dose_morning_amount: string;
  dose_afternoon_amount: string;
  dose_evening_amount: string;
  dose_night_amount: string;
}

const MEAL_INSTRUCTION_VALUES: MealInstructionValue[] = [
  "after_meal",
  "before_meal",
  "with_meal",
  "empty_stomach",
  "any_time",
];

export function normalizeDoseAmount(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "1";
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return "1";
  }

  return raw;
}

export function normalizeMealInstruction(value?: string | null): MealInstructionValue {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (MEAL_INSTRUCTION_VALUES.includes(normalized as MealInstructionValue)) {
    return normalized as MealInstructionValue;
  }
  return "after_meal";
}

function buildScheduleFromAmounts(amounts: [string, string, string, string]): DoseSchedule {
  const mergedNightAmount = amounts[3] !== "0" ? amounts[3] : amounts[2];
  const hasNight = amounts[3] !== "0" || amounts[2] !== "0";
  return {
    dose_morning: amounts[0] !== "0",
    dose_afternoon: amounts[1] !== "0",
    // Legacy compatibility: evening is deprecated and merged into night.
    dose_evening: false,
    dose_night: hasNight,
    dose_morning_amount: amounts[0] === "0" ? "1" : normalizeDoseAmount(amounts[0]),
    dose_afternoon_amount: amounts[1] === "0" ? "1" : normalizeDoseAmount(amounts[1]),
    dose_evening_amount: "1",
    dose_night_amount: mergedNightAmount === "0" ? "1" : normalizeDoseAmount(mergedNightAmount),
  };
}

export function parseDoseScheduleFromFrequency(frequency?: string | null): DoseSchedule {
  const raw = String(frequency ?? "").trim();
  if (!raw) {
    return buildScheduleFromAmounts(["0", "0", "0", "0"]);
  }

  const compact = raw.replace(/\s+/g, "");
  const parts = compact.split("+");
  if (parts.length === 4 && parts.every((part) => /^(\d+(\.\d+)?)$/.test(part))) {
    return buildScheduleFromAmounts([
      parts[0] ?? "0",
      parts[1] ?? "0",
      parts[2] ?? "0",
      parts[3] ?? "0",
    ]);
  }
  if (parts.length === 3 && parts.every((part) => /^(\d+(\.\d+)?)$/.test(part))) {
    return buildScheduleFromAmounts([
      parts[0] ?? "0",
      parts[1] ?? "0",
      parts[2] ?? "0",
      "0",
    ]);
  }

  const lowered = raw.toLowerCase();
  let dose_morning = /\bmorning\b|\bbreakfast\b/.test(lowered);
  let dose_afternoon = /\bafternoon\b|\blunch\b/.test(lowered);
  let dose_evening = /\bevening\b/.test(lowered);
  let dose_night = /\bnight\b|\bbedtime\b/.test(lowered);

  if (!dose_morning && !dose_afternoon && !dose_evening && !dose_night) {
    if (/\b(four|4)\b.*\b(times|x)\b|\bqid\b/.test(lowered)) {
      dose_morning = true;
      dose_afternoon = true;
      dose_evening = true;
      dose_night = true;
    } else if (/\b(three|3)\b.*\b(times|x)\b|\btid\b/.test(lowered)) {
      dose_morning = true;
      dose_afternoon = true;
      dose_evening = true;
    } else if (/\b(two|2|twice)\b.*\b(times|x)?\b|\bbid\b/.test(lowered)) {
      dose_morning = true;
      dose_evening = true;
    } else if (/\b(one|1|once)\b.*\b(times|x)?\b|\bod\b/.test(lowered)) {
      dose_morning = true;
    }
  }

  return {
    dose_morning,
    dose_afternoon,
    dose_evening: false,
    dose_night: dose_night || dose_evening,
    dose_morning_amount: "1",
    dose_afternoon_amount: "1",
    dose_evening_amount: "1",
    dose_night_amount: "1",
  };
}

export function buildFrequencyFromDoseSchedule(schedule: DoseSchedule): string {
  const morning = schedule.dose_morning ? normalizeDoseAmount(schedule.dose_morning_amount) : "0";
  const noon = schedule.dose_afternoon ? normalizeDoseAmount(schedule.dose_afternoon_amount) : "0";
  const night = (schedule.dose_night || schedule.dose_evening)
    ? normalizeDoseAmount(schedule.dose_night_amount || schedule.dose_evening_amount)
    : "0";
  // New format: Morning+Noon+Night
  return [morning, noon, night].join("+");
}

export function toPatientMedication(medication: BackendPatientMedication): PatientMedication {
  const parsedSchedule = parseDoseScheduleFromFrequency(medication.frequency);
  const dose_morning = medication.dose_morning ?? parsedSchedule.dose_morning;
  const dose_afternoon = medication.dose_afternoon ?? parsedSchedule.dose_afternoon;
  const dose_night = medication.dose_night ?? medication.dose_evening ?? parsedSchedule.dose_night;

  const schedule: DoseSchedule = {
    dose_morning,
    dose_afternoon,
    dose_evening: false,
    dose_night,
    dose_morning_amount:
      medication.dose_morning_amount ?? parsedSchedule.dose_morning_amount,
    dose_afternoon_amount:
      medication.dose_afternoon_amount ?? parsedSchedule.dose_afternoon_amount,
    dose_evening_amount: "1",
    dose_night_amount:
      medication.dose_night_amount ?? medication.dose_evening_amount ?? parsedSchedule.dose_night_amount,
  };

  const fallbackName = medication.display_name || medication.name || "";
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    drug_id: medication.drug_id || "",
    brand_id: medication.brand_id || undefined,
    display_name: fallbackName,
    generic_name: medication.generic_name || fallbackName,
    strength: medication.strength || "",
    dosage_form: medication.dosage_form || "",
    dosage: medication.dosage || "",
    frequency: medication.frequency || buildFrequencyFromDoseSchedule(schedule),
    duration: medication.duration || "",
    status: medication.status === "past" ? "past" : "current",
    started_date: medication.started_date || undefined,
    stopped_date: medication.stopped_date || undefined,
    prescribing_doctor: medication.prescribing_doctor || undefined,
    notes: medication.notes || undefined,
    dose_morning: schedule.dose_morning,
    dose_afternoon: schedule.dose_afternoon,
    dose_evening: false,
    dose_night: schedule.dose_night,
    dose_morning_amount: schedule.dose_morning_amount,
    dose_afternoon_amount: schedule.dose_afternoon_amount,
    dose_evening_amount: "1",
    dose_night_amount: schedule.dose_night_amount,
    meal_instruction: normalizeMealInstruction(medication.meal_instruction),
  };
}

export function toBackendPatientMedication(medication: PatientMedication): BackendPatientMedication {
  const schedule: DoseSchedule = {
    dose_morning: Boolean(medication.dose_morning),
    dose_afternoon: Boolean(medication.dose_afternoon),
    dose_evening: false,
    dose_night: Boolean(medication.dose_night || medication.dose_evening),
    dose_morning_amount: normalizeDoseAmount(medication.dose_morning_amount),
    dose_afternoon_amount: normalizeDoseAmount(medication.dose_afternoon_amount),
    dose_evening_amount: "1",
    dose_night_amount: normalizeDoseAmount(medication.dose_night_amount || medication.dose_evening_amount),
  };

  const frequency = buildFrequencyFromDoseSchedule(schedule);
  return {
    name: medication.display_name || medication.generic_name || "",
    dosage: medication.dosage || "",
    frequency,
    duration: medication.duration || "",
    generic_name: medication.generic_name || null,
    prescribing_doctor: medication.prescribing_doctor || null,
    dose_morning: schedule.dose_morning,
    dose_afternoon: schedule.dose_afternoon,
    dose_evening: false,
    dose_night: schedule.dose_night,
    dose_morning_amount: schedule.dose_morning_amount,
    dose_afternoon_amount: schedule.dose_afternoon_amount,
    dose_evening_amount: "1",
    dose_night_amount: schedule.dose_night_amount,
    meal_instruction: normalizeMealInstruction(medication.meal_instruction),
    drug_id: medication.drug_id || null,
    brand_id: medication.brand_id || null,
    display_name: medication.display_name || null,
    strength: medication.strength || null,
    dosage_form: medication.dosage_form || null,
    status: medication.status || "current",
    started_date: medication.started_date || null,
    stopped_date: medication.stopped_date || null,
    notes: medication.notes || null,
  };
}

export function formatDoseScheduleSummary(medication: {
  dose_morning?: boolean;
  dose_afternoon?: boolean;
  dose_evening?: boolean;
  dose_night?: boolean;
  dose_morning_amount?: string;
  dose_afternoon_amount?: string;
  dose_evening_amount?: string;
  dose_night_amount?: string;
}): string {
  const entries: string[] = [];
  if (medication.dose_morning) {
    entries.push(`Morning (${normalizeDoseAmount(medication.dose_morning_amount)})`);
  }
  if (medication.dose_afternoon) {
    entries.push(`Noon (${normalizeDoseAmount(medication.dose_afternoon_amount)})`);
  }
  if (medication.dose_night || medication.dose_evening) {
    entries.push(`Night (${normalizeDoseAmount(medication.dose_night_amount || medication.dose_evening_amount)})`);
  }
  return entries.length > 0 ? entries.join(", ") : "As directed";
}

export function humanizeMealInstruction(mealInstruction?: string | null): string {
  const normalized = normalizeMealInstruction(mealInstruction);
  return normalized.replaceAll("_", " ");
}

export function extractDurationDays(duration?: string | null): number | null {
  const raw = String(duration ?? "").trim().toLowerCase();
  if (!raw) return null;
  const match = raw.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (raw.includes("month")) return Math.round(value * 30);
  if (raw.includes("week")) return Math.round(value * 7);
  return Math.round(value);
}

export function computeExpiryDate(startDate?: string | null, duration?: string | null): string | null {
  const days = extractDurationDays(duration);
  if (!days) return null;

  const base = new Date(String(startDate || "").trim());
  if (Number.isNaN(base.getTime())) return null;
  const expiry = new Date(base);
  expiry.setDate(expiry.getDate() + days);
  return expiry.toISOString();
}

export function isMedicationExpired(medication: Pick<PatientMedication, "started_date" | "duration" | "dose_night" | "dose_evening">): boolean {
  const expiryIso = computeExpiryDate(medication.started_date, medication.duration);
  if (!expiryIso) return false;
  return new Date(expiryIso).getTime() < Date.now();
}
