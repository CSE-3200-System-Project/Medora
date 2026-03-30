import { MedoraLoader } from "@/components/ui/medora-loader";
import { getTranslations } from "next-intl/server";

export default async function HomeLoading() {
  const t = await getTranslations();
  return <MedoraLoader size="lg" label={t("common.loading")} fullScreen />;
}
