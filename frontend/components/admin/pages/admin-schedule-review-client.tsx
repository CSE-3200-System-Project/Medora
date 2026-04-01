"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppBackground } from "@/components/ui/app-background";

type ScheduleReviewDoctor = {
  profile_id: string;
  name: string;
  email: string;
  time_slots?: string;
  normalized_time_slots?: string;
};

export function AdminScheduleReviewClient() {
  const [password, setPassword] = useState("");
  const [doctors, setDoctors] = useState<ScheduleReviewDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ScheduleReviewDoctor | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/admin/schedule-review`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (e) {
      alert("Failed to fetch. Check admin password and try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const applyFix = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/admin/schedule-review/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ profile_id: selected.profile_id, normalized_time_slots: selected.normalized_time_slots }),
      });
      if (!res.ok) throw new Error("Failed to apply");
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
    <AppBackground className="min-h-dvh min-h-app px-4 py-6 animate-page-enter">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Schedule Review (Admin)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
                <Button onClick={fetchList} disabled={!password || loading} className="w-full sm:w-auto min-h-11">
                  {loading ? "Loading..." : "Fetch"}
                </Button>
              </div>

              <div className="space-y-2">
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
                      {saving ? "Applying..." : "Apply Fix"}
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
