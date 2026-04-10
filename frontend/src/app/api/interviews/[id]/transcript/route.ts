import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type TranscriptLine = {
  speaker: string;
  text: string;
  start: number;
  end: number;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const interview = await prisma.interviewSession.findFirst({
    where: { id, studentProfileId: profile.id },
    select: { transcriptUrl: true },
  });
  if (!interview?.transcriptUrl) {
    return NextResponse.json({ lines: [] });
  }

  try {
    const res = await fetch(interview.transcriptUrl);
    const text = await res.text();

    const lines: TranscriptLine[] = text
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((obj) => {
        const raw = obj as Record<string, unknown>;
        const speaker =
          (raw.speaker as string | undefined) ??
          ((raw.type as string) === "user" ? "You" : "AI Interviewer");
        return {
          speaker,
          text: (raw.text as string) ?? "",
          start: (raw.start_time as number) ?? 0,
          end: (raw.stop_time as number) ?? 0,
        };
      })
      .filter((l) => l.text.trim().length > 0);

    return NextResponse.json({ lines });
  } catch (err) {
    console.error("[transcript] fetch failed:", err);
    return NextResponse.json({ lines: [] });
  }
}
