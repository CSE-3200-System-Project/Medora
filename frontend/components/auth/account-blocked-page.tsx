import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, ArrowLeft, ChevronRight } from "lucide-react";

const FALLBACK_REASON = "Your account is currently suspended.";

export async function AccountBlockedContent() {
  const cookieStore = await cookies();
  const reason = cookieStore.get("account_blocked_reason")?.value || FALLBACK_REASON;
  const message =
    cookieStore.get("account_blocked_message")?.value ||
    "Your account has been suspended by the administrator.";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="w-full max-w-3xl space-y-6">
          <nav aria-label="Account blocked breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/login" className="transition-colors hover:text-foreground">
              Login
            </Link>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span className="text-foreground">Account Status</span>
          </nav>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <AlertTriangle className="h-7 w-7" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Account Suspended</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>

              <div className="rounded-lg bg-secondary p-4">
                <p className="text-sm font-semibold text-foreground">Suspension Reason</p>
                <p className="mt-2 break-words text-sm text-muted-foreground">{reason}</p>
              </div>

              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">Need help?</p>
                <p className="mt-1 text-sm text-destructive">
                  Contact support at <span className="font-semibold">support@medora.com</span>
                </p>
              </div>

              <div>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to Login
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
