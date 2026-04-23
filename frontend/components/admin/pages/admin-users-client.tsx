"use client";

import React, { useState } from "react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScrollContainer } from "@/components/ui/table";
import { User, Mail, Phone, Ban, Unlock, UserCog } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { banUser, unbanUser } from "@/lib/admin-actions";

type UserRecord = {
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

type AdminUsersClientProps = {
  initialUsers: UserRecord[];
};

export function AdminUsersClient({ initialUsers }: AdminUsersClientProps) {
  const [allUsers, setAllUsers] = useState<UserRecord[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [banConfirmDialog, setBanConfirmDialog] = useState<{
    isOpen: boolean;
    user: UserRecord | null;
  }>({ isOpen: false, user: null });

  const handleBan = async (user: UserRecord) => {
    setBanConfirmDialog({ isOpen: true, user });
  };

  const confirmBan = async () => {
    if (!banConfirmDialog.user) return;
    try {
      await banUser(banConfirmDialog.user.id);
      setAllUsers((previousUsers) =>
        previousUsers.map((existingUser) =>
          existingUser.id === banConfirmDialog.user?.id
            ? { ...existingUser, account_status: "banned" }
            : existingUser,
        ),
      );
      setBanConfirmDialog({ isOpen: false, user: null });
    } catch {
      alert("Failed to ban user");
    }
  };

  const handleUnban = async (user: UserRecord) => {
    try {
      await unbanUser(user.id);
      setAllUsers((previousUsers) =>
        previousUsers.map((existingUser) =>
          existingUser.id === user.id
            ? { ...existingUser, account_status: "active" }
            : existingUser,
        ),
      );
    } catch {
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
    .filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const activeCount = allUsers.filter((u) => u.account_status !== "banned").length;
  const bannedCount = allUsers.filter((u) => u.account_status === "banned").length;

  return (
    <>
      <AdminNavbar />

      <main className="mx-auto max-w-7xl space-y-6 p-4 pt-[var(--nav-content-offset)] sm:p-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">User Account Management</h1>
          <p className="text-muted-foreground">Ban or unban user accounts</p>
        </div>

        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          <div className="w-full sm:w-96">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-card/80 border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="lg:hidden">
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 bg-card/80 border-border text-foreground"
              aria-label="Filter users by account status"
            >
              {[
                { value: "all", count: allUsers.length },
                { value: "active", count: activeCount },
                { value: "banned", count: bannedCount },
              ].map((status) => (
                <option key={status.value} value={status.value}>
                  {status.value.charAt(0).toUpperCase() + status.value.slice(1)} ({status.count})
                </option>
              ))}
            </Select>
          </div>

          <div className="hidden lg:flex flex-wrap gap-2">
            {["all", "active", "banned"].map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={`border-border ${
                  statusFilter === status ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-card/60"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} ({status === "all" ? allUsers.length : status === "active" ? activeCount : bannedCount})
              </Button>
            ))}
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:hidden">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="bg-card/60 border-border/50 hover:border-primary/50 transition-colors">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div
                        className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full shrink-0 ${
                          user.role === "doctor" ? "bg-blue-500/20" : "bg-purple-500/20"
                        } flex items-center justify-center`}
                      >
                        {user.role === "doctor" ? <UserCog className="h-6 w-6 text-blue-400" /> : <User className="h-6 w-6 text-purple-400" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{user.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
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

                  <div className="space-y-2 text-xs sm:text-sm mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user.specialization && <p className="text-muted-foreground">Specialization: {user.specialization}</p>}
                    {user.blood_group && <p className="text-muted-foreground">Blood: {user.blood_group}</p>}
                  </div>

                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50 flex flex-wrap items-center gap-2 sm:justify-between">
                    {user.account_status === "banned" ? (
                      <>
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <Ban className="h-3 w-3 mr-1" />
                          Banned
                        </Badge>
                        <Button size="sm" onClick={() => handleUnban(user)} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
                          <Unlock className="h-4 w-4 mr-1" />
                          Unban
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBan(user)}
                          className="w-full sm:w-auto border-red-500/30 text-red-400 hover:bg-red-500/10"
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

          <div className="hidden lg:block">
            <TableScrollContainer className="border-border/50 bg-card/40">
              <Table>
                <TableHeader className="bg-card/60 border-border/50">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">User</TableHead>
                    <TableHead className="text-muted-foreground">Role</TableHead>
                    <TableHead className="text-muted-foreground">Contact</TableHead>
                    <TableHead className="text-muted-foreground">Details</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-border/30 hover:bg-card/40">
                      <TableCell>
                        <p className="text-foreground font-medium">{user.name}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.role === "doctor"
                              ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                              : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                          }
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-foreground wrap-break-word">{user.email}</p>
                        {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.specialization && <p>Specialization: {user.specialization}</p>}
                        {user.blood_group && <p>Blood: {user.blood_group}</p>}
                        {!user.specialization && !user.blood_group && <p>N/A</p>}
                      </TableCell>
                      <TableCell>
                        {user.account_status === "banned" ? (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Banned</Badge>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {user.account_status === "banned" ? (
                            <Button size="sm" onClick={() => handleUnban(user)} className="bg-green-600 hover:bg-green-700">
                              Unban
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleBan(user)}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                              Ban
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScrollContainer>
          </div>
          </>
        )}

        <ConfirmationDialog
          isOpen={banConfirmDialog.isOpen}
          onClose={() => setBanConfirmDialog({ isOpen: false, user: null })}
          onConfirm={confirmBan}
          title="Ban User"
          description={`Are you sure you want to ban ${banConfirmDialog.user?.name}? They will no longer be able to access their account.`}
          confirmText="Ban User"
          variant="danger"
        />
      </main>
    </>
  );
}

