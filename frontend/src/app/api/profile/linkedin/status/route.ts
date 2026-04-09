import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/profile/linkedin/status
 * Returns whether LinkedIn OAuth is configured + whether the current user has it linked.
 */
export async function GET() {
  const configured = !!(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET);

  if (!configured) {
    return NextResponse.json({ configured: false, linked: false });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ configured, linked: false });
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "linkedin" },
    select: { id: true },
  });

  return NextResponse.json({ configured, linked: !!account });
}
