import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import LinkedIn from "next-auth/providers/linkedin";

// Edge-compatible config — NO Prisma/Node.js imports here
export const authConfig: NextAuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      issuer: "https://github.com/login/oauth",
      allowDangerousEmailAccountLinking: true,
      // Store login (username) as name so session.user.name = "adityaadpandey", not "Aditya Pandey"
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.login,          // GitHub login/username
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
    LinkedIn({
      clientId: process.env.AUTH_LINKEDIN_ID!,
      clientSecret: process.env.AUTH_LINKEDIN_SECRET!,
      type: "oauth",
      issuer: "https://www.linkedin.com",
      checks: ["state"],
      client: { token_endpoint_auth_method: "client_secret_post" },
      authorization: {
        url: "https://www.linkedin.com/oauth/v2/authorization",
        params: { scope: "r_liteprofile r_emailaddress" },
      },
      token: "https://www.linkedin.com/oauth/v2/accessToken",
      userinfo: {
        async request({ tokens }: { tokens: { access_token?: string } }) {
          const headers = { Authorization: `Bearer ${tokens.access_token}` };
          const [meRes, emailRes] = await Promise.all([
            fetch(
              "https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))",
              { headers },
            ),
            fetch(
              "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
              { headers },
            ),
          ]);

          const me = meRes.ok ? (await meRes.json()) as Record<string, unknown> : {};
          const emailJson = emailRes.ok ? (await emailRes.json()) as { elements?: Array<{ "handle~"?: { emailAddress?: string } }> } : {};

          const first = (me.localizedFirstName as string | undefined) ?? "";
          const last = (me.localizedLastName as string | undefined) ?? "";
          const display = [first, last].filter(Boolean).join(" ").trim();
          const image =
            (me.profilePicture as { "displayImage~"?: { elements?: Array<{ identifiers?: Array<{ identifier?: string }> }> } } | undefined)
              ?.["displayImage~"]
              ?.elements?.at(-1)
              ?.identifiers?.[0]
              ?.identifier;
          const email = emailJson.elements?.[0]?.["handle~"]?.emailAddress;

          return {
            id: (me.id as string) ?? crypto.randomUUID(),
            name: display || undefined,
            email,
            image,
          };
        },
      },
      allowDangerousEmailAccountLinking: true,
    } as any),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/login");
      const isOnboarding = nextUrl.pathname.startsWith("/onboarding");
      const isApi = nextUrl.pathname.startsWith("/api");
      const isPublic = nextUrl.pathname === "/";

      if (isApi || isPublic) return true;
      if (isLoggedIn && isAuthPage) return Response.redirect(new URL("/dashboard", nextUrl));
      if (!isLoggedIn && !isAuthPage) return false; // redirects to pages.signIn
      return true;
    },
  },
};
