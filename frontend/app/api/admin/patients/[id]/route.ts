import { NextRequest, NextResponse } from "next/server";

import {
  callAdminBackend,
  DEFAULT_PATIENT_BAN_REASON,
  DEFAULT_PATIENT_DELETE_REASON,
  respondFromBackend,
} from "../_shared";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { response, data } = await callAdminBackend(`/admin/patients/${id}`);

    return respondFromBackend(response, data);
  } catch (error) {
    console.error("Admin patient detail proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (payload.action === "ban" && !payload.reason) {
      payload.reason = DEFAULT_PATIENT_BAN_REASON;
    }

    const { response, data } = await callAdminBackend(`/admin/patients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    return respondFromBackend(response, data);
  } catch (error) {
    console.error("Admin patient patch proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (!payload.reason) {
      payload.reason = DEFAULT_PATIENT_DELETE_REASON;
    }

    const { response, data } = await callAdminBackend(`/admin/patients/${id}`, {
      method: "DELETE",
      body: JSON.stringify(payload),
    });

    return respondFromBackend(response, data);
  } catch (error) {
    console.error("Admin patient delete proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
