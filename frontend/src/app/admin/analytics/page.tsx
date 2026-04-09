"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

type Analytics = {
  pillars: { total: number; dsa: number; dev: number; comm: number; consistency: number };
  distribution: { range: string; count: number }[];
  trend: { date: string; avg: number }[];
  weakTopics: { topic: string; count: number }[];
  roles: { role: string; count: number }[];
  missionStats: Record<string, number>;
  totalAssessed: number;
  totalStudents: number;
};

const PILLAR_COLORS: Record<string, string> = {
  DSA: "#8b5cf6",
  Dev: "#3b82f6",
  Communication: "#f59e0b",
  Consistency: "#22c55e",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl text-white font-light">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-500 mb-1">{label}</p>
      <p className="text-white font-mono">{payload[0].value}</p>
    </div>
  );
};

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["admin-analytics"],
    queryFn: () => axios.get<Analytics>("/api/admin/analytics").then((r) => r.data),
    refetchInterval: 120_000,
  });

  const radarData = data
    ? [
        { subject: "DSA", value: data.pillars.dsa },
        { subject: "Dev", value: data.pillars.dev },
        { subject: "Comm", value: data.pillars.comm },
        { subject: "Consistency", value: data.pillars.consistency },
      ]
    : [];

  const missionTotal = data
    ? Object.values(data.missionStats).reduce((s, v) => s + v, 0)
    : 0;

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mb-8">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">TPC Portal</p>
          <h1 className="text-2xl text-white font-light">Analytics</h1>
        </div>

        {isLoading && <p className="text-zinc-600 text-sm">Loading…</p>}

        {data && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Avg Readiness" value={data.pillars.total} sub={`${data.totalAssessed} assessed`} />
              <StatCard label="Avg DSA" value={data.pillars.dsa} sub="algorithm & data structures" />
              <StatCard label="Avg Dev" value={data.pillars.dev} sub="development skills" />
              <StatCard label="Avg Consistency" value={data.pillars.consistency} sub="streak & activity" />
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* 30-day trend */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-5">30-Day Readiness Trend</h2>
                {data.trend.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No data for this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={data.trend} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 9, fill: "#52525b" }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="avg" stroke="#f59e0b" strokeWidth={1.5} fill="url(#avgGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Pillar radar */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-5">Pillar Breakdown</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#71717a" }} />
                    <Radar dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Score distribution */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-5">Score Distribution</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.distribution} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 9, fill: "#52525b" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#52525b" }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Target roles */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-5">Target Roles</h2>
                {data.roles.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No role data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.roles.map((r) => {
                      const pct = Math.round((r.count / data.totalStudents) * 100);
                      return (
                        <div key={r.role}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-400 truncate mr-2">{r.role}</span>
                            <span className="text-zinc-500 font-mono shrink-0">{r.count} · {pct}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Weak topics */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-1">Common Weak Topics</h2>
                <p className="text-xs text-zinc-600 mb-5">Aggregated across all assessed students</p>
                {data.weakTopics.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No weakness data yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.weakTopics.map((t, i) => (
                      <div key={t.topic} className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-zinc-600 w-4 shrink-0">#{i + 1}</span>
                        <span className="flex-1 text-xs text-zinc-400 truncate">{t.topic}</span>
                        <span className="text-xs font-mono text-zinc-500">{t.count}</span>
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${Math.round((t.count / (data.weakTopics[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mission stats */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-5">Mission Status</h2>
                {missionTotal === 0 ? (
                  <p className="text-zinc-600 text-sm">No mission data yet.</p>
                ) : (
                  <div className="space-y-3.5">
                    {Object.entries(data.missionStats).map(([status, count]) => {
                      const pct = Math.round((count / missionTotal) * 100);
                      const colorMap: Record<string, string> = {
                        COMPLETED: "bg-green-500",
                        IN_PROGRESS: "bg-blue-500",
                        PENDING: "bg-zinc-600",
                        FAILED: "bg-red-500",
                      };
                      return (
                        <div key={status}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-zinc-400">{status.replace("_", " ")}</span>
                            <span className="text-zinc-500 font-mono">{count} · {pct}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colorMap[status] ?? "bg-zinc-500"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
