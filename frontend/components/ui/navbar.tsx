"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/auth-utils";
import { Menu, User, Settings, LogOut, FileText, Calendar, Shield, Activity, Users, FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationDropdown } from "@/components/ui/notification-dropdown";
import { ChoruiLauncher } from "@/components/ai/chorui-launcher";
import { resolveAvatarUrl } from "@/lib/avatar";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";

import medoraDarkLogo from "@/assets/images/Medora-Logo-Dark.png";
import medoraLightLogo from "@/assets/images/Medora-Logo-Light.png";


interface UserData {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  profile_photo_url?: string;
}

const USER_CACHE_KEY = "medora:user-cache:v1";
const USER_CACHE_TTL_MS = 5 * 60 * 1000;

function hasSessionToken() {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("session_token=");
}

function readCachedUser(): UserData | null {
  if (typeof window === "undefined") return null;

  const fromCache = sessionStorage.getItem(USER_CACHE_KEY);
  if (!fromCache) return null;

  try {
    const parsed = JSON.parse(fromCache) as { ts: number; user: UserData };
    if (Date.now() - parsed.ts < USER_CACHE_TTL_MS) {
      return parsed.user;
    }
  } catch {
    // Ignore invalid cache payload.
  }

  return null;
}

function inferRoleFromPath(pathname: string) {
  if (pathname.startsWith("/doctor")) return "doctor";
  if (pathname.startsWith("/patient")) return "patient";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [user, setUser] = React.useState<UserData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    const handleLogout = () => {
      sessionStorage.removeItem(USER_CACHE_KEY);
      if (isMounted) {
        setUser(null);
        setLoading(false);
      }
    };

    window.addEventListener("medora:logged_out", handleLogout);

    if (!hasSessionToken()) {
      setLoading(false);
      return () => {
        isMounted = false;
        window.removeEventListener("medora:logged_out", handleLogout);
      };
    }

    const cachedUser = readCachedUser();
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
      return () => {
        isMounted = false;
        window.removeEventListener("medora:logged_out", handleLogout);
      };
    }

    async function fetchUser() {
      try {
        const response = await fetchWithAuth("/api/auth/me");
        if (response?.ok) {
          const data = await response.json();
          if (isMounted) {
            setUser(data);
          }
          sessionStorage.setItem(
            USER_CACHE_KEY,
            JSON.stringify({
              ts: Date.now(),
              user: data,
            }),
          );
        }
      } catch {
        // Best effort user lookup.
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchUser();

    return () => {
      isMounted = false;
      window.removeEventListener("medora:logged_out", handleLogout);
    };
  }, []);

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
      sessionStorage.removeItem(USER_CACHE_KEY);
      // Redirect to logout route which handles cookie cleanup
      router.push('/logout');
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
    }
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    if (!user) return 'User';
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
  };

  const resolvedAvatarUrl = user
    ? resolveAvatarUrl(user.profile_photo_url, `${user.email || ""}${user.first_name || ""}${user.last_name || ""}`)
    : "";

  const inferredRole = inferRoleFromPath(pathname);
  const effectiveRole = loading ? null : user?.role?.toLowerCase() ?? inferredRole;

  // Compute role-aware home path
  const homePath =
    effectiveRole === "admin"
      ? "/admin"
      : effectiveRole === "doctor"
      ? "/doctor/home"
      : effectiveRole === "patient"
      ? "/patient/home"
      : "/";

  const showChoruiFab =
    !!user &&
    (user.role?.toLowerCase() === "patient" || user.role?.toLowerCase() === "doctor") &&
    !pathname.includes("/chorui-ai");
  const isActivePath = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
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
        {/* LEFT: Logo */}
        <Link href={homePath} className="flex flex-1 items-center gap-2 touch-target md:min-w-0">
          <div className="relative h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14">
            <Image
              src={medoraDarkLogo}
              alt="Medora"
              fill
              sizes="(max-width: 640px) 40px, (max-width: 768px) 48px, 56px"
              className="object-contain dark:hidden"
            />
            <Image
              src={medoraLightLogo}
              alt="Medora"
              fill
              sizes="(max-width: 640px) 40px, (max-width: 768px) 48px, 56px"
              className="hidden object-contain dark:block"
            />
          </div>
        </Link>

        {/* CENTER: Desktop Menu */}
        <div className="hidden md:flex flex-none justify-center">
          {loading ? (
            <CardSkeleton className="h-8 w-64 rounded-full" />
          ) : effectiveRole === "doctor" ? (
            <nav className="flex items-center gap-5 lg:gap-8 text-base font-medium text-foreground">
              <Link href="/doctor/appointments" className={cn("transition-colors hover:text-primary py-2", isActivePath("/doctor/appointments") && "text-primary font-semibold")}>
                Appointments
              </Link>
              <Link href="/doctor/patients" className={cn("transition-colors hover:text-primary py-2", isActivePath("/doctor/patients") && "text-primary font-semibold")}>
                Patients
              </Link>
              <Link href="/doctor/analytics" className={cn("transition-colors hover:text-primary py-2", isActivePath("/doctor/analytics") && "text-primary font-semibold")}>
                Analytics
              </Link>
            </nav>
          ) : effectiveRole === "patient" ? (
            <nav className="flex items-center gap-5 lg:gap-8 text-base font-medium text-foreground">
              <Link href="/patient/find-doctor" className={cn("transition-colors hover:text-primary py-2", isActivePath("/patient/find-doctor") && "text-primary font-semibold")}>
                Find Doctor
              </Link>
              <Link href="/patient/analytics" className={cn("transition-colors hover:text-primary py-2", isActivePath("/patient/analytics") && "text-primary font-semibold")}>
                Analytics
              </Link>
              <Link href="/patient/appointments" className={cn("transition-colors hover:text-primary py-2", isActivePath("/patient/appointments") && "text-primary font-semibold")}>
                Appointments
              </Link>
              <Link href="/patient/find-medicine" className={cn("transition-colors hover:text-primary py-2", isActivePath("/patient/find-medicine") && "text-primary font-semibold")}>
                Find Medicine
              </Link>
              <Link href="/patient/medical-history" className={cn("transition-colors hover:text-primary py-2", isActivePath("/patient/medical-history") && "text-primary font-semibold")}>
                Medical History
              </Link>
              
            </nav>
          ) : null}
        </div>

        {/* RIGHT: Actions */}
        <div className="hidden md:flex flex-1 items-center justify-end gap-3 lg:gap-4">
          {loading ? (
            <CardSkeleton className="h-8 w-24 rounded-full" />
          ) : !user ? (
            <>
              <Button variant="ghost" asChild className="text-foreground/80 hover:bg-accent hover:text-foreground">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="rounded-xl px-6 shadow-sm">
                <Link href="/selection">Sign up</Link>
              </Button>
            </>
          ) : (
            <>
              {showChoruiFab && (
                <ChoruiLauncher role={user.role?.toLowerCase() === "doctor" ? "doctor" : "patient"} />
              )}
              <NotificationDropdown />
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 h-10 rounded-xl pl-2 pr-3 hover:bg-accent hover:text-foreground">
                    <Avatar className="h-9 w-9 border border-primary/20">
                      <AvatarImage src={resolvedAvatarUrl} alt={getUserDisplayName()} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-38 truncate text-sm font-semibold text-foreground">{getUserDisplayName()}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="focus:bg-primary-more-light focus:text-primary cursor-pointer">
                    <Link href={user.role?.toLowerCase() === 'doctor' ? '/doctor/profile' : '/patient/profile'}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="focus:bg-primary-more-light focus:text-primary cursor-pointer">
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  {user.role?.toLowerCase() === 'patient' && (
                    <DropdownMenuItem asChild className="focus:bg-primary-more-light focus:text-primary cursor-pointer">
                      <Link href="/patient/privacy">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Privacy & Data Sharing</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                  >
                    {loggingOut ? (
                      <ButtonLoader className="mr-2 h-4 w-4" />
                    ) : (
                      <LogOut className="mr-2 h-4 w-4" />
                    )}
                    <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {/* MOBILE: Hamburger */}
        <div className="md:hidden flex items-center gap-1.5">
          {/* Mobile notification icon */}
          {user && <NotificationDropdown className="h-10 w-10 rounded-xl" />}
          
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground touch-target rounded-xl hover:bg-accent/80">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(88vw,22rem)] border-l border-border/70 px-0">
              <SheetHeader className="border-b border-border/60 px-5 pb-4 pt-5">
                <SheetTitle className="flex items-center gap-2">
                  <Link href={homePath} className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                    <div className="relative h-8 w-8">
                      <Image src={medoraDarkLogo} alt="Medora" fill className="object-contain dark:hidden" />
                      <Image src={medoraLightLogo} alt="Medora" fill className="hidden object-contain dark:block" />
                    </div>
                    <span>Medora</span>
                  </Link>
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
                {loading ? (
                  <div className="space-y-3 px-2">
                    <CardSkeleton className="h-12 rounded" />
                    <CardSkeleton className="h-12 rounded" />
                    <CardSkeleton className="h-12 rounded" />
                  </div>
                ) : !user ? (
                  <>
                    <div className="mt-auto flex flex-col gap-3 pt-6">
                      <Button variant="outline" asChild className="w-full justify-center h-12 text-base border-primary/20 hover:bg-primary-more-light hover:text-primary">
                        <Link href="/login">Log in</Link>
                      </Button>
                      <Button asChild className="w-full justify-center h-12 text-base bg-primary hover:bg-primary-muted shadow-lg shadow-primary/20">
                        <Link href="/selection">Sign up</Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      {user?.role?.toLowerCase() === 'doctor' ? (
                        <>
                          <Link href="/doctor/appointments" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <Calendar className="h-5 w-5 text-primary" /> Appointments
                          </Link>
                          <Link href="/doctor/patients" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <Users className="h-5 w-5 text-primary" /> Patients
                          </Link>
                          <Link href="/doctor/analytics" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <Activity className="h-5 w-5 text-primary" /> Analytics
                          </Link>
                        </>
                      ) : user?.role?.toLowerCase() === 'patient' ? (
                        <>
                          <Link href="/patient/find-doctor" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <Users className="h-5 w-5 text-primary" /> Find Doctor
                          </Link>
                          <Link href="/patient/analytics" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <Activity className="h-5 w-5 text-primary" /> Analytics
                          </Link>
                          <Link href="/patient/appointments" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <Calendar className="h-5 w-5 text-primary" /> Appointments
                          </Link>
                          <Link href="/patient/find-medicine" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <Activity className="h-5 w-5 text-primary" /> Find Medicine
                          </Link>
                          <Link href="/patient/medical-history" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <FileText className="h-5 w-5 text-primary" /> Medical History
                          </Link>
                          <Link href="/patient/medical-reports" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <FlaskConical className="h-5 w-5 text-primary" /> Lab Reports
                          </Link>
                          <Link href="/patient/privacy" className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-base font-medium text-foreground hover:bg-accent/60 hover:text-primary transition-colors">
                            <Shield className="h-5 w-5 text-primary" /> Privacy & Data Sharing
                          </Link>

                        </>
                      ) : null}
                    </div>
                    <div className="mt-auto flex flex-col gap-4 border-t border-border pt-4">
                      <div className="flex items-center gap-3 px-2">
                        <Avatar className="h-10 w-10 border-2 border-primary/10">
                          <AvatarImage src={resolvedAvatarUrl} />
                          <AvatarFallback className="bg-primary/10 text-primary">{getUserInitials()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col flex-1">
                          <span className="font-semibold text-foreground">{getUserDisplayName()}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link href={user.role?.toLowerCase() === 'doctor' ? '/doctor/profile' : '/patient/profile'} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary px-2 py-2 rounded-md hover:bg-primary-more-light transition-colors">
                          <User className="h-4 w-4" /> My Profile
                        </Link>
                        <Link href="/settings" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary px-2 py-2 rounded-md hover:bg-primary-more-light transition-colors">
                          <Settings className="h-4 w-4" /> Settings
                        </Link>
                        <Button 
                          variant="ghost" 
                          onClick={handleLogout}
                          disabled={loggingOut}
                          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {loggingOut ? (
                            <ButtonLoader className="mr-2 h-4 w-4" />
                          ) : (
                            <LogOut className="mr-2 h-4 w-4" />
                          )}
                          {loggingOut ? 'Logging out...' : 'Log out'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      </div>
      </header>
    </>
  );
}

