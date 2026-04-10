"use client";

import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Lightbulb,
  Smile,
  Mic,
  AlertCircle,
} from "lucide-react";

type Debrief = {
  strong_zones?: string[];
  weak_zones?: string[];
  key_phrase_to_practice?: string;
  one_insight?: string;
  scores?: { accuracy: number; depth: number; clarity: number; overall: number };
  emotion_summary?: {
    dominant_emotion: string;
    confidence_score: number;
    nervousness_score: number;
    insight: string;
  };
  communication?: {
    filler_word_count: number;
    filler_words_detected: string[];
    estimated_wpm: number | null;
    eye_contact_score: number | null;
    tip: string;
  };
};

const EMOTION_EMOJI: Record<string, string> = {
  neutral: "😐", happy: "😊", sad: "😔", angry: "😠",
  fearful: "😨", disgusted: "😒", surprised: "😲",
};

interface Props {
  debrief: Record<string, unknown> | null;
  overallScore: number | null;
}

export function ScorecardTab({ debrief: rawDebrief, overallScore }: Props) {
  if (!rawDebrief) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
        Scorecard is being generated...
      </div>
    );
  }

  const debrief = rawDebrief as unknown as Debrief;
  const score = overallScore ?? (debrief.scores?.overall ?? 0) * 10;
  const scoreColor =
    score >= 70 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* Overall score */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 text-center">
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">
          Overall Score
        </p>
        <div className={`text-6xl font-light ${scoreColor}`}>{score.toFixed(0)}</div>
        <div className="text-zinc-600 text-sm mt-1">/ 100</div>

        {debrief.scores && (
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-800/60">
            {[
              { label: "Accuracy", val: debrief.scores.accuracy },
              { label: "Depth", val: debrief.scores.depth },
              { label: "Clarity", val: debrief.scores.clarity },
            ].map(({ label, val }) => (
              <div key={label}>
                <div className="text-2xl font-light text-white">{val?.toFixed(1) ?? "—"}</div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">{label}</div>
                <div className="h-1 bg-zinc-800 rounded-full mt-2">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${(val / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emotion summary from face-api (captured during call) */}
      {debrief.emotion_summary && (
        <div className="bg-zinc-900/60 border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Smile className="w-4 h-4 text-purple-400" />
            <p className="text-sm font-medium text-purple-400">In-Call Emotion Snapshot</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl mb-1">
                {EMOTION_EMOJI[debrief.emotion_summary.dominant_emotion] ?? "😐"}
              </div>
              <div className="text-xs text-zinc-500 capitalize">
                {debrief.emotion_summary.dominant_emotion}
              </div>
              <div className="text-xs text-zinc-600 font-mono">dominant</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-green-400">
                {debrief.emotion_summary.confidence_score.toFixed(1)}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">Confidence</div>
              <div className="h-1 bg-zinc-800 rounded-full mt-1">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${(debrief.emotion_summary.confidence_score / 10) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-amber-400">
                {debrief.emotion_summary.nervousness_score.toFixed(1)}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">Nervousness</div>
              <div className="h-1 bg-zinc-800 rounded-full mt-1">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${(debrief.emotion_summary.nervousness_score / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
          {debrief.emotion_summary.insight && (
            <p className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-3">
              {debrief.emotion_summary.insight}
            </p>
          )}
        </div>
      )}

      {/* Communication */}
      {debrief.communication && (
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-medium text-blue-400">Communication Metrics</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="bg-zinc-800/40 rounded-xl p-3">
              <div className="text-lg font-light text-white">
                {debrief.communication.filler_word_count}
              </div>
              <div className="text-xs text-zinc-500 font-mono">Filler words</div>
              {debrief.communication.filler_words_detected.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {debrief.communication.filler_words_detected.slice(0, 5).map((w) => (
                    <span key={w} className="text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3">
              <div className="text-lg font-light text-white">
                {debrief.communication.estimated_wpm ?? "—"}
              </div>
              <div className="text-xs text-zinc-500 font-mono">Words / min</div>
            </div>
          </div>
          {debrief.communication.tip && (
            <div className="flex items-start gap-2 text-xs text-zinc-400 border-t border-zinc-800/60 pt-3">
              <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              {debrief.communication.tip}
            </div>
          )}
        </div>
      )}

      {/* Strong zones */}
      {(debrief.strong_zones?.length ?? 0) > 0 && (
        <div className="bg-zinc-900/60 border border-green-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="text-sm font-medium text-green-400">Strong Zones</p>
          </div>
          <ul className="space-y-1.5">
            {debrief.strong_zones!.map((z, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-green-500 mt-0.5">✓</span>
                {z}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weak zones */}
      {(debrief.weak_zones?.length ?? 0) > 0 && (
        <div className="bg-zinc-900/60 border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-sm font-medium text-red-400">Areas to Improve</p>
          </div>
          <ul className="space-y-1.5">
            {debrief.weak_zones!.map((z, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-red-400 mt-0.5">△</span>
                {z}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key phrase */}
      {debrief.key_phrase_to_practice && (
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-400">Practice This Phrase</p>
          </div>
          <p className="text-sm text-zinc-300 italic leading-relaxed">
            &ldquo;{debrief.key_phrase_to_practice}&rdquo;
          </p>
        </div>
      )}

      {/* One insight */}
      {debrief.one_insight && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-400">Key Insight</p>
          </div>
          <p className="text-sm text-zinc-200 leading-relaxed">{debrief.one_insight}</p>
        </div>
      )}
    </div>
  );
}
