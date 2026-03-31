import { NextResponse } from "next/server";

import { callAdminBackend, respondFromBackend } from "../_shared";

export async function GET() {
  try {
    const { response, data } = await callAdminBackend("/admin/patients/stats");
    return respondFromBackend(response, data, {
      total: 0,
      active: 0,
      incomplete: 0,
      banned: 0,
    });
  } catch (error) {
    console.error("Admin patient stats proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
