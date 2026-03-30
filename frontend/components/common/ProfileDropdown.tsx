"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, Shield, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type ProfileDropdownProps = {
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  profileHref: string;
  settingsHref: string;
  privacyHref: string;
  logoutLabel?: string;
  onLogout: () => void;
  isLoggingOut?: boolean;
  className?: string;
};

export function ProfileDropdown({
  name,
  email,
  avatarUrl,
  initials,
  profileHref,
  settingsHref,
  privacyHref,
  logoutLabel = "Logout",
  onLogout,
  isLoggingOut = false,
  className,
}: ProfileDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("relative z-[85] overflow-visible", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2 transition-colors hover:bg-accent"
      >
        <Avatar className="h-8 w-8 border border-primary/20">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold text-foreground">{name}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </button>

      <div
        className={cn(
          "absolute right-0 top-full z-[95] mt-2 w-64 origin-top-right rounded-xl border border-gray-200 bg-white p-2 shadow-lg transition-all duration-200 dark:border-gray-700 dark:bg-gray-900",
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="rounded-lg px-3 py-2">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>

        <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex flex-col gap-1" role="menu" aria-label="Profile actions">
          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            role="menuitem"
          >
            <User className="h-4 w-4" />
            <span>Profile</span>
          </Link>

          <Link
            href={settingsHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            role="menuitem"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>

          <Link
            href={privacyHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            role="menuitem"
          >
            <Shield className="h-4 w-4" />
            <span>Privacy &amp; Data</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            disabled={isLoggingOut}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
            role="menuitem"
          >
            <LogOut className="h-4 w-4" />
            <span>{isLoggingOut ? "Logging out..." : logoutLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
