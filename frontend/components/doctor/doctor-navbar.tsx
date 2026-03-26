"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Home,
  User,
  Calendar,
  Users,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChoruiLauncher } from "@/components/ai/chorui-launcher";
import { resolveAvatarUrl } from "@/lib/avatar";

interface DoctorNavbarProps {
  doctor?: {
    first_name: string;
    last_name: string;
    profile_photo_url?: string;
    speciality_name?: string;
  };
}

export function DoctorNavbar({ doctor }: DoctorNavbarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/doctor/home", label: "Home", icon: Home },
    { href: "/doctor/profile", label: "My Profile", icon: User },
    { href: "/doctor/appointments", label: "Appointments", icon: Calendar },
    { href: "/doctor/patients", label: "Patients", icon: Users },
    { href: "/doctor/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (href: string) => pathname === href;
  const resolvedDoctorAvatar = doctor
    ? resolveAvatarUrl(
        doctor.profile_photo_url,
        `${doctor.first_name || ""}${doctor.last_name || ""}${doctor.speciality_name || ""}`
      )
    : "";

  return (
    <>
      <nav className="sticky top-0 z-50 w-full overflow-x-hidden bg-linear-to-r from-primary via-primary-muted to-primary shadow-lg border-b border-primary-light/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link href="/doctor/home" className="flex items-center gap-2 touch-target">
            <div className="bg-card rounded-lg p-1 sm:p-2">
              <span className="text-xl sm:text-2xl font-bold text-primary">M</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-white hidden sm:block">
              Medora
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "text-white hover:bg-card/20 transition-all",
                      isActive(item.href) && "bg-card/30 font-semibold"
                    )}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* User Profile & Logout */}
          <div className="hidden md:flex items-center gap-3">
            {!pathname.includes("/chorui-ai") && (
              <ChoruiLauncher role="doctor" />
            )}
            {doctor && (
              <Link href="/doctor/profile">
                <div className="flex items-center gap-3 bg-card/20 hover:bg-card/30 rounded-lg px-3 py-2 transition-all cursor-pointer">
                  <Avatar className="h-8 w-8 border-2 border-white">
                    <Image
                      src={resolvedDoctorAvatar}
                      alt={`${doctor.first_name} ${doctor.last_name}`}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  </Avatar>
                  <div className="text-left">
                    <p className="text-white font-semibold text-sm">
                      Dr. {doctor.first_name} {doctor.last_name}
                    </p>
                    {doctor.speciality_name && (
                      <p className="text-primary-light text-xs">
                        {doctor.speciality_name}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )}
            <Link href="/logout">
              <Button
                variant="ghost"
                className="text-white hover:bg-card/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-card/20 touch-target">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm bg-primary border-l border-primary-light/20">
                <SheetHeader>
                  <SheetTitle className="text-white flex items-center gap-2">
                    <div className="bg-card rounded-lg p-1">
                      <span className="text-lg font-bold text-primary">M</span>
                    </div>
                    Medora Doctor
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full py-4">
                  <div className="flex flex-col gap-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-card/20 transition-all",
                            isActive(item.href) && "bg-card/30 font-semibold"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                  
                  {doctor && (
                    <div className="mt-auto border-t border-white/20 pt-4">
                      <div className="flex items-center gap-3 px-2 mb-4">
                        <Avatar className="h-10 w-10 border-2 border-white">
                          <Image
                            src={resolvedDoctorAvatar}
                            alt={`${doctor.first_name} ${doctor.last_name}`}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-white font-semibold text-sm">
                            Dr. {doctor.first_name} {doctor.last_name}
                          </p>
                          {doctor.speciality_name && (
                            <p className="text-primary-light text-xs">
                              {doctor.speciality_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <Link 
                        href="/logout" 
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-card/20 transition-all"
                      >
                        <LogOut className="h-5 w-5" />
                        <span>Logout</span>
                      </Link>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      </nav>
    </>
  );
}

