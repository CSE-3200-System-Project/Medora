import { NextRequest } from "next/server";
import { proxyAdminJson } from "../../_proxy";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const payload = await request.json();

  return proxyAdminJson(`/admin/patients/${id}/ban`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
