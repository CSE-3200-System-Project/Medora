import { NextRequest } from "next/server";
import { proxyAdminJson } from "../_proxy";

export async function POST(request: NextRequest) {
  const payload = await request.json();

  return proxyAdminJson("/admin/patients/bulk-action", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
