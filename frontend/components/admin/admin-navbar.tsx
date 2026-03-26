"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  Users,
  UserCheck,
  Calendar,
  ClipboardList,
  Settings,
  LogOut,
  Shield,
  Ban,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateDefaultAvatarUrl } from "@/lib/avatar";
import { clearAdminAccess } from "@/lib/admin-actions";
import { AdminNotifications } from "@/components/admin/admin-notifications";

import logo from "@/assets/images/medora-logo.png";

export function AdminNavbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const adminAvatarUrl = generateDefaultAvatarUrl("medora-admin");

  React.useEffect(() => {
    let frameId = 0;
    const handleScroll = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
        frameId = 0;
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Clear admin access cookies using server action
      await clearAdminAccess();
      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
    }
  };

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Doctors", href: "/admin/doctors", icon: UserCheck },
    { name: "Patients", href: "/admin/patients", icon: Users },
    { name: "Appointments", href: "/admin/appointments", icon: Calendar },
    { name: "Audit Log", href: "/admin/audit-log", icon: ClipboardList },
    { name: "User Management", href: "/admin/users", icon: Ban },
  ];

  return (
    <header
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + var(--nav-top-offset))",
        left: "0",
        right: "0",
      }}
      className="fixed z-50 px-2 sm:px-3"
    >
      <div
        className={cn(
          "mx-auto max-w-7xl transition-[background-color,border-color,box-shadow,backdrop-filter] duration-(--motion-duration-fast) ease-(--motion-ease-standard)",
          "rounded-2xl border border-border/70 bg-background/85 backdrop-blur-xl",
          "shadow-[0_14px_32px_-24px_rgba(3,96,217,0.8)] dark:bg-card/75",
          isScrolled ? "bg-background/92 dark:bg-card/88 border-border/80 shadow-[0_16px_36px_-22px_rgba(3,96,217,0.85)]" : ""
        )}
      >
        <div className="flex h-16 md:h-18 items-center justify-between px-3 sm:px-4 md:px-6">
          {/* LEFT: Logo & Title */}
          <Link href="/admin" className="flex items-center gap-2 sm:gap-3 touch-target">
            <div className="relative h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14">
              <Image
                src={logo}
                alt="Medora"
                fill
                sizes="(max-width: 640px) 40px, (max-width: 768px) 48px, 56px"
                className="object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-primary">Medora</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-warning text-warning-foreground font-semibold">
                  ADMIN
                </span>
              </div>
            </div>
          </Link>

          {/* CENTER: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-foreground/80 hover:text-primary hover:bg-accent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: User Menu */}
          <div className="hidden lg:flex items-center gap-2 md:gap-3">
            {/* Notifications */}
            <AdminNotifications />

            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl"
            >
              <Settings className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border/60">
              <Avatar className="h-8 w-8 border border-primary/20">
                <AvatarImage src={adminAvatarUrl} alt="Admin" />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  AD
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold text-foreground">Admin</span>
            </div>

            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {loggingOut ? "Logging out..." : "Logout"}
            </Button>
          </div>

          {/* MOBILE: Hamburger */}
          <div className="lg:hidden flex items-center gap-1.5">
            <AdminNotifications />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground touch-target rounded-xl hover:bg-accent/80"
                >
                  <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(88vw,22rem)] border-l border-border/70 px-0"
            >
              <SheetHeader className="border-b border-border/60 px-5 pb-4 pt-5">
                <SheetTitle className="flex items-center gap-2">
                  <Link href="/admin" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                    <div className="relative h-8 w-8">
                      <Image src={logo} alt="Medora" fill className="object-contain" />
                    </div>
                    <span>Medora</span>
                  </Link>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-warning text-warning-foreground font-semibold">
                    ADMIN
                  </span>
                </SheetTitle>
              </SheetHeader>

              <div
                className="no-scrollbar flex h-full flex-col overflow-y-auto px-3 pb-5 pt-4"
                onClickCapture={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("a")) {
                    setMobileMenuOpen(false);
                  }
                }}
              >
                <div className="flex flex-col gap-2">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3 text-base font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground border-primary/50"
                            : "text-foreground hover:bg-accent/60 hover:text-primary"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-auto flex flex-col gap-4 border-t border-border pt-4">
                  <div className="flex items-center gap-3 px-2">
                    <Avatar className="h-10 w-10 border-2 border-primary/10">
                      <AvatarImage src={adminAvatarUrl} alt="Admin" />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        AD
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1">
                      <span className="font-semibold text-foreground">Admin</span>
                      <span className="text-xs text-muted-foreground">Administrator</span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {loggingOut ? "Logging out..." : "Logout"}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
