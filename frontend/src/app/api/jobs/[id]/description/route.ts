import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { applyUrl: true, requirementsText: true },
  });
  if (!job)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const pageRes = await fetch(job.applyUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await pageRes.text();

    const aiRes = await aiClient.post("/jobs/describe", { html, job_id: jobId });
    return NextResponse.json({ description: aiRes.data.description, fallback: false });
  } catch {
    return NextResponse.json({ description: job.requirementsText, fallback: true });
  }
}
