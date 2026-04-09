"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import {
  Users, TrendingUp, AlertTriangle, Star, Zap,
  GraduationCap, LayoutDashboard, BookOpen,
} from "lucide-react";

type Stats = {
  universityId: string;
  totalStudents: number;
  onboarded: number;
  avgReadiness: number;
  segments: Record<string, number>;
  students: Array<{
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    segment: string;
    streak: number;
    targetRole: string | null;
    readiness: number | null;
    missionsCompleted: number;
    onboardingDone: boolean;
  }>;
};

const SEGMENT_COLORS: Record<string, string> = {
  RISING_STAR: "text-green-400 bg-green-500/10 border-green-500/20",
  CAPABLE: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  AT_RISK: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/20",
  UNASSESSED: "text-zinc-400 bg-zinc-800 border-zinc-700",
};

function AdminSidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#0d0d0d] border-r border-zinc-800/60">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800/60">
        <div className="w-6 h-6 bg-amber-500 rounded-sm flex items-center justify-center shrink-0">
          <Zap className="w-3 h-3 text-black" fill="black" />
        </div>
        <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">Admin</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {[
          { href: "/admin/dashboard", icon: LayoutDashboard, label: "Overview" },
          { href: "/admin/students", icon: Users, label: "Students" },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors"
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-zinc-800/60">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors"
        >
          <GraduationCap className="w-4 h-4" />
          Student view
        </Link>
      </div>
    </aside>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => axios.get<Stats>("/api/admin/stats").then((r) => r.data),
  });

  const atRisk = (data?.students ?? []).filter(
    (s) => s.segment === "AT_RISK" || s.segment === "CRITICAL"
  );

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mb-8">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">TPC Portal</p>
          <h1 className="text-2xl text-white font-light">University Overview</h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Students",
              value: data?.totalStudents ?? "—",
              icon: <Users className="w-4 h-4 text-zinc-500" />,
              sub: `${data?.onboarded ?? 0} onboarded`,
            },
            {
              label: "Avg Readiness",
              value: data ? `${data.avgReadiness}/100` : "—",
              icon: <TrendingUp className="w-4 h-4 text-zinc-500" />,
              sub: "across all students",
            },
            {
              label: "At Risk",
              value: atRisk.length || "—",
              icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
              sub: "need intervention",
              highlight: atRisk.length > 0,
            },
            {
              label: "Rising Stars",
              value: data?.segments?.RISING_STAR ?? "—",
              icon: <Star className="w-4 h-4 text-amber-400" />,
              sub: "top performers",
            },
          ].map(({ label, value, icon, sub, highlight }) => (
            <div
              key={label}
              className={`bg-zinc-900/40 border rounded-2xl p-5 ${
                highlight ? "border-red-500/30" : "border-zinc-800/60"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">{label}</p>
                {icon}
              </div>
              <p className={`text-2xl font-light ${highlight ? "text-red-400" : "text-white"}`}>
                {isLoading ? "—" : value}
              </p>
              <p className="text-xs text-zinc-600 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Segment breakdown */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
            <h2 className="text-sm font-medium text-white mb-4">Segment Breakdown</h2>
            <div className="space-y-3">
              {[
                ["RISING_STAR", "Rising Star"],
                ["CAPABLE", "Capable"],
                ["AT_RISK", "At Risk"],
                ["CRITICAL", "Critical"],
                ["UNASSESSED", "Unassessed"],
              ].map(([key, label]) => {
                const count = data?.segments?.[key] ?? 0;
                const total = data?.totalStudents || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{label}</span>
                      <span className="text-zinc-500 font-mono">{count}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full">
                      <div
                        className={`h-full rounded-full transition-all ${
                          key === "RISING_STAR" ? "bg-green-500" :
                          key === "CAPABLE" ? "bg-blue-500" :
                          key === "AT_RISK" ? "bg-amber-500" :
                          key === "CRITICAL" ? "bg-red-500" : "bg-zinc-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* At-risk students */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
            <h2 className="text-sm font-medium text-white mb-4">
              Needs Attention
              {atRisk.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
                  {atRisk.length}
                </span>
              )}
            </h2>
            {atRisk.length === 0 ? (
              <p className="text-zinc-600 text-sm">No at-risk students.</p>
            ) : (
              <div className="space-y-2">
                {atRisk.slice(0, 6).map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-zinc-800/40 last:border-0">
                    <div>
                      <p className="text-sm text-white">{s.name ?? s.email}</p>
                      <p className="text-xs text-zinc-500">{s.targetRole ?? "—"}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${SEGMENT_COLORS[s.segment]}`}>
                      {s.segment.replace("_", " ")}
                    </span>
                  </div>
                ))}
                {atRisk.length > 6 && (
                  <Link href="/admin/students" className="text-xs text-amber-400 hover:text-amber-300">
                    +{atRisk.length - 6} more →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
