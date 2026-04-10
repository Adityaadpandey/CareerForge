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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-zinc-900/50 border border-white/[0.06] rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, label, color }: {
  icon: React.ElementType;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center bg-current/10`}
           style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <p className="text-sm font-medium" style={{ color }}>{label}</p>
    </div>
  );
}

interface Props {
  debrief: Record<string, unknown> | null;
  overallScore: number | null;
}

export function ScorecardTab({ debrief: rawDebrief, overallScore }: Props) {
  if (!rawDebrief) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
        Scorecard is being generated...
      </div>
    );
  }

  const debrief = rawDebrief as unknown as Debrief;

  return (
    <div className="space-y-4">

      {/* Sub-scores */}
      {debrief.scores && (
        <Card>
          <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-5">Performance Breakdown</p>
          <div className="grid grid-cols-3 gap-5">
            {[
              { label: "Accuracy", val: debrief.scores.accuracy,  color: "#60a5fa" },
              { label: "Depth",    val: debrief.scores.depth,     color: "#a78bfa" },
              { label: "Clarity",  val: debrief.scores.clarity,   color: "#34d399" },
            ].map(({ label, val, color }) => (
              <div key={label} className="text-center">
                <div
                  className="text-3xl font-light tabular-nums"
                  style={{ color }}
                >
                  {val?.toFixed(1) ?? "—"}
                </div>
                <div className="text-xs text-zinc-500 font-mono mt-1">{label}</div>
                <div className="h-1 bg-zinc-800 rounded-full mt-2.5">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(val / 10) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Strong zones */}
      {(debrief.strong_zones?.length ?? 0) > 0 && (
        <Card>
          <SectionLabel icon={TrendingUp} label="Strong Zones" color="#4ade80" />
          <ul className="space-y-2">
            {debrief.strong_zones!.map((z, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed">
                <span className="shrink-0 w-4 h-4 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center text-[10px] text-green-400 mt-0.5 font-medium">
                  ✓
                </span>
                {z}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Weak zones */}
      {(debrief.weak_zones?.length ?? 0) > 0 && (
        <Card>
          <SectionLabel icon={TrendingDown} label="Areas to Improve" color="#f87171" />
          <ul className="space-y-2">
            {debrief.weak_zones!.map((z, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed">
                <span className="shrink-0 w-4 h-4 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-[10px] text-red-400 mt-0.5">
                  △
                </span>
                {z}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* In-call emotion snapshot */}
      {debrief.emotion_summary && (
        <Card>
          <SectionLabel icon={Smile} label="In-Call Emotion Snapshot" color="#c084fc" />
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">
                {EMOTION_EMOJI[debrief.emotion_summary.dominant_emotion] ?? "😐"}
              </div>
              <div className="text-xs text-zinc-400 capitalize leading-tight">
                {debrief.emotion_summary.dominant_emotion}
              </div>
              <div className="text-[10px] text-zinc-600 font-mono mt-0.5">dominant</div>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-light text-green-400 tabular-nums">
                {debrief.emotion_summary.confidence_score.toFixed(1)}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">Confidence</div>
              <div className="h-1 bg-zinc-800 rounded-full mt-2">
                <div className="h-full bg-green-500 rounded-full"
                  style={{ width: `${(debrief.emotion_summary.confidence_score / 10) * 100}%` }} />
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-light text-amber-400 tabular-nums">
                {debrief.emotion_summary.nervousness_score.toFixed(1)}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">Nervousness</div>
              <div className="h-1 bg-zinc-800 rounded-full mt-2">
                <div className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${(debrief.emotion_summary.nervousness_score / 10) * 100}%` }} />
              </div>
            </div>
          </div>
          {debrief.emotion_summary.insight && (
            <p className="text-xs text-zinc-400 leading-relaxed border-t border-white/5 pt-3">
              {debrief.emotion_summary.insight}
            </p>
          )}
        </Card>
      )}

      {/* Communication */}
      {debrief.communication && (
        <Card>
          <SectionLabel icon={Mic} label="Communication Metrics" color="#60a5fa" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-zinc-800/50 rounded-xl p-3">
              <div className="text-xl font-light text-white tabular-nums">
                {debrief.communication.filler_word_count}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">Filler words</div>
              {debrief.communication.filler_words_detected.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {debrief.communication.filler_words_detected.slice(0, 5).map((w) => (
                    <span key={w} className="text-[11px] bg-zinc-700/60 text-zinc-400 px-1.5 py-0.5 rounded-md">
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3">
              <div className="text-xl font-light text-white tabular-nums">
                {debrief.communication.estimated_wpm ?? "—"}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">Words / min</div>
            </div>
          </div>
          {debrief.communication.tip && (
            <div className="flex items-start gap-2 text-xs text-zinc-400 border-t border-white/5 pt-3">
              <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              {debrief.communication.tip}
            </div>
          )}
        </Card>
      )}

      {/* Key phrase */}
      {debrief.key_phrase_to_practice && (
        <Card>
          <SectionLabel icon={MessageSquare} label="Practice This Phrase" color="#fbbf24" />
          <p className="text-sm text-zinc-300 italic leading-relaxed">
            &ldquo;{debrief.key_phrase_to_practice}&rdquo;
          </p>
        </Card>
      )}

      {/* Key insight */}
      {debrief.one_insight && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-5">
          <SectionLabel icon={Lightbulb} label="Key Insight" color="#fbbf24" />
          <p className="text-sm text-zinc-200 leading-relaxed">{debrief.one_insight}</p>
        </div>
      )}
    </div>
  );
}
