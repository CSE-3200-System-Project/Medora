import { NextRequest, NextResponse } from "next/server";

import {
  callAdminBackend,
  DEFAULT_PATIENT_BAN_REASON,
  DEFAULT_PATIENT_DELETE_REASON,
  respondFromBackend,
} from "../_shared";

type BulkActionRequestBody = {
  action?: string;
  ids?: string[];
  patient_ids?: string[];
  reason?: string;
};

function buildBulkPayload(raw: BulkActionRequestBody) {
  const action = raw.action || "";
  const patientIds = Array.isArray(raw.patient_ids)
    ? raw.patient_ids
    : Array.isArray(raw.ids)
      ? raw.ids
      : [];
  const trimmedReason = typeof raw.reason === "string" ? raw.reason.trim() : "";

  if (action === "ban") {
    return {
      action,
      patient_ids: patientIds,
      reason: trimmedReason || DEFAULT_PATIENT_BAN_REASON,
    };
  }

  if (action === "delete") {
    return {
      action,
      patient_ids: patientIds,
      reason: trimmedReason || DEFAULT_PATIENT_DELETE_REASON,
    };
  }

  return {
    action,
    patient_ids: patientIds,
    ...(trimmedReason ? { reason: trimmedReason } : {}),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BulkActionRequestBody;
    const payload = buildBulkPayload(body || {});

    const { response, data } = await callAdminBackend("/admin/patients/bulk-action", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return respondFromBackend(response, data, { message: "Bulk action completed" });
  } catch (error) {
    console.error("Admin patients bulk-action proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
