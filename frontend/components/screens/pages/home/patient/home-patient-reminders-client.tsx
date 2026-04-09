"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft,
  Bell,
  BellOff,
  Clock,
  Pill,
  FlaskConical,
  Trash2,
  Calendar,
  AlertCircle
} from "lucide-react";
import { MedoraLoader, ButtonLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import {
  getReminders,
  deleteReminder,
  toggleReminder,
  type Reminder,
  type ReminderType
} from "@/lib/reminder-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PatientRemindersPage() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReminderType | "all">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getReminders();
      setReminders(data.reminders);
    } catch (err: any) {
      setError(err.message || "Failed to load reminders");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (reminderId: string) => {
    try {
      setActionLoading(reminderId);
      const updated = await toggleReminder(reminderId);
      setReminders(prev => prev.map(r => r.id === reminderId ? updated : r));
    } catch (err: any) {
      console.error("Failed to toggle reminder:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!reminderToDelete) return;
    
    try {
      setActionLoading(reminderToDelete);
      await deleteReminder(reminderToDelete);
      setReminders(prev => prev.filter(r => r.id !== reminderToDelete));
      setDeleteDialogOpen(false);
      setReminderToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete reminder:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReminders = filter === "all" 
    ? reminders 
    : reminders.filter(r => r.type === filter);

  const medicationCount = reminders.filter(r => r.type === "medication").length;
  const testCount = reminders.filter(r => r.type === "test").length;
  const activeCount = reminders.filter(r => r.is_active).length;

  return (
    <>
      <Navbar />
      <AppBackground>
        <div className="min-h-dvh min-h-app pt-[var(--nav-content-offset)] pb-8">
          {/* Header */}
          <div className="bg-background/80 backdrop-blur-md border-b border-border sticky top-16 z-10">
            <div className="container mx-auto px-4 py-4 max-w-4xl">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => router.back()}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Reminders</h1>
                  <p className="text-sm text-muted-foreground">Manage your medication and test reminders</p>
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 py-6 max-w-4xl">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card hoverable className="text-center">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Bell className="w-4 h-4 text-primary" />
                    <span className="text-2xl font-bold text-foreground">{activeCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Active</p>
                </CardContent>
              </Card>
              <Card hoverable className="text-center">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Pill className="w-4 h-4 text-blue-600" />
                    <span className="text-2xl font-bold text-foreground">{medicationCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Medications</p>
                </CardContent>
              </Card>
              <Card hoverable className="text-center">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <FlaskConical className="w-4 h-4 text-purple-600" />
                    <span className="text-2xl font-bold text-foreground">{testCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Tests</p>
                </CardContent>
              </Card>
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-6 overflow-hidden">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All ({reminders.length})
              </Button>
              <Button
                variant={filter === "medication" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("medication")}
                className="gap-1"
              >
                <Pill className="w-3 h-3" />
                Medications ({medicationCount})
              </Button>
              <Button
                variant={filter === "test" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("test")}
                className="gap-1"
              >
                <FlaskConical className="w-3 h-3" />
                Tests ({testCount})
              </Button>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="space-y-4 py-4">
                <div className="flex justify-center py-2">
                  <MedoraLoader size="lg" label="Loading reminders..." />
                </div>
                <CardSkeleton />
                <CardSkeleton />
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <Card className="border-destructive/20">
                <CardContent className="pt-6 pb-6">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <AlertCircle className="w-10 h-10 text-destructive" />
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" onClick={fetchReminders}>
                      Try Again
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!loading && !error && filteredReminders.length === 0 && (
              <Card>
                <CardContent className="pt-12 pb-12">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <BellOff className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">No reminders set</h3>
                      <p className="text-sm text-muted-foreground">
                        {filter === "all" 
                          ? "You haven't set any reminders yet. Go to your medical history to add reminders for your medications or tests."
                          : `No ${filter} reminders found.`}
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => router.push("/patient/medical-history")}
                    >
                      Go to Medical History
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reminders List */}
            {!loading && !error && filteredReminders.length > 0 && (
              <div className="space-y-4">
                {filteredReminders.map((reminder) => (
                  <Card 
                    key={reminder.id} 
                    hoverable
                    className={!reminder.is_active ? "opacity-60" : ""}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`p-3 rounded-xl ${
                          reminder.type === "medication" 
                            ? "bg-blue-100 dark:bg-blue-900/30" 
                            : "bg-purple-100 dark:bg-purple-900/30"
                        }`}>
                          {reminder.type === "medication" ? (
                            <Pill className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <FlaskConical className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-foreground truncate">
                                {reminder.item_name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {reminder.type === "medication" ? "Medication" : "Test"}
                                </Badge>
                                {!reminder.is_active && (
                                  <Badge variant="secondary" className="text-xs">
                                    Paused
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            {/* Toggle */}
                            <Switch
                              checked={reminder.is_active}
                              onCheckedChange={() => handleToggle(reminder.id)}
                              disabled={actionLoading === reminder.id}
                            />
                          </div>

                          {/* Times */}
                          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">
                              {reminder.reminder_times && reminder.reminder_times.length > 0 
                                ? reminder.reminder_times.join(", ")
                                : "No time set"}
                            </span>
                          </div>

                          {/* Days */}
                          {reminder.days_of_week.length > 0 && reminder.days_of_week.length < 7 && (
                            <div className="flex items-center gap-2 mt-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <div className="flex gap-1">
                                {DAYS_OF_WEEK.map((day, index) => (
                                  <span
                                    key={day}
                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                      reminder.days_of_week.includes(index)
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {day}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {(reminder.days_of_week.length === 0 || reminder.days_of_week.length === 7) && (
                            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>Every day</span>
                            </div>
                          )}

                          {/* Notes */}
                          {reminder.notes && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {reminder.notes}
                            </p>
                          )}

                          {/* Actions */}
                          <div className="flex justify-end mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setReminderToDelete(reminder.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </AppBackground>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reminder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this reminder? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setReminderToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading === reminderToDelete}
            >
              {actionLoading === reminderToDelete ? (
                <ButtonLoader className="mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
