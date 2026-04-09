import { AppBackground } from "@/components/ui/app-background";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";

export default function HomeLoading() {
  return (
    <AppBackground className="container-padding">
      <main className="mx-auto max-w-6xl py-8 pt-[var(--nav-content-offset)]">
        <PageLoadingShell label="Loading..." cardCount={4} />
      </main>
    </AppBackground>
  );
}
