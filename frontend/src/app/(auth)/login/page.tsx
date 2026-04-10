"use client";

import { motion, useReducedMotion } from "framer-motion";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  ArrowRight,
  Brain,
  BriefcaseBusiness,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.1-4.8 9.1-7.2 0-.5-.1-.9-.1-1.3H12Z"
      />
      <path
        fill="#34A853"
        d="M2.4 7.8 5.6 10.1C6.4 8 9 6 12 6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 8.3 2.4 5.1 4.5 3.5 7.6Z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.6c2.6 0 4.8-.9 6.4-2.4l-3-2.4c-.8.6-1.9 1.1-3.4 1.1-3.9 0-5.2-2.6-5.5-3.9l-3.1 2.4c1.6 3.2 4.9 5.2 8.6 5.2Z"
      />
      <path
        fill="#4285F4"
        d="M21.1 13.1c.1-.4.1-.8.1-1.3s0-.9-.1-1.3H12v3.9h5.5c-.3 1.4-1.3 2.4-2.1 3l3 2.4c1.7-1.5 2.7-3.8 2.7-6.7Z"
      />
    </svg>
  );
}

const signalCards = [
  {
    icon: Brain,
    title: "Skill signal",
    description: "Understand where your profile is already strong.",
  },
  {
    icon: GitBranch,
    title: "Focused roadmap",
    description: "See what to improve next without noise.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Job momentum",
    description: "Turn analysis into better applications faster.",
  },
];

export default function LoginPage() {
  const [githubLoading, setGithubLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
      };

  const handleGithubSignIn = async () => {
    setGithubLoading(true);
    await signIn("github", { callbackUrl: "/dashboard" });
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <main className="relative flex h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-3 text-white sm:px-6 sm:py-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_30%),radial-gradient(circle_at_80%_20%,_rgba(249,115,22,0.12),_transparent_24%),linear-gradient(135deg,_#050505_0%,_#0a0a0a_45%,_#121212_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(circle at center, black, transparent 85%)",
        }}
      />
      <div className="absolute left-[10%] top-[12%] h-56 w-56 rounded-full bg-orange-500/15 blur-[120px]" />
      <div className="absolute right-[4%] top-[18%] h-64 w-64 rounded-full bg-orange-400/10 blur-[140px]" />

      <motion.section
        {...fadeUp}
        className="relative grid h-full max-h-[min(760px,calc(100vh-1.5rem))] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.95),rgba(8,8,8,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.6)] lg:grid-cols-[1.05fr_0.95fr]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent" />

        <div className="flex flex-col justify-between border-b border-white/8 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div>
            <BrandLogo subtitle="Career intelligence for driven students" />

            <div className="mt-7 max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.24em] text-orange-300">
                <Sparkles className="h-3.5 w-3.5" />
                Personalized placement engine
              </div>

              <h1 className="text-4xl font-light leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.4rem]">
                Sign in to a
                <span className="block text-zinc-500">cleaner career system.</span>
              </h1>

              <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-400 sm:text-base">
                Connect your account, analyze your profile, and move from scattered
                effort to a more targeted roadmap.
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              {signalCards.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-orange-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex items-center p-5 sm:p-6 lg:p-8">
          <div className="absolute right-0 top-0 h-44 w-44 translate-x-1/4 -translate-y-1/4 rounded-full bg-orange-500/12 blur-3xl" />

          <div className="relative w-full rounded-[1.75rem] border border-white/10 bg-black/25 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6 lg:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Welcome back</p>
                <h2 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-[2.15rem]">
                  Continue your
                  <span className="block text-orange-400">career setup.</span>
                </h2>
                <p className="mt-3 max-w-md text-sm leading-5 text-zinc-400">
                  Use GitHub or Google to continue your setup securely.
                </p>
              </div>

              <div className="hidden rounded-2xl border border-white/10 bg-white/5 p-3 text-zinc-300 sm:block">
                <ShieldCheck className="h-5 w-5 text-orange-400" />
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/8 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Primary</p>
                    <p className="mt-1 text-sm text-white">Continue with GitHub</p>
                  </div>
                  <div className="rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-orange-300">
                    Live
                  </div>
                </div>

                <button
                  onClick={handleGithubSignIn}
                  disabled={githubLoading || googleLoading}
                  className="group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-black transition-all duration-200 hover:bg-orange-400 hover:shadow-[0_12px_40px_rgba(249,115,22,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.24)_50%,transparent_80%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  {githubLoading ? (
                    <div className="h-5 w-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  ) : (
                    <GithubIcon className="h-5 w-5" />
                  )}
                  <span>{githubLoading ? "Connecting to GitHub..." : "Continue with GitHub"}</span>
                  {!githubLoading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Secondary</p>
                    <p className="mt-1 text-sm text-white">Continue with Google</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                    Live
                  </div>
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  disabled={githubLoading || googleLoading}
                  className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-zinc-950 text-sm font-semibold text-white transition-all duration-200 hover:border-zinc-600 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {googleLoading ? (
                    <div className="h-5 w-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                  ) : (
                    <GoogleIcon className="h-5 w-5" />
                  )}
                  <span>{googleLoading ? "Connecting to Google..." : "Continue with Google"}</span>
                </button>
              </div>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-800 to-zinc-800" />
              <span className="text-[11px] font-mono uppercase tracking-[0.24em] text-zinc-600">
                Secure Access
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-zinc-800 to-zinc-800" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Analysis", value: "Personalized" },
                { label: "Roadmap", value: "Adaptive" },
                { label: "Applications", value: "Guided" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
                  <p className="mt-2 text-sm text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-700">
              HackAI 2025 · Built with LangGraph + Next.js
            </p>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
