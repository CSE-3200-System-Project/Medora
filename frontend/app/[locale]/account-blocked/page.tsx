import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ArrowLeft } from "lucide-react";

export default async function AccountBlockedPage() {
  const t = await getTranslations("accountBlocked");
  const cookieStore = await cookies();
  const reason = cookieStore.get("account_blocked_reason")?.value || t("fallbackReason");

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-3xl space-y-6">
          <nav aria-label={t("breadcrumbAriaLabel")} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/login" className="transition-colors hover:text-gray-700 dark:hover:text-gray-200">
              {t("home")}
            </Link>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span className="text-gray-700 dark:text-gray-200">{t("status")}</span>
          </nav>

          <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-8">
            <div className="flex flex-col gap-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-7 w-7" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("title")}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t("message")}</p>
              </div>

              <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("reason")}</p>
                <p className="mt-2 wrap-break-word text-sm text-gray-700 dark:text-gray-300">{reason}</p>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {t("help")}
                </p>
                <p className="mt-1 text-sm text-red-700 dark:text-red-200">
                  {t("contact")} <span className="font-semibold">support@medora.com</span>
                </p>
              </div>

              <div>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {t("back")}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
