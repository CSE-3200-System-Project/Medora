"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Trash2, X, Calendar, UserPlus, ShieldCheck, ShieldX, AlertCircle, Info, Pill, FlaskConical, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  type Notification,
  type NotificationType,
} from "@/lib/notification-actions";

interface NotificationDropdownProps {
  className?: string;
}

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
  consultation_started: FileText,
  consultation_completed: CheckCheck,
  prescription_created: Pill,
  prescription_accepted: Check,
  prescription_rejected: X,
};

// Color mapping for notification types
const notificationColors: Record<NotificationType, string> = {
  appointment_booked: "text-primary bg-primary/10",
  appointment_confirmed: "text-success bg-success/10",
  appointment_cancelled: "text-destructive bg-destructive/10",
  appointment_completed: "text-success bg-success/10",
  appointment_reminder: "text-yellow-600 bg-yellow-100",
  new_patient: "text-primary bg-primary/10",
  patient_checkin: "text-primary bg-primary/10",
  doctor_available: "text-primary bg-primary/10",
  access_requested: "text-yellow-600 bg-yellow-100",
  access_granted: "text-success bg-success/10",
  access_revoked: "text-destructive bg-destructive/10",
  verification_pending: "text-yellow-600 bg-yellow-100",
  verification_approved: "text-success bg-success/10",
  verification_rejected: "text-destructive bg-destructive/10",
  profile_update: "text-primary bg-primary/10",
  onboarding_reminder: "text-yellow-600 bg-yellow-100",
  system_announcement: "text-primary bg-primary/10",
  welcome: "text-primary bg-primary/10",
  medication_reminder: "text-blue-600 bg-blue-100",
  test_reminder: "text-purple-600 bg-purple-100",
  consultation_started: "text-primary bg-primary/10",
  consultation_completed: "text-success bg-success/10",
  prescription_created: "text-blue-600 bg-blue-100",
  prescription_accepted: "text-success bg-success/10",
  prescription_rejected: "text-destructive bg-destructive/10",
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationDropdown({ className }: NotificationDropdownProps) {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  // Fetch notifications on mount and periodically
  React.useEffect(() => {
    fetchUnreadCount();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch full notifications when dropdown opens
  React.useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchUnreadCount = async () => {
    const count = await getUnreadCount();
    setUnreadCount(count);
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotifications(10, 0, false);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Immediately update UI - reduce count before API call for responsive feel
    if (!notification.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      // Then make API call (fire and forget for responsiveness)
      markNotificationAsRead(notification.id);
    }

    // Navigate to action URL if present
    if (notification.action_url) {
      setIsOpen(false);
      router.push(notification.action_url);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    router.push("/notifications");
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    // Update unread count if deleted notification was unread
    const deletedNotification = notifications.find((n) => n.id === notificationId);
    if (deletedNotification && !deletedNotification.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 md:w-96 max-h-[70vh] overflow-hidden flex flex-col"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DropdownMenuLabel className="p-0 text-base font-semibold">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs text-primary hover:text-primary"
              onClick={handleMarkAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || Info;
                const colorClass = notificationColors[notification.type] || "text-primary bg-primary/10";

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50",
                      !notification.is_read && "bg-primary/5"
                    )}
                  >
                    {/* Icon */}
                    <div className={cn("shrink-0 rounded-full p-2", colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm line-clamp-1",
                        !notification.is_read && "font-semibold"
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-1">
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => handleDelete(e, notification.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full text-sm text-primary hover:text-primary hover:bg-primary/10"
                onClick={handleViewAll}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
