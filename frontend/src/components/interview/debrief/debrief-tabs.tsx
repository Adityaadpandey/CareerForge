"use client";

import { useState } from "react";
import { BarChart3, Video, Brain, MessageSquare } from "lucide-react";
import { ScorecardTab } from "./scorecard-tab";
import { RecordingTab } from "./recording-tab";
import { EmotionTab } from "./emotion-tab";
import { CoachTab } from "./coach-tab";

const TABS = [
  { id: "scorecard", label: "Scorecard", icon: BarChart3 },
  { id: "recording", label: "Recording & Transcript", icon: Video },
  { id: "emotion", label: "Emotion Analysis", icon: Brain },
  { id: "coach", label: "AI Coach", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-zinc-800/60 px-6 py-5">
        <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">
          Interview Debrief
        </p>
        <h1 className="text-xl text-white font-light mt-0.5">{interviewTitle}</h1>
        <p className="text-xs text-zinc-600 font-mono mt-0.5">{interviewType}</p>
      </div>

      <div className="flex min-h-[calc(100vh-89px)]">
        {/* Left column — tab headings */}
        <nav className="w-52 shrink-0 border-r border-zinc-800/60 p-4 flex flex-col gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors w-full ${
                  isActive
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right panel — tab content */}
        <main className="flex-1 overflow-y-auto p-6 max-w-3xl">
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
        </main>
      </div>
    </div>
  );
}
