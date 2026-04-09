import { NextResponse } from "next/server";

import { callAdminBackend, respondFromBackend } from "../_shared";

type UnknownRecord = Record<string, unknown>;

function normalizeGrowthItem(item: UnknownRecord) {
  return {
    name: String(item.label || item.name || item.key || "-"),
    value: Number(item.registrations || item.value || 0),
  };
}

function normalizeDistributionItem(item: UnknownRecord) {
  return {
    name: String(item.name || "-"),
    value: Number(item.value || 0),
    color: typeof item.color === "string" ? item.color : undefined,
  };
}

export async function GET() {
  try {
    const { response, data } = await callAdminBackend("/admin/patients/charts");
    if (!response.ok) {
      return respondFromBackend(response, data, {
        growth: [],
        distribution: [],
      });
    }

    const payload = (data || {}) as {
      growth?: unknown[];
      distribution?: unknown[];
    };

    const growth = Array.isArray(payload.growth)
      ? payload.growth
          .filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
          .map(normalizeGrowthItem)
      : [];

    const distribution = Array.isArray(payload.distribution)
      ? payload.distribution
          .filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
          .map(normalizeDistributionItem)
      : [];

    return NextResponse.json({ growth, distribution });
  } catch (error) {
    console.error("Admin patient charts proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
