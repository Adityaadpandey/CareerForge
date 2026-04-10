import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
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
