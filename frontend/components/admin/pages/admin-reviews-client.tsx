"use client";

import React from "react";
import { CheckCircle2, Clock3, MessageSquare, RefreshCw, Star, XCircle } from "lucide-react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScrollContainer,
} from "@/components/ui/table";
import { ButtonLoader } from "@/components/ui/medora-loader";
import {
  approveAdminReview,
  getAdminReviews,
  rejectAdminReview,
  type AdminReviewRow,
  type AdminReviewStatus,
} from "@/lib/admin-actions";
import { toast } from "@/lib/notify";

interface AdminReviewsClientProps {
  initialReviews: AdminReviewRow[];
  initialTotal: number;
  initialHasMore: boolean;
}

const PAGE_SIZE = 20;
const FILTERS: AdminReviewStatus[] = ["PENDING", "APPROVED", "REJECTED"];

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={star <= value ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

function statusTone(status: AdminReviewStatus) {
  if (status === "APPROVED") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
  if (status === "REJECTED") return "bg-destructive/10 text-destructive";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-200";
}

export function AdminReviewsClient({
  initialReviews,
  initialTotal,
  initialHasMore,
}: AdminReviewsClientProps) {
  const [status, setStatus] = React.useState<AdminReviewStatus>("PENDING");
  const [reviews, setReviews] = React.useState<AdminReviewRow[]>(initialReviews);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(initialTotal);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [actingId, setActingId] = React.useState<string | null>(null);
  const [rejectingReview, setRejectingReview] = React.useState<AdminReviewRow | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const loadReviews = React.useCallback(async (nextStatus: AdminReviewStatus, nextPage = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const payload = await getAdminReviews(nextStatus, nextPage, PAGE_SIZE);
      setStatus(nextStatus);
      setPage(payload.page);
      setTotal(payload.total);
      setHasMore(payload.has_more);
      setReviews((current) => (append ? [...current, ...payload.reviews] : payload.reviews));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load reviews");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const refreshCurrent = React.useCallback(async () => {
    await loadReviews(status, 1, false);
  }, [loadReviews, status]);

  const handleApprove = React.useCallback(
    async (reviewId: string) => {
      setActingId(reviewId);
      try {
        await approveAdminReview(reviewId);
        toast.success("Review approved and published");
        await refreshCurrent();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to approve review");
      } finally {
        setActingId(null);
      }
    },
    [refreshCurrent],
  );

  const handleReject = React.useCallback(async () => {
    if (!rejectingReview) return;
    setActingId(rejectingReview.review.id);
    try {
      await rejectAdminReview(rejectingReview.review.id, rejectReason.trim() || undefined);
      toast.success("Review rejected");
      setRejectingReview(null);
      setRejectReason("");
      await refreshCurrent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject review");
    } finally {
      setActingId(null);
    }
  }, [refreshCurrent, rejectReason, rejectingReview]);

  return (
    <>
      <AdminNavbar />

      <main className="mx-auto max-w-7xl space-y-6 p-4 pt-[var(--nav-content-offset)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl md:text-3xl">Review Moderation</h1>
            <p className="text-sm text-muted-foreground">
              Approve or reject patient reviews before they become public and affect doctor ratings.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refreshCurrent()} disabled={loading}>
            {loading ? <ButtonLoader className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Button
              key={filter}
              variant={status === filter ? "default" : "outline"}
              onClick={() => {
                if (filter === status) return;
                void loadReviews(filter, 1, false);
              }}
            >
              {filter === "PENDING" ? <Clock3 className="mr-2 h-4 w-4" /> : null}
              {filter === "APPROVED" ? <CheckCircle2 className="mr-2 h-4 w-4" /> : null}
              {filter === "REJECTED" ? <XCircle className="mr-2 h-4 w-4" /> : null}
              {filter}
            </Button>
          ))}
          <Badge variant="secondary" className="ml-auto rounded-full px-3 py-1 text-xs">
            {total} total
          </Badge>
        </div>

        {loading && reviews.length === 0 ? (
          <Card className="border-border/60 bg-card/70">
            <CardContent className="flex items-center justify-center py-12">
              <ButtonLoader className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        ) : reviews.length === 0 ? (
          <Card className="border-border/60 bg-card/70">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No reviews found for the current filter.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3 lg:hidden">
              {reviews.map((item) => {
                const busy = actingId === item.review.id;
                return (
                  <Card key={item.review.id} className="border-border/60 bg-card/70">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-foreground">{item.patient_name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">About {item.doctor_name}</p>
                        </div>
                        <Badge className={statusTone(item.review.status)}>{item.review.status}</Badge>
                      </div>
                      <Stars value={item.review.rating} />
                      <p className="text-sm text-foreground/85">{item.review.note || "No note provided."}</p>
                      {item.review.admin_feedback ? (
                        <p className="text-sm text-muted-foreground">Admin feedback: {item.review.admin_feedback}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Submitted {new Date(item.review.created_at).toLocaleString()}
                      </p>
                      {status === "PENDING" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => void handleApprove(item.review.id)} disabled={busy}>
                            {busy ? <ButtonLoader className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setRejectingReview(item);
                              setRejectReason(item.review.admin_feedback || "");
                            }}
                            disabled={busy}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="hidden lg:block">
              <TableScrollContainer className="border-border/60 bg-card/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Review</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((item) => {
                      const busy = actingId === item.review.id;
                      return (
                        <TableRow key={item.review.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{item.patient_name}</p>
                              <p className="text-xs text-muted-foreground">{item.patient_email || "No email"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground">{item.doctor_name}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Stars value={item.review.rating} />
                              <span className="text-xs text-muted-foreground">{item.review.rating}/5</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="space-y-1">
                              <p className="text-sm text-foreground/85">{item.review.note || "No note provided."}</p>
                              {item.review.admin_feedback ? (
                                <p className="text-xs text-muted-foreground">
                                  Admin feedback: {item.review.admin_feedback}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusTone(item.review.status)}>{item.review.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(item.review.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {status === "PENDING" ? (
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => void handleApprove(item.review.id)} disabled={busy}>
                                  {busy ? (
                                    <ButtonLoader className="mr-2 h-4 w-4" />
                                  ) : (
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRejectingReview(item);
                                    setRejectReason(item.review.admin_feedback || "");
                                  }}
                                  disabled={busy}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">No actions</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableScrollContainer>
            </div>

            {hasMore ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => void loadReviews(status, page + 1, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? <ButtonLoader className="mr-2 h-4 w-4" /> : null}
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </main>

      <Dialog
        open={Boolean(rejectingReview)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingReview(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject review</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This feedback will be shown to the patient if their review is rejected.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Explain why the review was rejected"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingReview(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleReject()} disabled={!rejectingReview}>
              Reject review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
