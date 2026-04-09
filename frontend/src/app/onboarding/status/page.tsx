"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

type Status = {
  status: "no_profile" | "syncing" | "partial" | "complete";
  onboardingDone: boolean;
  connections: Array<{ platform: string; syncStatus: string }>;
};

const PLATFORM_LABELS: Record<string, string> = {
  GITHUB: "GitHub",
  LEETCODE: "LeetCode",
  CODEFORCES: "Codeforces",
  LINKEDIN: "LinkedIn",
  RESUME: "Resume",
};

export default function OnboardingStatusPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [dots, setDots] = useState(".");

  // Animate dots
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
    return () => clearInterval(t);
  }, []);

  // Poll every 3 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await axios.get<Status>("/api/onboarding/status");
        setStatus(res.data);
        if (res.data.status === "complete" || res.data.status === "partial") {
          // Wait a beat then go to dashboard
          setTimeout(() => router.push("/dashboard"), 1500);
        }
      } catch {
        // retry
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [router]);

  const connections = status?.connections ?? [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        {/* Animated logo */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="w-8 h-8 bg-amber-500 rounded-sm flex items-center justify-center">
            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="font-mono text-sm tracking-widest text-amber-500 uppercase">CareerForge</span>
        </div>

        <h1 className="text-2xl text-white font-light mb-2">
          Analyzing your profile{dots}
        </h1>
        <p className="text-zinc-500 text-sm mb-10">
          We&apos;re fetching your data and running the gap analysis. This takes about 30 seconds.
        </p>

        {/* Platform statuses */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 space-y-3 mb-6">
          {connections.length === 0 ? (
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin shrink-0" />
              <span className="text-sm text-zinc-400">Connecting to platforms{dots}</span>
            </div>
          ) : (
            connections.map((c) => (
              <div key={c.platform} className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">{PLATFORM_LABELS[c.platform] ?? c.platform}</span>
                <div className="flex items-center gap-2">
                  {c.syncStatus === "DONE" && (
                    <span className="text-xs text-green-400 font-mono">✓ done</span>
                  )}
                  {c.syncStatus === "SYNCING" && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 border border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      <span className="text-xs text-amber-400 font-mono">syncing</span>
                    </div>
                  )}
                  {c.syncStatus === "PENDING" && (
                    <span className="text-xs text-zinc-600 font-mono">pending</span>
                  )}
                  {c.syncStatus === "FAILED" && (
                    <span className="text-xs text-red-400 font-mono">⚠ failed</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {(status?.status === "complete" || status?.status === "partial") && (
          <div className="flex items-center justify-center gap-2 text-green-400 text-sm animate-pulse">
            <span>✓</span>
            <span>Analysis complete — redirecting to dashboard</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-6 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-1000"
            style={{
              width:
                status?.status === "complete" || status?.status === "partial"
                  ? "100%"
                  : status?.status === "syncing"
                  ? "60%"
                  : "20%",
            }}
          />
        </div>
      </div>
    </div>
  );
}
