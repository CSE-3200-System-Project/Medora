"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppBackground } from "@/components/ui/app-background";
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import {
  applyAdminScheduleFix,
  getAdminScheduleReview,
  type ScheduleReviewDoctor,
} from "@/lib/admin-actions";

export function AdminScheduleReviewClient() {
  const [doctors, setDoctors] = useState<ScheduleReviewDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ScheduleReviewDoctor | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      setDoctors(await getAdminScheduleReview());
    } catch (e) {
      alert("Failed to fetch. Sign in with an administrator account and try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const applyFix = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await applyAdminScheduleFix({
        profile_id: selected.profile_id,
        normalized_time_slots: selected.normalized_time_slots,
      });
      alert("Applied successfully");
      await fetchList();
      setSelected(null);
    } catch (e) {
      alert("Failed to apply");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppBackground className="min-h-dvh min-h-app animate-page-enter">
      <div className="mx-auto max-w-7xl space-y-6 p-4 pt-[var(--nav-content-offset)] sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Schedule Review (Admin)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={fetchList} disabled={loading} className="w-full sm:w-auto min-h-11">
                  {loading ? (
                    <>
                      <ButtonLoader className="h-4 w-4 mr-2" />
                      Loading...
                    </>
                  ) : "Fetch"}
                </Button>
              </div>

              <div className="space-y-2">
                {loading ? (
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-center">
                      <MedoraLoader size="sm" label="Loading doctors..." />
                    </div>
                    <CardSkeleton className="h-16" />
                    <CardSkeleton className="h-16" />
                  </div>
                ) : null}
                {doctors.map((d) => (
                  <div key={d.profile_id} className="p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-sm text-muted-foreground wrap-break-word">
                        {d.email} - {d.time_slots || "No time_slots"}
                      </div>
                    </div>
                    <div className="w-full sm:w-auto">
                      <Button variant="outline" onClick={() => setSelected(d)} className="w-full sm:w-auto min-h-11">
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {selected && (
                <div className="mt-4 p-4 border rounded-lg">
                  <div className="font-semibold">Editing: {selected.name}</div>
                  <div className="text-sm text-muted-foreground mb-2">Original: {selected.time_slots || "None"}</div>
                  <Textarea
                    value={selected.normalized_time_slots || ""}
                    onChange={(e) => setSelected({ ...selected, normalized_time_slots: e.target.value })}
                  />
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Button onClick={applyFix} disabled={saving} className="w-full sm:w-auto min-h-11">
                      {saving ? (
                        <>
                          <ButtonLoader className="h-4 w-4 mr-2" />
                          Applying...
                        </>
                      ) : "Apply Fix"}
                    </Button>
                    <Button variant="ghost" onClick={() => setSelected(null)} className="w-full sm:w-auto min-h-11">
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppBackground>
  );
}
