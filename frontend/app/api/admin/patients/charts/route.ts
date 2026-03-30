import { proxyAdminJson } from "../_proxy";

export async function GET() {
  return proxyAdminJson("/admin/patients/charts");
}
