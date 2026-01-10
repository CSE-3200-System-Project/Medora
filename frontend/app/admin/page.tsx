"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  UserCog, 
  Calendar, 
  CheckCircle2, 
  Clock,
  XCircle,
  TrendingUp,
  Activity
} from "lucide-react";
import { getAdminStats } from "@/lib/admin-actions";

type Stats = {
  total_users: number;
  total_doctors: number;
  total_patients: number;
  verified_doctors: number;
  pending_doctors: number;
  rejected_doctors: number;
  patients_with_complete_profile: number;
  total_appointments: number;
  pending_appointments: number;
  confirmed_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  recent_registrations_7days: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <AdminNavbar />
        <main className="p-6 max-w-[1600px] mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-white text-lg">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AdminNavbar />
      
      <main className="p-4 md:p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-slate-400">
            Platform overview and statistics
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <StatCard
            title="Total Users"
            value={stats?.total_users || 0}
            icon={<Users className="h-5 w-5" />}
            trend={`+${stats?.recent_registrations_7days || 0} this week`}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatCard
            title="Total Doctors"
            value={stats?.total_doctors || 0}
            icon={<UserCog className="h-5 w-5" />}
            trend={`${stats?.verified_doctors || 0} verified`}
            color="bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
          <StatCard
            title="Total Patients"
            value={stats?.total_patients || 0}
            icon={<Users className="h-5 w-5" />}
            trend={`${stats?.patients_with_complete_profile || 0} complete profiles`}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <StatCard
            title="Total Appointments"
            value={stats?.total_appointments || 0}
            icon={<Calendar className="h-5 w-5" />}
            trend={`${stats?.confirmed_appointments || 0} confirmed`}
            color="bg-gradient-to-br from-orange-500 to-orange-600"
          />
        </div>

        {/* Detailed Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Doctor Verification Status */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary-light" />
                Doctor Verification Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusRow
                label="Verified Doctors"
                value={stats?.verified_doctors || 0}
                icon={<CheckCircle2 className="h-5 w-5 text-green-400" />}
                color="text-green-400"
              />
              <StatusRow
                label="Pending Verification"
                value={stats?.pending_doctors || 0}
                icon={<Clock className="h-5 w-5 text-yellow-400" />}
                color="text-yellow-400"
                onClick={() => router.push('/admin/doctors?tab=pending')}
                clickable
              />
              <StatusRow
                label="Rejected"
                value={stats?.rejected_doctors || 0}
                icon={<XCircle className="h-5 w-5 text-red-400" />}
                color="text-red-400"
              />
            </CardContent>
          </Card>

          {/* Appointment Status */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary-light" />
                Appointment Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusRow
                label="Pending"
                value={stats?.pending_appointments || 0}
                icon={<Clock className="h-5 w-5 text-yellow-400" />}
                color="text-yellow-400"
              />
              <StatusRow
                label="Confirmed"
                value={stats?.confirmed_appointments || 0}
                icon={<CheckCircle2 className="h-5 w-5 text-blue-400" />}
                color="text-blue-400"
              />
              <StatusRow
                label="Completed"
                value={stats?.completed_appointments || 0}
                icon={<CheckCircle2 className="h-5 w-5 text-green-400" />}
                color="text-green-400"
              />
              <StatusRow
                label="Cancelled"
                value={stats?.cancelled_appointments || 0}
                icon={<XCircle className="h-5 w-5 text-red-400" />}
                color="text-red-400"
              />
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary-light" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <QuickActionButton
                label="Review Pending Doctors"
                count={stats?.pending_doctors || 0}
                onClick={() => router.push('/admin/doctors?tab=pending')}
              />
              <QuickActionButton
                label="View All Doctors"
                count={stats?.total_doctors || 0}
                onClick={() => router.push('/admin/doctors')}
              />
              <QuickActionButton
                label="View All Patients"
                count={stats?.total_patients || 0}
                onClick={() => router.push('/admin/patients')}
              />
              <QuickActionButton
                label="View Appointments"
                count={stats?.total_appointments || 0}
                onClick={() => router.push('/admin/appointments')}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  trend, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  trend: string; 
  color: string;
}) {
  return (
    <Card className={`${color} border-0 text-white shadow-lg`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
            {icon}
          </div>
          <TrendingUp className="h-4 w-4 text-white/60" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="text-3xl font-bold">{value.toLocaleString()}</p>
          <p className="text-xs text-white/70">{trend}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({ 
  label, 
  value, 
  icon, 
  color,
  onClick,
  clickable
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode; 
  color: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 ${clickable ? 'cursor-pointer hover:bg-slate-900/80 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-slate-300 font-medium">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

function QuickActionButton({ 
  label, 
  count, 
  onClick 
}: { 
  label: string; 
  count: number; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900/80 hover:border-primary/50 transition-all text-left group"
    >
      <p className="text-slate-400 text-sm mb-2 group-hover:text-primary-light transition-colors">
        {label}
      </p>
      <p className="text-white text-2xl font-bold">{count}</p>
    </button>
  );
}
