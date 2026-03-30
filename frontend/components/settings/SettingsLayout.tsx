"use client";

import type { ReactNode } from "react";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { DoctorNavbar } from "@/components/doctor/doctor-navbar";
import { AdminNavbar } from "@/components/admin/admin-navbar";

type SettingsRole = "patient" | "doctor" | "admin";

export function SettingsLayout({
  role,
  title,
  description,
  headerActions,
  children,
}: {
  role: SettingsRole;
  title: string;
  description: string;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppBackground className="container-padding animate-page-enter">
      {role === "doctor" ? <DoctorNavbar /> : role === "admin" ? <AdminNavbar /> : <Navbar />}

      <main className="mx-auto max-w-6xl py-8 pt-(--nav-content-offset)">
        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">{description}</p>
          </div>
          {headerActions ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">{headerActions}</div> : null}
        </div>

        {children}
      </main>
    </AppBackground>
  );
}
