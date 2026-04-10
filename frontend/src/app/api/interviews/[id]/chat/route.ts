import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const { messages } = (await req.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return new Response("No profile", { status: 404 });

  const interview = await prisma.interviewSession.findFirst({
    where: { id, studentProfileId: profile.id },
    select: {
      id: true,
      interviewType: true,
      debrief: true,
      humeAnalysis: true,
      overallScore: true,
      transcriptUrl: true,
    },
  });
  if (!interview) return new Response("Not found", { status: 404 });

  // Build context for the AI coach
  const debriefText = interview.debrief
    ? JSON.stringify(interview.debrief, null, 2)
    : "No debrief available yet.";

  const humeText = interview.humeAnalysis
    ? JSON.stringify(interview.humeAnalysis, null, 2)
    : "Emotion analysis not yet available.";

  const systemPrompt = `You are an expert interview coach reviewing a ${interview.interviewType} interview.

The candidate just completed their interview. Here is everything you know about their performance:

## AI Interviewer Feedback & Scores
${debriefText}

## Hume AI Emotion Analysis (from video/audio)
${humeText}

## Overall Score
${interview.overallScore ?? "Calculating..."}

Your job is to answer the candidate's questions about their performance. Be:
- Specific and honest — reference actual scores and moments
- Constructive — every weakness should come with advice
- Concise — keep answers under 150 words unless the question requires more
- Encouraging but realistic

You can discuss: scores, specific questions they struggled with, body language from emotion data, how to improve, and next steps.`;

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
  });

  return result.toTextStreamResponse();
}
