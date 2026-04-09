"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Users, TrendingUp, AlertTriangle, Star, BookOpen, Flame } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

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

const SEGMENT_BAR: Record<string, string> = {
  RISING_STAR: "bg-green-500",
  CAPABLE: "bg-blue-500",
  AT_RISK: "bg-amber-500",
  CRITICAL: "bg-red-500",
  UNASSESSED: "bg-zinc-600",
};

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => axios.get<Stats>("/api/admin/stats").then((r) => r.data),
    refetchInterval: 60_000,
  });

  const atRisk = (data?.students ?? []).filter(
    (s) => s.segment === "AT_RISK" || s.segment === "CRITICAL"
  );
  const topPerformers = [...(data?.students ?? [])]
    .filter((s) => s.readiness !== null)
    .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))
    .slice(0, 5);

  const statCards = [
    {
      label: "Total Students",
      value: isLoading ? "—" : data?.totalStudents ?? 0,
      sub: `${data?.onboarded ?? 0} onboarded`,
      icon: <Users className="w-4 h-4 text-zinc-500" />,
    },
    {
      label: "Avg Readiness",
      value: isLoading ? "—" : `${data?.avgReadiness ?? 0}/100`,
      sub: "across all assessed",
      icon: <TrendingUp className="w-4 h-4 text-zinc-500" />,
    },
    {
      label: "Needs Attention",
      value: isLoading ? "—" : atRisk.length,
      sub: "AT RISK or CRITICAL",
      icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
      highlight: (atRisk.length > 0),
    },
    {
      label: "Rising Stars",
      value: isLoading ? "—" : data?.segments?.RISING_STAR ?? 0,
      sub: "readiness ≥ 75",
      icon: <Star className="w-4 h-4 text-amber-400" />,
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8 max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">TPC Portal</p>
          <h1 className="text-2xl text-white font-light">Overview</h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statCards.map(({ label, value, sub, icon, highlight }) => (
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
                {value}
              </p>
              <p className="text-xs text-zinc-600 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Segment breakdown */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
            <h2 className="text-sm font-medium text-white mb-5">Segment Breakdown</h2>
            <div className="space-y-3.5">
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
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-400">{label}</span>
                      <span className="text-zinc-500 font-mono">{count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${SEGMENT_BAR[key]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Needs attention */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-white">Needs Attention</h2>
              {atRisk.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                  {atRisk.length}
                </span>
              )}
            </div>
            {atRisk.length === 0 ? (
              <p className="text-zinc-600 text-sm">No at-risk students — great cohort!</p>
            ) : (
              <div className="space-y-0">
                {atRisk.slice(0, 5).map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/students/${s.id}`}
                    className="flex items-center justify-between py-2.5 border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 -mx-1 px-1 rounded transition-colors"
                  >
                    <div>
                      <p className="text-sm text-white">{s.name ?? s.email}</p>
                      <p className="text-xs text-zinc-500">{s.targetRole ?? "No target role"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.readiness !== null && (
                        <span className="text-xs font-mono text-zinc-500">{s.readiness}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${SEGMENT_COLORS[s.segment]}`}>
                        {s.segment.replace("_", " ")}
                      </span>
                    </div>
                  </Link>
                ))}
                {atRisk.length > 5 && (
                  <Link href="/admin/students" className="block pt-2 text-xs text-amber-400 hover:text-amber-300">
                    View all {atRisk.length} at-risk students →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Top performers */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
            <h2 className="text-sm font-medium text-white mb-5">Top Performers</h2>
            {topPerformers.length === 0 ? (
              <p className="text-zinc-600 text-sm">No assessed students yet.</p>
            ) : (
              <div className="space-y-0">
                {topPerformers.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/admin/students/${s.id}`}
                    className="flex items-center gap-3 py-2.5 border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 -mx-1 px-1 rounded transition-colors"
                  >
                    <span className="w-5 text-xs font-mono text-zinc-600 shrink-0">#{i + 1}</span>
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="w-7 h-7 rounded-full border border-zinc-700 shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{s.name ?? s.email}</p>
                      <p className="text-xs text-zinc-600">{s.targetRole ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-mono text-amber-400">{s.readiness}</span>
                      {s.streak > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-orange-400 font-mono">
                          <Flame className="w-3 h-3" />{s.streak}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Mission activity */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-white">Recent Activity</h2>
              <BookOpen className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="space-y-3">
              {(data?.students ?? [])
                .filter((s) => s.missionsCompleted > 0)
                .sort((a, b) => b.missionsCompleted - a.missionsCompleted)
                .slice(0, 5)
                .map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/students/${s.id}`}
                    className="flex items-center justify-between py-1 hover:bg-zinc-800/20 -mx-1 px-1 rounded transition-colors"
                  >
                    <p className="text-sm text-zinc-300">{s.name ?? s.email}</p>
                    <span className="text-xs font-mono text-zinc-500">
                      {s.missionsCompleted} mission{s.missionsCompleted !== 1 ? "s" : ""}
                    </span>
                  </Link>
                ))}
              {(data?.students ?? []).every((s) => s.missionsCompleted === 0) && (
                <p className="text-zinc-600 text-sm">No missions completed yet.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
