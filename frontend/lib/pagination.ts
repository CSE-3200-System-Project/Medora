"use server";

import { cookies } from "next/headers";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageParams {
  limit?: number;
  offset?: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

/** Known legacy array keys per endpoint group */
type LegacyKey =
  | "notifications"
  | "reminders"
  | "consultations"
  | "prescriptions"
  | "metrics"
  | "actions"
  | "reviews"
  | "reports"
  | "appointments"
  | "patients"
  | "doctors"
  | "consents"
  | "sharing"
  | "results"
  | "conversations"
  | "messages"
  | "access_history"
  | "access_records"
  | "specialities";

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token ?? ""}`,
  };
}

// ── Core fetcher ──────────────────────────────────────────────────────────────

/**
 * Fetch a paginated list from a backend collection endpoint.
 *
 * The backend emits the unified envelope:
 *   { items, total, limit, offset, has_more, page, page_size }
 *
 * For backward compatibility during transition the backend also emits the
 * legacy named array (e.g. `notifications`). This helper reads `items` first,
 * then falls back to any legacy array key it finds in the response.
 */
export async function fetchPaginated<T>(
  path: string,
  params: PageParams & Record<string, string | number | boolean | undefined> = {},
  legacyKey?: LegacyKey,
  init?: RequestInit
): Promise<PageResult<T>> {
  const headers = await getAuthHeaders();

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      query.set(k, String(v));
    }
  }

  const url = `${BACKEND_URL}${path}${query.toString() ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      detail = err?.detail ?? detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const data = await response.json();

  // Resolve items array: prefer canonical `items`, then legacy key, then bare array
  let items: T[] = [];
  if (Array.isArray(data?.items) && data.items.length > 0) {
    items = data.items as T[];
  } else if (legacyKey && Array.isArray(data?.[legacyKey])) {
    items = data[legacyKey] as T[];
  } else if (Array.isArray(data)) {
    items = data as T[];
  }

  const total: number = data?.total ?? items.length;
  const limit: number = data?.limit ?? params.limit ?? 20;
  const offset: number = data?.offset ?? params.offset ?? 0;
  const hasMore: boolean = data?.has_more ?? offset + items.length < total;
  const page: number = data?.page ?? Math.floor(offset / (limit || 1)) + 1;
  const pageSize: number = data?.page_size ?? limit;

  return { items, total, limit, offset, hasMore, page, pageSize };
}

// ── Server-side empty result helper ──────────────────────────────────────────

export function emptyPage<T>(limit = 20, offset = 0): PageResult<T> {
  return {
    items: [],
    total: 0,
    limit,
    offset,
    hasMore: false,
    page: 1,
    pageSize: limit,
  };
}

// ── URL builder (non-server, usable client-side) ──────────────────────────────

export function buildPageParams(params: PageParams): URLSearchParams {
  const q = new URLSearchParams();
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  if (params.offset !== undefined) q.set("offset", String(params.offset));
  return q;
}
