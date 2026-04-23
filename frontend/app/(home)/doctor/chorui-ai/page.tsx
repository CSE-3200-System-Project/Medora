import { Inter, Manrope } from "next/font/google";
import { redirect } from "next/navigation";

import { ChoruiChat } from "@/components/ai/ChoruiChat";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { getCurrentUser } from "@/lib/auth-actions";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default async function DoctorChoruiAIPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const roleValue = typeof user?.role === "string" ? user.role : user?.role?.value ?? "";
  if (roleValue.toLowerCase() !== "doctor") {
    if (roleValue.toLowerCase() === "patient") {
      redirect("/patient/chorui-ai");
    }
    if (roleValue.toLowerCase() === "admin") {
      redirect("/admin");
    }
    redirect("/");
  }

  return (
    <AppBackground className={`${manrope.variable} ${inter.variable}`}>
      <Navbar />
      <main className="mx-auto w-full max-w-7xl page-content pt-[var(--nav-content-offset)]">
        <div className="mb-6 max-w-3xl">
          <p className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Doctor Workflow Assistant
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use a patient ID from your list in your prompt for secure patient-linked AI context.
          </p>
        </div>
        <ChoruiChat roleContext="doctor" />
      </main>
    </AppBackground>
  );
}

