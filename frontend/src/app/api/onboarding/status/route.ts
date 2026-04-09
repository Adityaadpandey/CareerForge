import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      platformConnections: { select: { platform: true, syncStatus: true, errorMessage: true } },
    },
  });

  if (!profile) {
    return NextResponse.json({ status: "no_profile" });
  }

  const allDone = profile.platformConnections.every(
    (c) => c.syncStatus === "DONE" || c.syncStatus === "FAILED"
  );
  const anyFailed = profile.platformConnections.some((c) => c.syncStatus === "FAILED");

  return NextResponse.json({
    status: allDone ? (anyFailed ? "partial" : "complete") : "syncing",
    onboardingDone: profile.onboardingDone,
    connections: profile.platformConnections,
  });
}
