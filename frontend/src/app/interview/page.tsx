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

const TYPE_LABELS: Record<string, string> = {
  TECHNICAL: "Technical",
  SYSTEM_DESIGN: "System Design",
  BEHAVIORAL: "Behavioral",
  HR: "HR",
  MIXED: "Mixed",
};

const INTERVIEW_TYPES = ["TECHNICAL", "SYSTEM_DESIGN", "BEHAVIORAL", "HR", "MIXED"] as const;

export default function InterviewPage() {
  const router = useRouter();
  const [scheduleType, setScheduleType] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [nowTs, setNowTs] = useState(() => Date.now());

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
      toast.success(
        data.deleted > 0
          ? `Removed ${data.deleted} interview${data.deleted === 1 ? "" : "s"}`
          : "No interviews to remove"
      );
      refetch();
    },
    onError: () => toast.error("Failed to clear interviews"),
  });

  const upcoming = sessions?.filter((s) => s.status === "UPCOMING") ?? [];
  const inProgress = sessions?.filter((s) => s.status === "IN_PROGRESS") ?? [];
  const processing = sessions?.filter((s) => s.status === "PROCESSING") ?? [];
  const completed = sessions?.filter((s) => s.status === "COMPLETED") ?? [];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">Practice</p>
              <h1 className="text-2xl text-white font-light">Mock Interviews</h1>
            </div>
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending || isLoading || !sessions?.length}
              className="px-4 py-2 border border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium rounded-lg transition-colors"
            >
              {clearMutation.isPending ? "Clearing..." : "Clear all interviews"}
            </button>
          </div>
        </div>

        {/* Start a session */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-medium text-white mb-1">Start a session</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Real-time AI interviewer with voice + video. Get a full scorecard with emotion analysis.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {INTERVIEW_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => startMutation.mutate({ type })}
                disabled={startMutation.isPending}
                className="flex flex-col items-center gap-2 p-4 bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/60 hover:border-amber-500/30 rounded-xl transition-colors disabled:opacity-50"
              >
                {startMutation.isPending &&
                startMutation.variables?.type === type &&
                !scheduleType ? (
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                ) : (
                  <Video className="w-5 h-5 text-zinc-400" />
                )}
                <span className="text-xs text-zinc-400 font-mono">{TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>

          {/* Schedule section */}
          <div className="mt-4 pt-4 border-t border-zinc-800/60">
            <p className="text-xs text-zinc-500 mb-3 font-mono">— or schedule for later —</p>
            {scheduleType ? (
              <div className="flex items-center gap-3">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
                <button
                  onClick={() => {
                    if (!scheduledAt) return toast.error("Pick a date and time");
                    startMutation.mutate({ type: scheduleType, scheduledAt });
                  }}
                  disabled={startMutation.isPending}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {startMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Schedule"
                  )}
                </button>
                <button
                  onClick={() => setScheduleType(null)}
                  className="text-xs text-zinc-500 hover:text-white px-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {INTERVIEW_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setScheduleType(type)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 text-xs rounded-lg transition-colors"
                  >
                    <Calendar className="w-3 h-3" />
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-3">
              Scheduled ({upcoming.length})
            </p>
            <div className="space-y-2">
              {upcoming.map((s) => {
                const isReady = s.scheduledAt ? new Date(s.scheduledAt) <= new Date() : true;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <div>
                        <p className="text-sm text-white">{TYPE_LABELS[s.interviewType]}</p>
                        {s.scheduledAt && (
                          <p className="text-xs text-zinc-500 font-mono">
                            {new Date(s.scheduledAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {isReady ? (
                      <button
                        onClick={() => router.push(`/interview/${s.id}/call`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Join Now
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500 font-mono">
                        {s.scheduledAt
                          ? `in ${Math.ceil(
                              (new Date(s.scheduledAt).getTime() - nowTs) / 60000
                            )}m`
                          : "Upcoming"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* In-progress */}
        {inProgress.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-3">
              Resume ({inProgress.length})
            </p>
            <div className="space-y-2">
              {inProgress.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/interview/${s.id}/call`)}
                  className="w-full flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Play className="w-4 h-4 text-amber-400" />
                    <div className="text-left">
                      <p className="text-sm text-white">{TYPE_LABELS[s.interviewType]}</p>
                      {s.mission && <p className="text-xs text-zinc-500">{s.mission.title}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Processing */}
        {processing.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">
              Processing ({processing.length})
            </p>
            <div className="space-y-2">
              {processing.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <Hourglass className="w-4 h-4 text-zinc-500 animate-pulse" />
                    <div>
                      <p className="text-sm text-white">{TYPE_LABELS[s.interviewType]}</p>
                      <p className="text-xs text-zinc-500">Generating scorecard…</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/interview/${s.id}/debrief`)}
                    className="text-xs text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 px-3 py-1 rounded-lg transition-colors"
                  >
                    Check →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <div>
          <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3">History</p>

          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          )}

          {!isLoading && completed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Mic className="w-8 h-8 text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-sm">No completed sessions yet</p>
            </div>
          )}

          <div className="space-y-2">
            {completed.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm text-white">{TYPE_LABELS[s.interviewType]}</p>
                    {s.mission && <p className="text-xs text-zinc-500">{s.mission.title}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {s.overallScore !== null && (
                    <span
                      className={`text-sm font-mono font-medium ${
                        s.overallScore >= 70
                          ? "text-green-400"
                          : s.overallScore >= 50
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      {s.overallScore.toFixed(0)}/100
                    </span>
                  )}
                  <button
                    onClick={() => router.push(`/interview/${s.id}/debrief`)}
                    className="text-xs text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 px-3 py-1 rounded-lg transition-colors"
                  >
                    Scorecard →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
