"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from "recharts";
import {
  Flame, Trophy, AlertTriangle, TrendingUp, TrendingDown,
  Clock, CheckCircle2, Lock, Play, Code2, Hammer, MessageSquare,
  ChevronRight, RefreshCw,
} from "lucide-react";
import Link from "next/link";

type Mission = {
  id: string;
  title: string;
  type: string;
  status: string;
  estimatedHours: number;
  deadline: string | null;
};

type Props = {
  user: { name: string | null; image: string | null };
  profile: {
    targetRole: string | null;
    streakDays: number;
    segment: string;
    dreamCompanies: string[];
  };
  readiness: {
    total: number;
    dsa: number;
    dev: number;
    comm: number;
    consistency: number;
    weakTopics: string[];
    delta: number | null;
  } | null;
  missions: Mission[];
  connections: { platform: string; syncStatus: string }[];
};

const SEGMENT_CONFIG: Record<string, { label: string; color: string; icon: typeof Trophy }> = {
  RISING_STAR: { label: "Rising Star", color: "text-amber-400", icon: Trophy },
  CAPABLE: { label: "Capable", color: "text-blue-400", icon: TrendingUp },
  AT_RISK: { label: "At Risk", color: "text-orange-400", icon: AlertTriangle },
  CRITICAL: { label: "Critical", color: "text-red-400", icon: AlertTriangle },
  UNASSESSED: { label: "Analyzing...", color: "text-zinc-400", icon: RefreshCw },
};

const MISSION_TYPE_ICON: Record<string, typeof Code2> = {
  BUILD: Hammer,
  SOLVE: Code2,
  COMMUNICATE: MessageSquare,
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  COMPLETED: { icon: CheckCircle2, color: "text-green-400" },
  IN_PROGRESS: { icon: Play, color: "text-amber-400" },
  AVAILABLE: { icon: Play, color: "text-blue-400" },
  LOCKED: { icon: Lock, color: "text-zinc-600" },
};

export function DashboardClient({ user, profile, readiness, missions, connections }: Props) {
  const seg = SEGMENT_CONFIG[profile.segment] ?? SEGMENT_CONFIG.UNASSESSED;
  const SegIcon = seg.icon;

  const syncingCount = connections.filter((c) => c.syncStatus === "SYNCING" || c.syncStatus === "PENDING").length;

  const pillars = readiness
    ? [
        { name: "DSA", score: readiness.dsa, color: "#f59e0b" },
        { name: "Dev", score: readiness.dev, color: "#3b82f6" },
        { name: "Comm", score: readiness.comm, color: "#10b981" },
        { name: "Consistency", score: readiness.consistency, color: "#a78bfa" },
      ]
    : [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl text-white font-light tracking-tight">
            {user.name ? `Hey, ${user.name.split(" ")[0]}` : "Dashboard"}
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {profile.targetRole ? `Targeting ${profile.targetRole}` : "Set your target role"}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 ${seg.color}`}>
          <SegIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">{seg.label}</span>
        </div>
      </div>

      {/* Sync banner */}
      {syncingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
          <p className="text-sm text-amber-300">
            Syncing your profiles… this takes ~60 seconds. Your roadmap will appear shortly.
          </p>
        </div>
      )}

      {/* Top row: Readiness + Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Readiness score */}
        <div className="md:col-span-2 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">Readiness Score</p>
              {readiness ? (
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-5xl font-light text-white">{readiness.total.toFixed(0)}</span>
                  <span className="text-zinc-600">/100</span>
                  {readiness.delta !== null && (
                    <span className={`text-sm font-mono flex items-center gap-0.5 ${readiness.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {readiness.delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {readiness.delta >= 0 ? "+" : ""}{readiness.delta.toFixed(1)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-4xl font-light text-zinc-700 mt-1">—</div>
              )}
            </div>
            {readiness && (
              <div className="w-24 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%" cy="50%"
                    innerRadius="60%" outerRadius="90%"
                    data={[{ value: readiness.total, fill: "#f59e0b" }]}
                    startAngle={90} endAngle={90 - 360 * (readiness.total / 100)}
                  >
                    <RadialBar dataKey="value" cornerRadius={4} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Pillars */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pillars.map(({ name, score, color }) => (
              <div key={name} className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-zinc-500">
                  <span>{name}</span>
                  <span style={{ color }}>{score.toFixed(0)}</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${score}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Weak topics */}
          {readiness && readiness.weakTopics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="text-xs text-zinc-600 font-mono mr-1">weak:</span>
              {readiness.weakTopics.slice(0, 5).map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-mono border border-red-500/20">
                  {t}
                </span>
              ))}
            </div>
          )}

          {!readiness && (
            <p className="text-sm text-zinc-600 mt-4">
              Readiness score will appear once your profiles are synced.
            </p>
          )}
        </div>

        {/* Streak */}
        <div className="flex flex-col gap-4">
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">Activity Streak</p>
            <div className="flex items-end gap-2">
              <Flame className="w-8 h-8 text-orange-400" />
              <div>
                <span className="text-4xl font-light text-white">{profile.streakDays}</span>
                <span className="text-zinc-600 ml-1 text-sm">days</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">Dream Companies</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.dreamCompanies.length > 0 ? (
                profile.dreamCompanies.slice(0, 4).map((c) => (
                  <span key={c} className="px-2 py-0.5 text-xs font-mono rounded-full border border-zinc-700 text-zinc-400">
                    {c}
                  </span>
                ))
              ) : (
                <p className="text-xs text-zinc-600">Not set</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Missions preview */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">Active Missions</p>
          <Link
            href="/roadmap"
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-400 transition-colors font-mono"
          >
            View roadmap
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {missions.length > 0 ? (
          <div className="space-y-2">
            {missions.map((m) => {
              const TypeIcon = MISSION_TYPE_ICON[m.type] ?? Code2;
              const statusCfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.LOCKED;
              const StatusIcon = statusCfg.icon;
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    m.status === "LOCKED"
                      ? "border-zinc-800/40 opacity-50"
                      : "border-zinc-800/60 hover:border-zinc-700"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                    <TypeIcon className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{m.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span className="text-xs text-zinc-600 font-mono">{m.estimatedHours}h</span>
                      {m.deadline && (
                        <span className="text-xs text-zinc-600 font-mono">
                          · due {new Date(m.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusIcon className={`w-4 h-4 shrink-0 ${statusCfg.color}`} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-zinc-600 text-sm">
              Missions will be generated once your gap analysis is complete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
