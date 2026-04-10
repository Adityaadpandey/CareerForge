"use client";

import { useEffect, useState } from "react";
import { Loader2, FileText, User, Bot } from "lucide-react";

type TranscriptLine = {
  speaker: string;
  text: string;
  start: number;
  end: number;
};

interface Props {
  recordingUrl: string | null;
  transcriptUrl: string | null;
  interviewId: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecordingTab({ recordingUrl, interviewId }: Props) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/interviews/${interviewId}/transcript`)
      .then((r) => r.json())
      .then((d: { lines: TranscriptLine[] }) => setLines(d.lines))
      .catch(() => setLines([]))
      .finally(() => setLoading(false));
  }, [interviewId]);

  return (
    <div className="space-y-5">
      {/* Video player */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800/60 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <p className="text-sm font-medium text-zinc-300">Interview Recording</p>
        </div>
        {recordingUrl ? (
          <video
            src={recordingUrl}
            controls
            className="w-full aspect-video bg-black"
            preload="metadata"
          />
        ) : (
          <div className="aspect-video flex items-center justify-center bg-zinc-950 text-zinc-600 text-sm">
            Recording not available yet
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800/60 flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-300">Transcript</p>
          {!loading && (
            <span className="ml-auto text-xs text-zinc-600 font-mono">
              {lines.length} lines
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : lines.length === 0 ? (
          <div className="p-6 text-center text-zinc-600 text-sm">
            Transcript not available yet
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40 max-h-[60vh] overflow-y-auto">
            {lines.map((line, i) => {
              const isAI =
                line.speaker.toLowerCase().includes("ai") ||
                line.speaker.toLowerCase().includes("interviewer") ||
                line.speaker === "assistant";
              return (
                <div key={i} className={`flex gap-3 p-4 ${isAI ? "bg-zinc-800/20" : ""}`}>
                  <div className="shrink-0 mt-0.5">
                    {isAI ? (
                      <Bot className="w-4 h-4 text-amber-400" />
                    ) : (
                      <User className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`text-xs font-medium ${isAI ? "text-amber-400" : "text-blue-400"}`}>
                        {isAI ? "AI Interviewer" : "You"}
                      </span>
                      {line.start > 0 && (
                        <span className="text-xs text-zinc-600 font-mono">
                          {formatTime(line.start)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{line.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
