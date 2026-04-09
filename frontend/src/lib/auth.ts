import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = dbUser?.role ?? "STUDENT";
      }
      return session;
    },

    async signIn({ user, account, profile }) {
      // Only handle LinkedIn — GitHub login is the primary auth flow
      if (account?.provider !== "linkedin") return true;

      try {
        // Find or create the student profile for this user
        const studentProfile = await prisma.studentProfile.findUnique({
          where: { userId: user.id! },
          select: { id: true },
        });

        if (!studentProfile) {
          // No profile yet — LinkedIn connected before onboarding, skip for now
          // The profile page connect flow will handle this case
          return true;
        }

        // Fetch enriched LinkedIn data with the access token (headline + vanity name)
        const linkedinData = await _fetchLinkedInEnrichedProfile(
          account.access_token as string,
          profile as Record<string, unknown>,
        );

        // Upsert LINKEDIN platform connection
        await prisma.platformConnection.upsert({
          where: {
            studentProfileId_platform: {
              studentProfileId: studentProfile.id,
              platform: "LINKEDIN",
            },
          },
          create: {
            studentProfileId: studentProfile.id,
            platform: "LINKEDIN",
            syncStatus: "PENDING",
          },
          update: { syncStatus: "PENDING", errorMessage: null },
        });

        // Update LinkedIn URL on profile if we have a vanity name
        if (linkedinData.vanityName) {
          await prisma.studentProfile.update({
            where: { id: studentProfile.id },
            data: { linkedinUrl: `https://www.linkedin.com/in/${linkedinData.vanityName}` },
          });
        }

        // Fire ingestion in background (don't await — don't block sign-in)
        _triggerLinkedInIngestion(studentProfile.id, linkedinData).catch((err) => {
          console.error("[auth/linkedin] Ingestion trigger failed:", err?.message);
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[auth/linkedin] signIn callback error:", message);
        // Don't return false — let the sign-in succeed even if ingestion fails
      }

      return true;
    },
  },
});


// ── Helpers ──────────────────────────────────────────────────────────────────

interface LinkedInEnrichedProfile {
  sub: string;
  name: string;
  email: string | null;
  picture: string | null;
  headline: string | null;
  vanityName: string | null;
  profileUrl: string | null;
  /** raw r/v2/me response (may be null if API call failed) */
  v2Me: Record<string, unknown> | null;
}

async function _fetchLinkedInEnrichedProfile(
  accessToken: string,
  oidcProfile: Record<string, unknown>,
): Promise<LinkedInEnrichedProfile> {
  const base: LinkedInEnrichedProfile = {
    sub: oidcProfile.sub as string,
    name: oidcProfile.name as string,
    email: (oidcProfile.email as string) ?? null,
    picture: (oidcProfile.picture as string) ?? null,
    headline: null,
    vanityName: null,
    profileUrl: null,
    v2Me: null,
  };

  // LinkedIn v2 REST API — get headline and vanity name
  // This requires r_liteprofile scope. With OIDC only, this may return 403.
  try {
    const res = await fetch(
      "https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,localizedHeadline,vanityName)",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": "202310",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (res.ok) {
      const v2 = (await res.json()) as Record<string, unknown>;
      base.v2Me = v2;
      base.headline = (v2.localizedHeadline as string) ?? null;
      base.vanityName = (v2.vanityName as string) ?? null;
      if (base.vanityName) {
        base.profileUrl = `https://www.linkedin.com/in/${base.vanityName}`;
      }
    } else {
      console.warn(`[auth/linkedin] /v2/me returned ${res.status} — using OIDC profile only`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[auth/linkedin] /v2/me fetch failed:", message);
  }

  return base;
}

async function _triggerLinkedInIngestion(
  studentProfileId: string,
  linkedinData: LinkedInEnrichedProfile,
): Promise<void> {
  const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
  const AI_SECRET = process.env.AI_SERVICE_SECRET ?? "";

  const res = await fetch(`${AI_URL}/ingest/linkedin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": AI_SECRET,
    },
    body: JSON.stringify({
      student_profile_id: studentProfileId,
      oauth_data: linkedinData,
      // Pass the profile URL for supplemental scraping if available
      linkedin_url: linkedinData.profileUrl ?? null,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI service /ingest/linkedin returned ${res.status}: ${text}`);
  }
}
