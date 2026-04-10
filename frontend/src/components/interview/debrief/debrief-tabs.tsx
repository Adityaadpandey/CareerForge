"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Video, Brain, MessageSquare, ChevronLeft, Zap } from "lucide-react";
import { ScorecardTab } from "./scorecard-tab";
import { RecordingTab } from "./recording-tab";
import { EmotionTab } from "./emotion-tab";
import { CoachTab } from "./coach-tab";

const TABS = [
  { id: "scorecard",  label: "Scorecard",             icon: BarChart3,    desc: "Scores & feedback"       },
  { id: "recording",  label: "Recording",              icon: Video,        desc: "Replay & transcript"     },
  { id: "emotion",    label: "Emotion Analysis",       icon: Brain,        desc: "Hume AI sentiment"       },
  { id: "coach",      label: "AI Coach",               icon: MessageSquare,desc: "Ask anything"            },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TYPE_BADGE: Record<string, string> = {
  TECHNICAL:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  BEHAVIORAL:    "bg-green-500/10 text-green-400 border-green-500/20",
  HR:            "bg-purple-500/10 text-purple-400 border-purple-500/20",
  SYSTEM_DESIGN: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  MIXED:         "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

interface Props {
  interviewId: string;
  interviewType: string;
  interviewTitle: string;
  debrief: Record<string, unknown> | null;
  overallScore: number | null;
  recordingUrl: string | null;
  transcriptUrl: string | null;
  humeAnalysis: Record<string, unknown> | null;
  humeJobId: string | null;
}

export function DebriefTabs({
  interviewId,
  interviewType,
  interviewTitle,
  debrief,
  overallScore,
  recordingUrl,
  transcriptUrl,
  humeAnalysis,
  humeJobId,
}: Props) {
  const [active, setActive] = useState<TabId>("scorecard");

  const score = overallScore ?? 0;
  const scoreColor =
    score >= 70 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const scoreBg =
    score >= 70 ? "from-green-500/10" : score >= 50 ? "from-amber-500/10" : "from-red-500/10";

  return (
    <div className="min-h-screen bg-[#080808]">

      {/* ── Top bar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-[#080808]/90 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link
            href="/interview"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors group"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Interviews
          </Link>

          <div className="h-4 w-px bg-zinc-800" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-sm text-white truncate">{interviewTitle}</span>
            <span
              className={`hidden sm:inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${TYPE_BADGE[interviewType] ?? TYPE_BADGE.MIXED}`}
            >
              {interviewType.replace("_", " ")}
            </span>
          </div>

          {overallScore !== null && (
            <div className="ml-auto flex items-baseline gap-1">
              <span className={`text-xl font-light tabular-nums ${scoreColor}`}>
                {Math.round(score)}
              </span>
              <span className="text-xs text-zinc-600">/100</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Score hero strip ─────────────────────────────────── */}
      {overallScore !== null && (
        <div className={`bg-gradient-to-b ${scoreBg} to-transparent border-b border-white/5`}>
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-6">
            <div>
              <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest">Overall Score</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-4xl font-light tabular-nums ${scoreColor}`}>
                  {Math.round(score)}
                </span>
                <span className="text-zinc-600 text-sm">/ 100</span>
              </div>
            </div>
            <div className="flex-1 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  score >= 70 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Main layout ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex min-h-[calc(100vh-112px)]">

        {/* Sidebar nav */}
        <aside className="w-56 shrink-0 p-4 border-r border-white/5 flex flex-col gap-1 pt-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`group flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all w-full ${
                  isActive
                    ? "bg-zinc-800/80 border border-zinc-700/60 shadow-sm"
                    : "hover:bg-zinc-900/60 border border-transparent"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    isActive
                      ? "bg-amber-500/20 border border-amber-500/30"
                      : "bg-zinc-800/60 border border-zinc-700/40 group-hover:bg-zinc-800"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-amber-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium leading-tight ${isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"}`}>
                    {tab.label}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-tight">{tab.desc}</p>
                </div>
              </button>
            );
          })}

          {/* Spacer + back link at bottom */}
          <div className="mt-auto pt-6">
            <Link
              href="/interview"
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors rounded-lg hover:bg-zinc-900/40"
            >
              <ChevronLeft className="w-3 h-3" />
              Back to Interviews
            </Link>
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {active === "scorecard" && (
              <ScorecardTab debrief={debrief} overallScore={overallScore} />
            )}
            {active === "recording" && (
              <RecordingTab
                recordingUrl={recordingUrl}
                transcriptUrl={transcriptUrl}
                interviewId={interviewId}
              />
            )}
            {active === "emotion" && (
              <EmotionTab
                interviewId={interviewId}
                initialAnalysis={humeAnalysis}
                humeJobId={humeJobId}
              />
            )}
            {active === "coach" && (
              <CoachTab interviewId={interviewId} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
