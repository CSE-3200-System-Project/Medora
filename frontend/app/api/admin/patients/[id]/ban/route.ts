import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionToken = request.cookies.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await request.json();
    const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

    const response = await fetch(`${backendUrl}/admin/patients/${id}/ban`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { error: "Request failed" }, { status: response.status });
    }

    return NextResponse.json(data || { status: "ok" });
  } catch (error) {
    console.error("Admin patient ban proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
