import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { CallProvider } from "@/components/interview/call-provider";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InterviewCallPage({ params }: Props) {
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
    select: { id: true, interviewType: true, status: true },
  });

  if (!interview) notFound();

  if (interview.status === "COMPLETED" || interview.status === "PROCESSING") {
    redirect(`/interview/${id}/debrief`);
  }

  return (
    <div className="h-screen overflow-hidden">
      <CallProvider
        interviewId={interview.id}
        interviewType={interview.interviewType}
      />
    </div>
  );
}
