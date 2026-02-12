"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  X, 
  Calendar, 
  UserPlus, 
  ShieldCheck, 
  ShieldX, 
  AlertCircle, 
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
  Pill,
  FlaskConical,
  Stethoscope,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type Notification,
  type NotificationType,
} from "@/lib/notification-actions";

// Icon mapping for notification types
const notificationIcons: Record<NotificationType, React.ElementType> = {
  appointment_booked: Calendar,
  appointment_confirmed: Check,
  appointment_cancelled: X,
  appointment_completed: CheckCheck,
  appointment_reminder: AlertCircle,
  new_patient: UserPlus,
  patient_checkin: UserPlus,
  doctor_available: UserPlus,
  access_requested: ShieldCheck,
  access_granted: ShieldCheck,
  access_revoked: ShieldX,
  verification_pending: AlertCircle,
  verification_approved: ShieldCheck,
  verification_rejected: ShieldX,
  profile_update: Info,
  onboarding_reminder: AlertCircle,
  system_announcement: Info,
  welcome: Info,
  medication_reminder: Pill,
  test_reminder: FlaskConical,
  // Consultation & Prescription types
  consultation_started: Stethoscope,
  consultation_completed: CheckCheck,
  prescription_created: FileText,
  prescription_accepted: Check,
  prescription_rejected: X,
};

// Color mapping for notification types
const notificationColors: Record<NotificationType, string> = {
  appointment_booked: "text-primary bg-primary/10",
  appointment_confirmed: "text-green-600 bg-green-100",
  appointment_cancelled: "text-red-600 bg-red-100",
  appointment_completed: "text-green-600 bg-green-100",
  appointment_reminder: "text-yellow-600 bg-yellow-100",
  new_patient: "text-primary bg-primary/10",
  patient_checkin: "text-primary bg-primary/10",
  doctor_available: "text-primary bg-primary/10",
  access_requested: "text-yellow-600 bg-yellow-100",
  access_granted: "text-green-600 bg-green-100",
  access_revoked: "text-red-600 bg-red-100",
  verification_pending: "text-yellow-600 bg-yellow-100",
  verification_approved: "text-green-600 bg-green-100",
  verification_rejected: "text-red-600 bg-red-100",
  profile_update: "text-primary bg-primary/10",
  onboarding_reminder: "text-yellow-600 bg-yellow-100",
  system_announcement: "text-primary bg-primary/10",
  welcome: "text-primary bg-primary/10",
  medication_reminder: "text-blue-600 bg-blue-100",
  test_reminder: "text-purple-600 bg-purple-100",
  // Consultation & Prescription colors
  consultation_started: "text-primary bg-primary/10",
  consultation_completed: "text-green-600 bg-green-100",
  prescription_created: "text-primary bg-primary/10",
  prescription_accepted: "text-green-600 bg-green-100",
  prescription_rejected: "text-red-600 bg-red-100",
};

type FilterType = 'all' | 'unread' | 'read';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchNotifications();
  }, [page, filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const unreadOnly = filter === 'unread';
      const data = await getNotifications(limit, page * limit, unreadOnly);
      
      let filtered = data.notifications;
      if (filter === 'read') {
        filtered = data.notifications.filter(n => n.is_read);
      }
      
      setNotifications(filtered);
      setTotal(data.total);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read immediately
    if (!notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      markNotificationAsRead(notification.id);
    }

    // Navigate if action URL exists
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    const notification = notifications.find(n => n.id === notificationId);
    
    await deleteNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto container-padding py-8 pt-24 md:pt-28">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-7 h-7 text-primary" />
              Notifications
            </h1>
            <p className="text-muted-foreground mt-1">
              {unreadCount > 0 ? (
                <span>You have <span className="font-semibold text-primary">{unreadCount}</span> unread notifications</span>
              ) : (
                "All caught up!"
              )}
            </p>
          </div>
          
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-primary border-primary hover:bg-primary/10"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => { setFilter('all'); setPage(0); }}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === 'unread' ? 'default' : 'outline'}
            onClick={() => { setFilter('unread'); setPage(0); }}
            className={cn(filter === 'unread' && "bg-primary")}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Button>
          <Button
            size="sm"
            variant={filter === 'read' ? 'default' : 'outline'}
            onClick={() => { setFilter('read'); setPage(0); }}
          >
            Read
          </Button>
        </div>

        {/* Notifications List */}
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-lg font-medium">No notifications</p>
                <p className="text-sm">
                  {filter === 'unread' ? "You're all caught up!" : "No notifications to show"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => {
                  const Icon = notificationIcons[notification.type] || Info;
                  const colorClass = notificationColors[notification.type] || "text-primary bg-primary/10";

                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "flex items-start gap-4 p-4 cursor-pointer transition-colors hover:bg-accent/50",
                        !notification.is_read && "bg-primary/5"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn("shrink-0 rounded-full p-3", colorClass)}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={cn(
                              "text-sm",
                              !notification.is_read && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                          </div>
                          
                          {!notification.is_read && (
                            <div className="shrink-0 h-2.5 w-2.5 rounded-full bg-primary mt-1" />
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDelete(e, notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-4">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </main>
    </AppBackground>
  );
}
