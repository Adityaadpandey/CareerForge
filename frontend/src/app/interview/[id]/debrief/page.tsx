import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Hourglass, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { DebriefTabs } from "@/components/interview/debrief/debrief-tabs";

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

  // Still processing — show waiting state
  if (interview.status === "PROCESSING" && !interview.debrief) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col">
        {/* Back bar */}
        <header className="border-b border-white/5 px-6 h-14 flex items-center">
          <Link
            href="/interview"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            <Hourglass className="w-3.5 h-3.5" />
            Back to Interviews
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
              <Hourglass className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <h1 className="text-lg text-white font-medium mb-2">Generating your scorecard</h1>
            <p className="text-sm text-zinc-500 leading-relaxed">
              We&apos;re analyzing your transcript and emotion data. This usually takes 1–2 minutes.
            </p>
            <Link
              href="/interview"
              className="inline-flex items-center gap-1.5 mt-8 text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
              Back to Interviews
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const score = interview.overallScore ??
    ((interview.debrief as Record<string, unknown> | null)
      ?.scores as { overall?: number } | undefined
    )?.overall ?? null;

  const overallScore = score != null
    ? typeof score === "number" && score <= 10
      ? score * 10
      : (score as number)
    : null;

  return (
    <DebriefTabs
      interviewId={id}
      interviewType={interview.interviewType}
      interviewTitle={interview.mission?.title ?? "General Interview"}
      debrief={interview.debrief as Record<string, unknown> | null}
      overallScore={overallScore}
      recordingUrl={interview.recordingUrl ?? null}
      transcriptUrl={interview.transcriptUrl ?? null}
      humeAnalysis={interview.humeAnalysis as Record<string, unknown> | null}
      humeJobId={interview.humeJobId ?? null}
    />
  );
}
