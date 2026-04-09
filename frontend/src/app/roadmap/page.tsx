import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { RoadmapClient } from "./roadmap-client";

export default async function RoadmapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) redirect("/onboarding");

  const missions = await prisma.mission.findMany({
    where: { studentProfileId: profile.id },
    orderBy: { orderIndex: "asc" },
  });

  return <RoadmapClient missions={missions.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    type: m.type,
    status: m.status,
    estimatedHours: m.estimatedHours,
    orderIndex: m.orderIndex,
    prerequisiteIds: m.prerequisiteIds,
    deadline: m.deadline?.toISOString() ?? null,
    resources: m.resources as { title: string; url: string; type: string }[],
  }))} />;
}
