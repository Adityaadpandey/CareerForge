import { NextRequest } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const { messages } = (await req.json()) as { messages: {role: "user" | "assistant", content: string}[] };

  if (!messages || messages.length === 0) {
    return new Response("No messages provided", { status: 400 });
  }

  // Fetch the mission and the user's profile with their gap analysis
  const mission = await prisma.mission.findUnique({
    where: { id },
    include: {
      studentProfile: {
        include: {
          readinessScores: {
             orderBy: { createdAt: 'desc' },
             take: 1
          }
        }
      }
    }
  });

  if (!mission) {
    return new Response("Mission not found", { status: 404 });
  }

  // Only allow if the mission belongs to the user
  if (mission.studentProfile.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const profile = mission.studentProfile;
  const latestScore = profile.readinessScores?.[0];
  const gapAnalysisString = latestScore?.gapAnalysis
     ? JSON.stringify(latestScore.gapAnalysis)
     : "No specific gap analysis available.";

  const systemMessage = `
You are an elite Staff Engineer acting as a personal technical mentor for a developer.
The developer's current goal is to complete the following assigned Mission:

=== MISSION DETAILS ===
Title: ${mission.title}
Type: ${mission.type}
Description:
${mission.description}
=======================

You have access to their latest technical profile to personalize your advice:
Target Role: ${profile.targetRole || "Unknown"}
Department: ${profile.department || "Unknown"}
Known Skill Gaps / Weaknesses:
${gapAnalysisString}

YOUR INSTRUCTIONS:
1. You are here to mentor them to successfully complete this specific mission.
2. If they ask how to start, guide them based on their known skill gaps. Provide hints, architectures, or step-by-step logic.
3. NEVER write the complete final code for the mission for them. You want them to learn. 
4. Provide highly specific code snippets to explain concepts or unblock them, but leave the integration to them.
5. Be encouraging but professional (like a senior engineer). 
6. Keep your answers concise, structured, and use Markdown for code blocks.
`;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: systemMessage,
    messages,
  });

  return result.toTextStreamResponse();
}
