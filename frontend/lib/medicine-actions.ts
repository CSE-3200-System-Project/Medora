"use server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export type MedicineSearchFilters = {
  dosage_form?: string;
  medicine_type?: string;
};

export type MedicineResult = {
  drug_id: string;
  brand_id?: string;
  display_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  medicine_type?: string;
  manufacturer?: string;
  is_brand: boolean;
};

export type MedicineDetail = {
  drug_id: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  common_uses?: string;
  common_uses_disclaimer?: string;
  brands: Array<{
    id: string;
    brand_name: string;
    manufacturer?: string;
    medicine_type?: string;
  }>;
};

export async function searchMedicines(query: string, filters: MedicineSearchFilters = {}): Promise<MedicineResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return [];
  }

  try {
    const params = new URLSearchParams({ q: normalizedQuery });

    if (filters.dosage_form) {
      params.append("dosage_form", filters.dosage_form);
    }

    if (filters.medicine_type) {
      params.append("medicine_type", filters.medicine_type);
    }

    const response = await fetch(`${BACKEND_URL}/medicine/search?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Medicine search failed:", error);
    return [];
  }
}

/**
 * Best-effort: turn an OCR'd medicine name into the canonical DB row.
 *
 * Strategy:
 *   1. Issue ``/medicine/search`` with progressively-trimmed candidate strings
 *      (full name → first 3 words → first 2 words → first word) until we get
 *      a non-empty result set.
 *   2. Score each candidate by token overlap with the query and prefer brand
 *      hits over generic-only hits when scores tie.
 *
 * Returns ``null`` if the search index has nothing remotely close. Callers
 * should keep the user-typed name as the fallback display in that case.
 */
export async function matchMedicineFromText(rawName: string): Promise<MedicineResult | null> {
  const cleaned = rawName.replace(/[^\p{L}\p{N}\s.-]+/gu, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) {
    return null;
  }

  const tokens = cleaned.split(" ").filter(Boolean);
  const candidates: string[] = [];
  // Try the full-cleaned string, then progressively shorter prefixes so we
  // catch cases where the OCR appended noise/dosage/strength to the name.
  candidates.push(cleaned);
  for (let take = Math.min(3, tokens.length); take >= 1; take -= 1) {
    const candidate = tokens.slice(0, take).join(" ");
    if (candidate.length >= 2 && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  for (const candidate of candidates) {
    const results = await searchMedicines(candidate);
    if (!results.length) continue;

    const queryTokens = candidate.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = results
      .map((result) => {
        const haystack = `${result.display_name} ${result.generic_name}`.toLowerCase();
        const overlap = queryTokens.reduce(
          (acc, token) => (haystack.includes(token) ? acc + 1 : acc),
          0,
        );
        // Prefer brand entries — they carry richer metadata (medicine_type, manufacturer).
        const brandBoost = result.is_brand ? 0.5 : 0;
        return { result, score: overlap + brandBoost };
      })
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score > 0) {
      return scored[0].result;
    }
    // First page returned but no token overlap — fall back to the first hit
    // (server already orders by relevance/trigram).
    return results[0];
  }

  return null;
}

export async function getMedicineDetails(drugId: string): Promise<MedicineDetail | null> {
  if (!drugId) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/medicine/${drugId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Medicine detail fetch failed:", error);
    return null;
  }
}
