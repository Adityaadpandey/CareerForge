import { NextResponse } from "next/server";

/**
 * GET /api/profile/linkedin/status
 * Returns whether LinkedIn OAuth is configured so the UI can pick the right connect mode.
 */
export async function GET() {
  const configured =
    !!(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET);
  return NextResponse.json({ configured });
}
