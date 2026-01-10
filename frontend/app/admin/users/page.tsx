"use client";

import React, { useEffect, useState } from "react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  User,
  Mail,
  Phone,
  Search,
  Ban,
  Unlock,
  UserCog,
  Users as UsersIcon,
} from "lucide-react";
import { getAllPatients, getAllDoctors, banUser, unbanUser } from "@/lib/admin-actions";

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "patient" | "doctor";
  onboarding_completed?: boolean;
  blood_group?: string;
  city?: string;
  specialization?: string;
  verification_status?: string;
  account_status?: string;
};

export default function UsersManagementPage() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      const [patientsData, doctorsData] = await Promise.all([
        getAllPatients(1000, 0),
        getAllDoctors(),
      ]);

      const patients: User[] = (patientsData.patients || []).map((p: any) => ({
        ...p,
        role: "patient" as const,
      }));

      const doctors: User[] = (doctorsData.doctors || []).map((d: any) => ({
        ...d,
        role: "doctor" as const,
      }));

      setAllUsers([...patients, ...doctors]);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (user: User) => {
    if (!confirm(`Are you sure you want to ban ${user.name}?`)) return;
    try {
      await banUser(user.id);
      await fetchAllUsers();
    } catch (error) {
      alert("Failed to ban user");
    }
  };

  const handleUnban = async (user: User) => {
    try {
      await unbanUser(user.id);
      await fetchAllUsers();
    } catch (error) {
      alert("Failed to unban user");
    }
  };

  const filteredUsers = allUsers
    .filter((u) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return u.account_status !== "banned";
      if (statusFilter === "banned") return u.account_status === "banned";
      return true;
    })
    .filter(
      (u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

  const activeCount = allUsers.filter((u) => u.account_status !== "banned").length;
  const bannedCount = allUsers.filter((u) => u.account_status === "banned").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AdminNavbar />

      <main className="p-4 md:p-6 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            User Account Management
          </h1>
          <p className="text-slate-400">Ban or unban user accounts</p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-700/80 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {["all", "active", "banned"].map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={`border-slate-600 ${
                  statusFilter === status
                    ? "bg-primary text-white border-primary"
                    : "text-slate-300 hover:bg-slate-700/60"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} (
                {status === "all"
                  ? allUsers.length
                  : status === "active"
                  ? activeCount
                  : bannedCount}
                )
              </Button>
            ))}
          </div>
        </div>

        {/* Users Grid */}
        {loading ? (
          <Card className="bg-slate-700/60 border-slate-600/50">
            <CardContent className="p-12 text-center">
              <p className="text-slate-400">Loading users...</p>
            </CardContent>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card className="bg-slate-700/60 border-slate-600/50">
            <CardContent className="p-12 text-center">
              <p className="text-slate-400">No users found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <Card
                key={user.id}
                className="bg-slate-700/60 border-slate-600/50 hover:border-primary/50 transition-colors"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-12 w-12 rounded-full ${
                          user.role === "doctor"
                            ? "bg-blue-500/20"
                            : "bg-purple-500/20"
                        } flex items-center justify-center`}
                      >
                        {user.role === "doctor" ? (
                          <UserCog className="h-6 w-6 text-blue-400" />
                        ) : (
                          <User className="h-6 w-6 text-purple-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{user.name}</h3>
                        <p className="text-xs text-slate-400 capitalize">
                          {user.role}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={
                        user.role === "doctor"
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                      }
                    >
                      {user.role}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="h-4 w-4" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user.specialization && (
                      <p className="text-slate-400">
                        Specialization: {user.specialization}
                      </p>
                    )}
                    {user.blood_group && (
                      <p className="text-slate-400">Blood: {user.blood_group}</p>
                    )}
                  </div>

                  {/* Ban/Unban Actions */}
                  <div className="mt-4 pt-4 border-t border-slate-600/50 flex items-center justify-between">
                    {user.account_status === "banned" ? (
                      <>
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <Ban className="h-3 w-3 mr-1" />
                          Banned
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => handleUnban(user)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Unban
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Active
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBan(user)}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Ban
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
