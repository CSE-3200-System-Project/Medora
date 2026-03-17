"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  X,
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
import { clearAdminAccess } from "@/lib/admin-actions";
import { AdminNotifications } from "@/components/admin/admin-notifications";

import logo from "@/assets/image/medora-logo.png";

export function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        "bg-[#1E3A5F]/95 backdrop-blur-xl border-b border-[#2196F3]/20",
        isScrolled ? "shadow-lg shadow-[#2196F3]/10" : ""
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* LEFT: Logo & Title */}
          <Link href="/admin" className="flex items-center gap-2 sm:gap-3">
            <div className="relative h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12">
              <Image src={logo} alt="Medora" fill className="object-contain" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-lg md:text-xl font-bold text-white">Medora</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFB74D] text-[#0A1929] font-semibold">
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
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-[#2196F3] text-white shadow-lg shadow-[#2196F3]/30"
                      : "text-gray-300 hover:text-white hover:bg-[#2196F3]/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: User Menu */}
          <div className="hidden lg:flex items-center gap-2 md:gap-4">
            {/* Notifications */}
            <AdminNotifications />
            
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:text-white hover:bg-[#2196F3]/10"
            >
              <Settings className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0A1929]/50 border border-[#2196F3]/20">
              <Avatar className="h-8 w-8 border-2 border-[#2196F3]">
                <AvatarFallback className="bg-[#2196F3] text-white text-sm font-semibold">
                  AD
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-white">Admin</span>
            </div>

            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-gray-300 hover:text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {loggingOut ? "Logging out..." : "Logout"}
            </Button>
          </div>

          {/* MOBILE: Hamburger */}
          <div className="lg:hidden flex items-center gap-2">
            <AdminNotifications />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-300 hover:text-white hover:bg-[#2196F3]/10"
                >
                  <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-70 bg-[#1E3A5F] border-l border-[#2196F3]/20"
            >
              <SheetHeader className="border-b border-[#2196F3]/20 pb-4">
                <SheetTitle className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-[#2196F3]" />
                  Admin Panel
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col py-6 space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.href === "/admin" 
                    ? pathname === "/admin" 
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? "bg-[#2196F3] text-white"
                          : "text-gray-300 hover:text-white hover:bg-[#2196F3]/10"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="absolute bottom-6 left-0 right-0 px-6 space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0A1929]/50 border border-[#2196F3]/20">
                  <Avatar className="h-10 w-10 border-2 border-[#2196F3]">
                    <AvatarFallback className="bg-[#2196F3] text-white font-semibold">
                      AD
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Admin</p>
                    <p className="text-xs text-gray-400">Administrator</p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full justify-start text-gray-300 hover:text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {loggingOut ? "Logging out..." : "Logout"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}


