"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Calendar, RefreshCw, UserCheck, Users, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getAdminNotifications,
  markAdminNotificationsRead,
  type AdminNotificationRow,
} from "@/lib/admin-actions";

function iconForType(type: string) {
  if (type.includes("reschedule")) return <RefreshCw className="h-5 w-5 text-amber-500" />;
  if (type.includes("appointment")) return <Calendar className="h-5 w-5 text-orange-400" />;
  if (type.includes("verification") || type.includes("doctor")) return <UserCheck className="h-5 w-5 text-yellow-400" />;
  if (type.includes("registration") || type.includes("patient")) return <Users className="h-5 w-5 text-blue-400" />;
  return <Bell className="h-5 w-5 text-muted-foreground" />;
}

function formatRelative(iso: string | null) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AdminNotifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await getAdminNotifications({ limit: 50 });
      setNotifications(Array.isArray(result?.notifications) ? result.notifications : []);
      setUnreadCount(Number(result?.unread_count || 0));
    } catch (error) {
      console.error("Failed to fetch admin notifications:", error);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(fetchNotifications, 0);
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification: AdminNotificationRow) => {
    if (!notification.is_read) {
      try {
        await markAdminNotificationsRead([notification.id]);
      } catch (error) {
        console.error("Failed to mark notification read:", error);
      }
    }
    setOpen(false);
    if (notification.action_url) {
      router.push(notification.action_url);
    }
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await markAdminNotificationsRead("all");
      await fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all read:", error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground hover:bg-card/60"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-primary-foreground text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-card border-border text-foreground w-full sm:w-[min(24rem,92vw)] max-w-full sm:max-w-[min(24rem,92vw)] flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-primary-foreground">{unreadCount}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {unreadCount > 0 && (
          <div className="mt-2 flex justify-end shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark all read
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-2 -mr-2">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No new notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className="p-3 sm:p-4 rounded-lg bg-card/60 border border-border/50 hover:border-primary/50 cursor-pointer transition-all group"
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="flex-shrink-0 mt-1">{iconForType(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors truncate">
                        {notification.title}
                      </h4>
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                      {notification.message}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(notification.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border shrink-0">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground hover:bg-card/60"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
