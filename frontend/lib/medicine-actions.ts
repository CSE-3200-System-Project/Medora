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
