import { NextRequest } from "next/server";
import { proxyAdminJson } from "../_proxy";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return proxyAdminJson(`/admin/patients/${id}`);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const payload = await request.json();

  return proxyAdminJson(`/admin/patients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const payload = await request.json();

  return proxyAdminJson(`/admin/patients/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return proxyAdminJson(`/admin/patients/${id}`, {
    method: "DELETE",
  });
}
