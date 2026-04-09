import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import LinkedIn from "next-auth/providers/linkedin";

// Edge-compatible config — NO Prisma/Node.js imports here
export const authConfig: NextAuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
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
      allowDangerousEmailAccountLinking: true,
    }),
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
