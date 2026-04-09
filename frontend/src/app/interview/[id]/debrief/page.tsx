import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, TrendingUp, TrendingDown, MessageSquare, Lightbulb } from "lucide-react";

type Debrief = {
  strong_zones: string[];
  weak_zones: string[];
  key_phrase_to_practice: string;
  one_insight: string;
  scores: { accuracy: number; depth: number; clarity: number; overall: number };
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

  if (!interview || !interview.debrief) notFound();

  const debrief = interview.debrief as unknown as Debrief;
  const score = interview.overallScore ?? debrief.scores?.overall ?? 0;

  const scoreColor =
    score >= 7 ? "text-green-400" : score >= 5 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 md:p-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4 font-mono"
        >
          <ChevronLeft className="w-3 h-3" />
          Dashboard
        </Link>
        <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">Interview Debrief</p>
        <h1 className="text-2xl text-white font-light mt-1">
          {interview.mission?.title ?? "General Interview"}
        </h1>
      </div>

      {/* Overall score */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 mb-6 text-center">
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">Overall Score</p>
        <div className={`text-6xl font-light ${scoreColor}`}>{score.toFixed(1)}</div>
        <div className="text-zinc-600 text-sm mt-1">/ 10</div>

        {/* Score pillars */}
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
          href="/roadmap"
          className="flex-1 text-center py-2.5 border border-zinc-800 text-zinc-400 hover:text-white text-sm rounded-xl transition-colors"
        >
          Back to Roadmap
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
