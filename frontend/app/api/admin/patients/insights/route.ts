import { NextResponse } from "next/server";

import { callAdminBackend, respondFromBackend } from "../_shared";

type UnknownRecord = Record<string, unknown>;

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapRiskDistribution(items: unknown[]) {
  return items
    .filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
    .map((item) => ({
      riskLevel: String(item.risk_level || item.riskLevel || "unknown"),
      count: toNumber(item.count),
      percentage: toNumber(item.percentage),
    }));
}

function mapAgeDistribution(items: unknown[]) {
  return items
    .filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
    .map((item) => ({
      ageGroup: String(item.age_group || item.ageGroup || "unknown"),
      count: toNumber(item.count),
      percentage: toNumber(item.percentage),
    }));
}

function mapHealthTrends(items: unknown[]) {
  return items
    .filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
    .map((item) => ({
      metric: String(item.metric || "unknown"),
      value: toNumber(item.value),
      trend: String(item.trend || "stable"),
    }));
}

export async function GET() {
  try {
    const { response, data } = await callAdminBackend("/admin/patients/insights");
    if (!response.ok) {
      return respondFromBackend(response, data, {
        riskDistribution: [],
        ageDistribution: [],
        healthTrends: [],
      });
    }

    const payload = (data || {}) as {
      riskDistribution?: unknown[];
      ageDistribution?: unknown[];
      healthTrends?: unknown[];
      risk_distribution?: unknown[];
      age_distribution?: unknown[];
      health_trends?: unknown[];
    };

    const riskSource = Array.isArray(payload.riskDistribution)
      ? payload.riskDistribution
      : Array.isArray(payload.risk_distribution)
        ? payload.risk_distribution
        : [];

    const ageSource = Array.isArray(payload.ageDistribution)
      ? payload.ageDistribution
      : Array.isArray(payload.age_distribution)
        ? payload.age_distribution
        : [];

    const trendSource = Array.isArray(payload.healthTrends)
      ? payload.healthTrends
      : Array.isArray(payload.health_trends)
        ? payload.health_trends
        : [];

    return NextResponse.json({
      riskDistribution: mapRiskDistribution(riskSource),
      ageDistribution: mapAgeDistribution(ageSource),
      healthTrends: mapHealthTrends(trendSource),
    });
  } catch (error) {
    console.error("Admin patient insights proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
