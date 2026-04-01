"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, UserCheck, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getAdminStats } from "@/lib/admin-actions";

type Notification = {
  id: string;
  type: "pending_doctor" | "new_registration" | "pending_appointment";
  title: string;
  message: string;
  link: string;
  icon: React.ReactNode;
  time: string;
  unread: boolean;
};

export function AdminNotifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const stats = await getAdminStats();

      const notifs: Notification[] = [];

      // Pending doctor verifications
      if (stats.pending_doctors > 0) {
        notifs.push({
          id: "pending_doctors",
          type: "pending_doctor",
          title: "Pending Doctor Verifications",
          message: `${stats.pending_doctors} doctor${
            stats.pending_doctors > 1 ? "s" : ""
          } awaiting verification`,
          link: "/admin/doctors",
          icon: <UserCheck className="h-5 w-5 text-yellow-400" />,
          time: "Now",
          unread: true,
        });
      }

      // Recent registrations
      if (stats.recent_registrations_7days > 0) {
        notifs.push({
          id: "new_registrations",
          type: "new_registration",
          title: "New User Registrations",
          message: `${stats.recent_registrations_7days} new user${
            stats.recent_registrations_7days > 1 ? "s" : ""
          } registered this week`,
          link: "/admin/users",
          icon: <Users className="h-5 w-5 text-blue-400" />,
          time: "This week",
          unread: true,
        });
      }

      // Pending appointments
      if (stats.pending_appointments > 0) {
        notifs.push({
          id: "pending_appointments",
          type: "pending_appointment",
          title: "Pending Appointments",
          message: `${stats.pending_appointments} appointment${
            stats.pending_appointments > 1 ? "s" : ""
          } pending`,
          link: "/admin/appointments",
          icon: <Calendar className="h-5 w-5 text-orange-400" />,
          time: "Today",
          unread: true,
        });
      }

      setNotifications(notifs);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(fetchNotifications, 0);
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const handleNotificationClick = (notification: Notification) => {
    router.push(notification.link);
    setOpen(false);
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

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

        <div className="flex-1 overflow-y-auto mt-6 space-y-3 pr-2 -mr-2">
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
                  <div className="flex-shrink-0 mt-1">{notification.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors truncate">
                        {notification.title}
                      </h4>
                      {notification.unread && (
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                      {notification.message}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {notification.time}
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

