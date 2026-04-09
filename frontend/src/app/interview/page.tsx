"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Sidebar } from "@/components/shared/sidebar";
import { Mic, Play, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type InterviewSession = {
  id: string;
  interviewType: string;
  status: string;
  overallScore: number | null;
  createdAt: string;
  completedAt: string | null;
  mission: { title: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  TECHNICAL: "Technical",
  SYSTEM_DESIGN: "System Design",
  BEHAVIORAL: "Behavioral",
  MIXED: "Mixed",
};

const INTERVIEW_TYPES = ["TECHNICAL", "SYSTEM_DESIGN", "BEHAVIORAL", "MIXED"] as const;

export default function InterviewPage() {
  const router = useRouter();

  const { data: sessions, isLoading } = useQuery<InterviewSession[]>({
    queryKey: ["interviews"],
    queryFn: () => axios.get<InterviewSession[]>("/api/interviews").then((r) => r.data),
  });

  const startMutation = useMutation({
    mutationFn: (type: string) =>
      axios.post<InterviewSession>("/api/interviews", { type }).then((r) => r.data),
    onSuccess: (session) => {
      router.push(`/interview/${session.id}`);
    },
    onError: () => toast.error("Failed to start interview"),
  });

  const completed = sessions?.filter((s) => s.status === "COMPLETED") ?? [];
  const inProgress = sessions?.filter((s) => s.status === "IN_PROGRESS") ?? [];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-4xl">
        <div className="mb-8">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">Practice</p>
          <h1 className="text-2xl text-white font-light">Mock Interviews</h1>
        </div>

        {/* Start a new interview */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-medium text-white mb-1">Start a session</h2>
          <p className="text-xs text-zinc-500 mb-4">
            AI interviewer adapts questions to your profile and mission context.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {INTERVIEW_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => startMutation.mutate(type)}
                disabled={startMutation.isPending}
                className="flex flex-col items-center gap-2 p-4 bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/60 hover:border-amber-500/30 rounded-xl transition-colors disabled:opacity-50"
              >
                {startMutation.isPending && startMutation.variables === type ? (
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                ) : (
                  <Mic className="w-5 h-5 text-zinc-400" />
                )}
                <span className="text-xs text-zinc-400 font-mono">{TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* In-progress sessions */}
        {inProgress.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-3">
              Resume ({inProgress.length})
            </p>
            <div className="space-y-2">
              {inProgress.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/interview/${s.id}`)}
                  className="w-full flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Play className="w-4 h-4 text-amber-400" />
                    <div className="text-left">
                      <p className="text-sm text-white">{TYPE_LABELS[s.interviewType]}</p>
                      {s.mission && <p className="text-xs text-zinc-500">{s.mission.title}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="text-xs text-zinc-500 font-mono">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Past sessions */}
        <div>
          <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3">
            History
          </p>

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
                    Debrief →
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
