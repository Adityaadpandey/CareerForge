import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Lightbulb,
  Smile,
  AlertCircle,
  Hourglass,
  Mic,
} from "lucide-react";

type Debrief = {
  strong_zones: string[];
  weak_zones: string[];
  key_phrase_to_practice: string;
  one_insight: string;
  scores: { accuracy: number; depth: number; clarity: number; overall: number };
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
  neutral: "😐",
  happy: "😊",
  sad: "😔",
  angry: "😠",
  fearful: "😨",
  disgusted: "😒",
  surprised: "😲",
};

export default async function DebriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) redirect("/dashboard");

  const interview = await prisma.interviewSession.findFirst({
    where: { id, studentProfileId: profile.id },
    include: { mission: { select: { title: true } } },
  });

  if (!interview) notFound();

  // Show processing state while transcript is being analyzed
  if (
    interview.status === "PROCESSING" ||
    (!interview.debrief && interview.status !== "COMPLETED")
  ) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Hourglass className="w-10 h-10 text-amber-400 mx-auto mb-4 animate-pulse" />
          <h1 className="text-xl text-white font-light mb-2">Generating Your Scorecard</h1>
          <p className="text-sm text-zinc-500">
            We&apos;re analyzing your interview transcript and emotion data. This usually takes
            1–2 minutes.
          </p>
          <Link
            href="/interview"
            className="inline-block mt-6 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            ← Back to Interviews
          </Link>
        </div>
      </div>
    );
  }

  if (!interview.debrief) notFound();

  const debrief = interview.debrief as unknown as Debrief;
  const score = interview.overallScore ?? (debrief.scores?.overall ?? 0) * 10;

  const scoreColor =
    score >= 70 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 md:p-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/interview"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4 font-mono"
        >
          <ChevronLeft className="w-3 h-3" />
          Interviews
        </Link>
        <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">
          Interview Scorecard
        </p>
        <h1 className="text-2xl text-white font-light mt-1">
          {interview.mission?.title ?? "General Interview"}
        </h1>
      </div>

      {/* Overall score */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 mb-6 text-center">
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
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${(val / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emotion Analysis */}
      {debrief.emotion_summary && (
        <div className="bg-zinc-900/60 border border-purple-500/20 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Smile className="w-4 h-4 text-purple-400" />
            <p className="text-sm font-medium text-purple-400">Emotion Analysis</p>
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
                  style={{
                    width: `${(debrief.emotion_summary.confidence_score / 10) * 100}%`,
                  }}
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
                  style={{
                    width: `${(debrief.emotion_summary.nervousness_score / 10) * 100}%`,
                  }}
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

      {/* Communication Metrics */}
      {debrief.communication && (
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 mb-4">
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
                    <span
                      key={w}
                      className="text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded"
                    >
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
              {debrief.communication.eye_contact_score !== null && (
                <div className="mt-2">
                  <div className="text-xs text-zinc-500 mb-1">Eye contact</div>
                  <div className="h-1 bg-zinc-800 rounded-full">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${((debrief.communication.eye_contact_score ?? 0) / 10) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
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
      {debrief.strong_zones?.length > 0 && (
        <div className="bg-zinc-900/60 border border-green-500/20 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="text-sm font-medium text-green-400">Strong Zones</p>
          </div>
          <ul className="space-y-1.5">
            {debrief.strong_zones.map((z, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-green-500 mt-0.5">✓</span>
                {z}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weak zones */}
      {debrief.weak_zones?.length > 0 && (
        <div className="bg-zinc-900/60 border border-red-500/20 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-sm font-medium text-red-400">Areas to Improve</p>
          </div>
          <ul className="space-y-1.5">
            {debrief.weak_zones.map((z, i) => (
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
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 mb-4">
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

      <div className="mt-8 flex gap-3">
        <Link
          href="/interview"
          className="flex-1 text-center py-2.5 border border-zinc-800 text-zinc-400 hover:text-white text-sm rounded-xl transition-colors"
        >
          More Interviews
        </Link>
        <Link
          href="/dashboard"
          className="flex-1 text-center py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
