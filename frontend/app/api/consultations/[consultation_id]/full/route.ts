import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ consultation_id: string }>;
};

const BACKEND_URL = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { consultation_id: consultationId } = await context.params;
    const draftId = request.nextUrl.searchParams.get("draft_id");
    const backendUrl = new URL(`${BACKEND_URL}/consultation/${consultationId}/full`);
    if (draftId) {
      backendUrl.searchParams.set("draft_id", draftId);
    }

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { error: "Failed to fetch consultation" }, { status: response.status });
    }

    return NextResponse.json(data || {});
  } catch (error) {
    console.error("Consultation full preview proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
