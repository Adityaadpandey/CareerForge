"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Sidebar } from "@/components/shared/sidebar";
import {
  Mic,
  Play,
  CheckCircle2,
  Loader2,
  Video,
  Calendar,
  Hourglass,
  Zap,
  Code2,
  Users,
  Briefcase,
  LayoutGrid,
  ChevronRight,
  Clock,
  Trophy,
  ArrowRight,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type InterviewSession = {
  id: string;
  interviewType: string;
  status: string;
  overallScore: number | null;
  createdAt: string;
  completedAt: string | null;
  scheduledAt: string | null;
  mission: { title: string } | null;
};

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string; desc: string }> = {
  TECHNICAL:     { label: "Technical",     icon: Code2,       color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   desc: "DSA, algorithms & system thinking" },
  SYSTEM_DESIGN: { label: "System Design", icon: LayoutGrid,  color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", desc: "Architecture & scalability" },
  BEHAVIORAL:    { label: "Behavioral",    icon: Users,       color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  desc: "STAR method, leadership & teamwork" },
  HR:            { label: "HR",            icon: Briefcase,   color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", desc: "Culture fit & career goals" },
  MIXED:         { label: "Mixed",         icon: Zap,         color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  desc: "All-round comprehensive round" },
};

const INTERVIEW_TYPES = ["TECHNICAL", "SYSTEM_DESIGN", "BEHAVIORAL", "HR", "MIXED"] as const;

function scoreColor(score: number) {
  return score >= 70 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";
}
function scoreBg(score: number) {
  return score >= 70 ? "bg-green-500/10 border-green-500/20" : score >= 50 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";
}

export default function InterviewPage() {
  const router = useRouter();
  const [scheduleType, setScheduleType] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: sessions, isLoading, refetch } = useQuery<InterviewSession[]>({
    queryKey: ["interviews"],
    queryFn: () => axios.get<InterviewSession[]>("/api/interviews").then((r) => r.data),
  });

  const startMutation = useMutation({
    mutationFn: ({ type, scheduledAt }: { type: string; scheduledAt?: string }) =>
      axios.post<InterviewSession>("/api/interviews", { type, scheduledAt }).then((r) => r.data),
    onSuccess: (session) => {
      if (session.status === "UPCOMING") {
        toast.success("Interview scheduled!");
        setScheduleType(null);
        setScheduledAt("");
        refetch();
      } else {
        router.push(`/interview/${session.id}/call`);
      }
    },
    onError: () => toast.error("Failed to create interview"),
  });

  const clearMutation = useMutation({
    mutationFn: () => axios.delete<{ deleted: number }>("/api/interviews").then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.deleted > 0 ? `Removed ${data.deleted} interview${data.deleted === 1 ? "" : "s"}` : "No interviews to remove");
      refetch();
    },
    onError: () => toast.error("Failed to clear interviews"),
  });

  const upcoming   = sessions?.filter((s) => s.status === "UPCOMING")    ?? [];
  const inProgress = sessions?.filter((s) => s.status === "IN_PROGRESS") ?? [];
  const processing = sessions?.filter((s) => s.status === "PROCESSING")  ?? [];
  const completed  = sessions?.filter((s) => s.status === "COMPLETED")   ?? [];

  const avgScore = completed.length
    ? completed.filter((s) => s.overallScore !== null).reduce((a, s) => a + (s.overallScore ?? 0), 0) /
      (completed.filter((s) => s.overallScore !== null).length || 1)
    : null;

  return (
    <div className="flex min-h-screen bg-[#080808]">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10">

          {/* ── Header ───────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <p className="text-xs font-mono tracking-widest text-zinc-600 uppercase mb-2">Practice Arena</p>
              <h1 className="text-3xl font-light text-white tracking-tight">Mock Interviews</h1>
              <p className="text-sm text-zinc-500 mt-1.5">Real-time AI interviewer · Voice + Video · Emotion analysis</p>
            </div>

            {/* Stats pill */}
            {completed.length > 0 && (
              <div className="flex items-center gap-4 bg-zinc-900/60 border border-white/[0.06] rounded-2xl px-5 py-3">
                <div className="text-center">
                  <p className="text-xl font-light text-white tabular-nums">{completed.length}</p>
                  <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider mt-0.5">Done</p>
                </div>
                {avgScore !== null && (
                  <>
                    <div className="w-px h-8 bg-zinc-800" />
                    <div className="text-center">
                      <p className={`text-xl font-light tabular-nums ${scoreColor(avgScore)}`}>
                        {Math.round(avgScore)}
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider mt-0.5">Avg score</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Start now ────────────────────────────────────── */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Start immediately</p>
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-mono border border-zinc-800 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                AI agent ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {INTERVIEW_TYPES.map((type) => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                const isPending = startMutation.isPending && startMutation.variables?.type === type && !scheduleType;

                return (
                  <button
                    key={type}
                    onClick={() => startMutation.mutate({ type })}
                    onMouseEnter={() => setHovered(type)}
                    onMouseLeave={() => setHovered(null)}
                    disabled={startMutation.isPending}
                    className={`group relative text-left p-5 rounded-2xl border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                      ${hovered === type
                        ? `${meta.bg} ${meta.border} shadow-lg`
                        : "bg-zinc-900/40 border-white/[0.06] hover:border-white/10"
                      }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg} border ${meta.border}`}>
                        {isPending
                          ? <Loader2 className={`w-4 h-4 ${meta.color} animate-spin`} />
                          : <Icon className={`w-4 h-4 ${meta.color}`} />
                        }
                      </div>
                      <ArrowRight className={`w-4 h-4 transition-all duration-200 ${hovered === type ? `${meta.color} translate-x-0.5` : "text-zinc-700"}`} />
                    </div>
                    <p className="text-sm font-medium text-white mb-0.5">{meta.label}</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">{meta.desc}</p>

                    {/* Hover glow */}
                    {hovered === type && (
                      <div className={`absolute inset-0 rounded-2xl ${meta.bg} opacity-30 pointer-events-none`} />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Schedule for later ───────────────────────────── */}
          <section className="mb-8">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">Schedule for later</p>

            {scheduleType ? (
              <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${TYPE_META[scheduleType].bg} border ${TYPE_META[scheduleType].border}`}>
                    {(() => { const Icon = TYPE_META[scheduleType].icon; return <Icon className={`w-3 h-3 ${TYPE_META[scheduleType].color}`} />; })()}
                  </div>
                  <span className="text-sm text-white font-medium">{TYPE_META[scheduleType].label}</span>
                  <button onClick={() => setScheduleType(null)} className="ml-auto text-zinc-600 hover:text-zinc-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-3">
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/40 transition-colors"
                  />
                  <button
                    onClick={() => {
                      if (!scheduledAt) return toast.error("Pick a date and time");
                      startMutation.mutate({ type: scheduleType, scheduledAt });
                    }}
                    disabled={startMutation.isPending}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calendar className="w-3.5 h-3.5" /> Schedule</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {INTERVIEW_TYPES.map((type) => {
                  const meta = TYPE_META[type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setScheduleType(type)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium transition-all duration-150
                        border-zinc-800 text-zinc-500 hover:${meta.border} hover:${meta.color} hover:${meta.bg}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {meta.label}
                      <Calendar className="w-3 h-3 opacity-50" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Upcoming scheduled ───────────────────────────── */}
          {upcoming.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <p className="text-xs font-mono text-blue-400 uppercase tracking-widest">Scheduled · {upcoming.length}</p>
              </div>
              <div className="space-y-2.5">
                {upcoming.map((s) => {
                  const meta = TYPE_META[s.interviewType] ?? TYPE_META.MIXED;
                  const Icon = meta.icon;
                  const isReady = s.scheduledAt ? new Date(s.scheduledAt) <= new Date(nowTs) : true;
                  const minsLeft = s.scheduledAt
                    ? Math.ceil((new Date(s.scheduledAt).getTime() - nowTs) / 60000)
                    : 0;

                  return (
                    <div key={s.id} className="flex items-center gap-4 p-4 bg-blue-500/5 border border-blue-500/15 rounded-2xl">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{meta.label} Interview</p>
                        {s.scheduledAt && (
                          <p className="text-xs text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(s.scheduledAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {isReady ? (
                        <button
                          onClick={() => router.push(`/interview/${s.id}/call`)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium rounded-xl transition-colors"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Join Now
                        </button>
                      ) : (
                        <span className="text-xs text-blue-400/70 font-mono bg-blue-500/10 border border-blue-500/15 px-3 py-1.5 rounded-lg">
                          in {minsLeft}m
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── In-progress ──────────────────────────────────── */}
          {inProgress.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-xs font-mono text-amber-400 uppercase tracking-widest">In Progress · {inProgress.length}</p>
              </div>
              <div className="space-y-2.5">
                {inProgress.map((s) => {
                  const meta = TYPE_META[s.interviewType] ?? TYPE_META.MIXED;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/interview/${s.id}/call`)}
                      className="w-full flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl hover:border-amber-500/30 hover:bg-amber-500/10 transition-all text-left group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{meta.label} Interview</p>
                        {s.mission && <p className="text-xs text-zinc-500">{s.mission.title}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-600 font-mono">{new Date(s.createdAt).toLocaleDateString()}</span>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <Play className="w-3 h-3 text-amber-400" />
                          <span className="text-xs text-amber-400 font-medium">Resume</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Processing ───────────────────────────────────── */}
          {processing.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Processing · {processing.length}</p>
              </div>
              <div className="space-y-2.5">
                {processing.map((s) => {
                  const meta = TYPE_META[s.interviewType] ?? TYPE_META.MIXED;
                  const Icon = meta.icon;
                  return (
                    <div key={s.id} className="flex items-center gap-4 p-4 bg-zinc-900/40 border border-white/[0.05] rounded-2xl">
                      <div className="w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-zinc-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{meta.label} Interview</p>
                        <p className="text-xs text-zinc-600 flex items-center gap-1.5 mt-0.5">
                          <Hourglass className="w-3 h-3 animate-pulse" />
                          Generating scorecard…
                        </p>
                      </div>
                      <button
                        onClick={() => router.push(`/interview/${s.id}/debrief`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700/60 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs rounded-xl transition-colors"
                      >
                        Check
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── History ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">History</p>
              </div>
              {sessions && sessions.length > 0 && (
                <button
                  onClick={() => clearMutation.mutate()}
                  disabled={clearMutation.isPending}
                  className="text-xs text-zinc-700 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  {clearMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Clear all"}
                </button>
              )}
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-zinc-700 animate-spin" />
              </div>
            )}

            {!isLoading && completed.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900/60 border border-white/[0.05] flex items-center justify-center mx-auto mb-4">
                  <Mic className="w-6 h-6 text-zinc-700" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">No completed sessions yet</p>
                <p className="text-xs text-zinc-700 mt-1">Start an interview above to get your first scorecard</p>
              </div>
            )}

            {completed.length > 0 && (
              <div className="space-y-2.5">
                {completed.map((s) => {
                  const meta = TYPE_META[s.interviewType] ?? TYPE_META.MIXED;
                  const Icon = meta.icon;
                  const score = s.overallScore;

                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-4 p-4 bg-zinc-900/30 border border-white/[0.04] rounded-2xl hover:border-white/10 hover:bg-zinc-900/50 transition-all group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center shrink-0">
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{meta.label} Interview</p>
                        <p className="text-xs text-zinc-600 font-mono mt-0.5">
                          {s.completedAt
                            ? new Date(s.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {score !== null && (
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium ${scoreBg(score)} ${scoreColor(score)}`}>
                            <Trophy className="w-3 h-3" />
                            {Math.round(score)}/100
                          </div>
                        )}
                        <button
                          onClick={() => router.push(`/interview/${s.id}/debrief`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700/60 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Scorecard
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        {/* Always visible fallback on mobile */}
                        <button
                          onClick={() => router.push(`/interview/${s.id}/debrief`)}
                          className="flex sm:hidden items-center gap-1 text-xs text-zinc-500"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
