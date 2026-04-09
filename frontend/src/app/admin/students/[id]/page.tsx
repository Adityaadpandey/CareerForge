"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft, Github, Code2, FileText, Linkedin,
  CheckCircle2, Circle, Clock, XCircle, Flame, TrendingUp,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

type PlatformConnection = {
  id: string;
  platform: string;
  syncStatus: string;
  lastSyncedAt: string | null;
};

type Mission = {
  id: string;
  title: string;
  description: string;
  status: string;
  orderIndex: number;
};

type ReadinessScore = {
  id: string;
  totalScore: number;
  dsaScore: number;
  devScore: number;
  commScore: number;
  consistencyScore: number;
  createdAt: string;
};

type Application = {
  id: string;
  status: string;
  createdAt: string;
  job: { title: string; company: string } | null;
};

type StudentDetail = {
  id: string;
  segment: string;
  targetRole: string | null;
  department: string | null;
  graduationYear: number | null;
  streakDays: number;
  user: { name: string | null; email: string; image: string | null; createdAt: string };
  readinessScores: ReadinessScore[];
  missions: Mission[];
  platformConnections: PlatformConnection[];
  applications: Application[];
};

const SEGMENT_COLORS: Record<string, string> = {
  RISING_STAR: "text-green-400 bg-green-500/10 border-green-500/20",
  CAPABLE: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  AT_RISK: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/20",
  UNASSESSED: "text-zinc-400 bg-zinc-800 border-zinc-700",
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  GITHUB: <Github className="w-4 h-4" />,
  LEETCODE: <Code2 className="w-4 h-4" />,
  RESUME: <FileText className="w-4 h-4" />,
  LINKEDIN: <Linkedin className="w-4 h-4" />,
};

function SyncBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DONE: "text-green-400 bg-green-500/10 border-green-500/20",
    SYNCING: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    FAILED: "text-red-400 bg-red-500/10 border-red-500/20",
    PENDING: "text-zinc-400 bg-zinc-800 border-zinc-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${map[status] ?? map.PENDING}`}>
      {status}
    </span>
  );
}

function MissionIcon({ status }: { status: string }) {
  if (status === "COMPLETED") return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
  if (status === "IN_PROGRESS") return <Clock className="w-4 h-4 text-blue-400 shrink-0" />;
  if (status === "FAILED") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <Circle className="w-4 h-4 text-zinc-600 shrink-0" />;
}

function PillarBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono text-zinc-400">{value}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery<StudentDetail>({
    queryKey: ["admin-student", id],
    queryFn: () => axios.get<StudentDetail>(`/api/admin/students/${id}`).then((r) => r.data),
  });

  const latest = data?.readinessScores[0];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8 max-w-5xl">
        {/* Back */}
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-6 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Students
        </Link>

        {isLoading && (
          <div className="text-zinc-600 text-sm">Loading…</div>
        )}

        {data && (
          <>
            {/* Header */}
            <div className="flex items-start gap-4 mb-8">
              {data.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.user.image} alt="" className="w-12 h-12 rounded-full border border-zinc-700 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-zinc-800 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl text-white font-light">{data.user.name ?? "—"}</h1>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${SEGMENT_COLORS[data.segment]}`}>
                    {data.segment.replace("_", " ")}
                  </span>
                  {data.streakDays > 0 && (
                    <span className="flex items-center gap-1 text-xs font-mono text-orange-400">
                      <Flame className="w-3 h-3" />{data.streakDays}d streak
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-500 mt-0.5">{data.user.email}</p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  {[data.targetRole, data.department, data.graduationYear ? `Class of ${data.graduationYear}` : null]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
              {latest && (
                <div className="text-right shrink-0">
                  <p className="text-3xl font-light text-white">{latest.totalScore}</p>
                  <p className="text-xs text-zinc-600">readiness</p>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Pillars */}
              {latest && (
                <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <TrendingUp className="w-4 h-4 text-zinc-600" />
                    <h2 className="text-sm font-medium text-white">Pillar Scores</h2>
                  </div>
                  <div className="space-y-3.5">
                    <PillarBar label="DSA" value={latest.dsaScore} color="bg-violet-500" />
                    <PillarBar label="Dev" value={latest.devScore} color="bg-blue-500" />
                    <PillarBar label="Communication" value={latest.commScore} color="bg-amber-500" />
                    <PillarBar label="Consistency" value={latest.consistencyScore} color="bg-green-500" />
                  </div>
                </div>
              )}

              {/* Platform connections */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-5">Platform Connections</h2>
                {data.platformConnections.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No connections yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.platformConnections.map((p) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-zinc-400">
                          {PLATFORM_ICONS[p.platform] ?? <Code2 className="w-4 h-4" />}
                          <span className="text-sm">{p.platform}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.lastSyncedAt && (
                            <span className="text-[10px] text-zinc-600 font-mono">
                              {new Date(p.lastSyncedAt).toLocaleDateString()}
                            </span>
                          )}
                          <SyncBadge status={p.syncStatus} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Missions */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-5">
                  Missions
                  <span className="ml-2 text-zinc-600 font-normal text-xs">
                    {data.missions.filter((m) => m.status === "COMPLETED").length}/{data.missions.length} done
                  </span>
                </h2>
                {data.missions.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No missions assigned.</p>
                ) : (
                  <div className="space-y-2">
                    {data.missions.map((m) => (
                      <div key={m.id} className="flex items-start gap-3 py-1.5">
                        <MissionIcon status={m.status} />
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-300 truncate">{m.title}</p>
                          <p className="text-xs text-zinc-600 truncate">{m.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Score history */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-5">Readiness History</h2>
                {data.readinessScores.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No assessments yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.readinessScores.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-zinc-600 w-4 shrink-0">{i === 0 ? "★" : `#${i + 1}`}</span>
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.totalScore >= 70 ? "bg-green-500" : s.totalScore >= 50 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${s.totalScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-zinc-400 shrink-0">{s.totalScore}</span>
                        <span className="text-[10px] text-zinc-600 shrink-0">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Applications */}
            {data.applications.length > 0 && (
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-white mb-5">Applications</h2>
                <div className="space-y-0">
                  {data.applications.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800/40 last:border-0">
                      <div>
                        <p className="text-sm text-zinc-300">{a.job?.title ?? "—"}</p>
                        <p className="text-xs text-zinc-600">{a.job?.company ?? "—"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-600">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                          a.status === "ACCEPTED" ? "text-green-400 bg-green-500/10 border-green-500/20"
                          : a.status === "REJECTED" ? "text-red-400 bg-red-500/10 border-red-500/20"
                          : "text-zinc-400 bg-zinc-800 border-zinc-700"
                        }`}>
                          {a.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
