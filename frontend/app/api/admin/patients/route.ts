import { NextRequest } from "next/server";
import { proxyAdminJson } from "./_proxy";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || "1"));
  const pageSize = Math.max(1, Number(params.get("pageSize") || "10"));
  const search = params.get("search") || "";
  const status = params.get("status") || "all";

  const backendParams = new URLSearchParams({
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
    page: String(page),
    page_size: String(pageSize),
    status,
  });

  if (search.trim()) {
    backendParams.set("search", search.trim());
  }

  return proxyAdminJson(`/admin/patients?${backendParams.toString()}`);
}

export async function POST(request: NextRequest) {
  const payload = await request.json();

  return proxyAdminJson("/admin/patients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
