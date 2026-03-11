import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ClearAdminPage() {
  const cookieStore = await cookies();

  cookieStore.delete("admin_access");
  cookieStore.delete("user_role");
  cookieStore.delete("session_token");
  cookieStore.delete("onboarding_completed");

  redirect("/");
}
