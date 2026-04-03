import PageClient from "@/components/screens/pages/auth/auth-login-client";

type LoginPageProps = {
  searchParams?: Promise<{
    verified?: string;
  }>;
};

export default async function Page({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const initiallyVerified = resolvedSearchParams?.verified === "true";

  return <PageClient initiallyVerified={initiallyVerified} />;
}
