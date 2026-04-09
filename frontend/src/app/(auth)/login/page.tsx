"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Zap, Target, TrendingUp, Brain } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("github", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex overflow-hidden">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative">
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Glow blob */}
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded-sm flex items-center justify-center">
              <Zap className="w-4 h-4 text-black" fill="black" />
            </div>
            <span className="font-mono text-sm tracking-[0.2em] text-amber-500 uppercase">
              CareerForge
            </span>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <p className="font-mono text-xs tracking-widest text-amber-500/60 uppercase">
              AI-Powered Career Intelligence
            </p>
            <h1 className="text-5xl font-light text-white leading-[1.1] tracking-tight">
              Forge your path
              <br />
              <span className="text-amber-400">to placement.</span>
            </h1>
          </div>
          <p className="text-zinc-500 text-base leading-relaxed max-w-sm">
            Ingest your GitHub, LeetCode, and resume. Get a gap analysis, adaptive
            roadmap, and autonomous job matching — all in one agentic loop.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {[
              { icon: Brain, label: "Gap Analysis" },
              { icon: Target, label: "Mission Roadmap" },
              { icon: TrendingUp, label: "Job Matching" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 text-xs font-mono"
              >
                <Icon className="w-3 h-3 text-amber-500" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-6 border-t border-zinc-800/60 pt-8">
          {[
            { value: "5", label: "Agent Loops" },
            { value: "3", label: "Platforms Synced" },
            { value: "100%", label: "Placement Focus" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="font-mono text-2xl text-amber-400 font-light">{value}</p>
              <p className="text-xs text-zinc-600 mt-0.5 font-mono tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - sign in */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Subtle border left */}
        <div className="hidden lg:block absolute left-0 top-16 bottom-16 w-px bg-gradient-to-b from-transparent via-zinc-800 to-transparent" />

        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-amber-500 rounded-sm flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-black" fill="black" />
            </div>
            <span className="font-mono text-sm tracking-widest text-amber-500 uppercase">
              CareerForge
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl text-white font-light tracking-tight">
              Get started
            </h2>
            <p className="text-zinc-500 text-sm">
              Sign in with GitHub to begin your career analysis.
            </p>
          </div>

          {/* Sign in button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full group relative flex items-center justify-center gap-3 h-12 bg-white hover:bg-zinc-100 text-black font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <GithubIcon className="w-4 h-4" />
            )}
            <span className="text-sm">
              {loading ? "Connecting..." : "Continue with GitHub"}
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600 font-mono">SECURE</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Info points */}
          <div className="space-y-3">
            {[
              "We only read public GitHub data",
              "Resume data stays encrypted",
              "You control what gets applied to",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-xs text-zinc-500">{item}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-xs text-zinc-700 font-mono text-center">
            HackAI 2025 · Built with LangGraph + Next.js
          </p>
        </div>
      </div>
    </div>
  );
}
