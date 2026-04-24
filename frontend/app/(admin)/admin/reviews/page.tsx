import { AdminReviewsClient } from "@/components/admin/pages/admin-reviews-client";
import { getAdminReviews } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const initial = await getAdminReviews("PENDING", 1, 20).catch(() => ({
    reviews: [],
    total: 0,
    page: 1,
    limit: 20,
    has_more: false,
  }));

  return (
    <AdminReviewsClient
      initialReviews={initial.reviews}
      initialTotal={initial.total}
      initialHasMore={initial.has_more}
    />
  );
}
