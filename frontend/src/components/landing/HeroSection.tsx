"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Transition } from "framer-motion";
import { ArrowRight, TrendingUp, Zap } from "lucide-react";

/* ─── Rotating word ───────────────────────────────────────────────────── */
const WORDS = ["placement-ready", "interview-ready", "internship-ready", "career-ready"];

function RotatingWord() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((p) => (p + 1) % WORDS.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    /* Invisible spacer sized to the longest word keeps the line height stable */
    <span className="relative inline-block" aria-live="polite">
      {/* Widest word as invisible spacer so layout never reflows */}
      <span className="invisible whitespace-nowrap font-medium" aria-hidden>
        placement-ready
      </span>

      {/* Actual animated word — absolutely positioned over the spacer */}
      <AnimatePresence mode="wait">
        <motion.span
          key={WORDS[idx]}
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -18, filter: "blur(8px)" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex items-center whitespace-nowrap font-medium bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent"
        >
          {WORDS[idx]}

          {/* Animated underline that redraws on each word change */}
          <motion.span
            className="absolute bottom-0 left-0 h-[2px] rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ─── Animated score ring ─────────────────────────────────────────────── */
function ScoreRing({ score = 73 }: { score?: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div className="relative flex items-center justify-center w-[130px] h-[130px]">
      <svg width="130" height="130" viewBox="0 0 130 130" className="absolute inset-0">
        {/* Track */}
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(245,158,11,0.08)" strokeWidth="7" />
        {/* Glow layer */}
        <motion.circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke="rgba(245,158,11,0.15)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          transform="rotate(-90 65 65)"
        />
        {/* Main progress */}
        <motion.circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          transform="rotate(-90 65 65)"
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex flex-col items-center z-10">
        <motion.span
          className="text-3xl font-light text-white tabular-nums leading-none"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, duration: 0.4 }}
        >
          {score}
        </motion.span>
        <span className="text-[9px] text-zinc-500 font-mono tracking-widest mt-1">/ 100</span>
      </div>
    </div>
  );
}

/* ─── Skill bar ───────────────────────────────────────────────────────── */
function SkillBar({ name, value, delay }: { name: string; value: number; delay: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-zinc-400 font-mono">{name}</span>
        <span className="text-[11px] text-amber-400/80 font-mono tabular-nums">{value}%</span>
      </div>
      <div className="h-[3px] rounded-full bg-zinc-800/80 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.4, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

/* ─── Dashboard mockup ────────────────────────────────────────────────── */
function DashboardMockup() {
  const skills = [
    { name: "DSA", value: 68, delay: 1.0 },
    { name: "Development", value: 81, delay: 1.1 },
    { name: "Communication", value: 54, delay: 1.2 },
    { name: "Consistency", value: 76, delay: 1.3 },
  ];

  return (
    <div className="relative" style={{ perspective: "1200px" }}>
      {/* Atmospheric glow */}
      <div className="absolute -inset-12 bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -inset-6 bg-orange-500/[0.06] rounded-2xl blur-2xl pointer-events-none" />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Glass border */}
        <div className="absolute inset-0 rounded-2xl border border-white/[0.07] pointer-events-none z-10" />
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent z-10" />

        {/* Card body */}
        <div className="bg-[#0b0b0b]/95 backdrop-blur-xl">
          {/* Header bar */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-zinc-800/40">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 tracking-wider ml-1">CAREERFORGE · DASHBOARD</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-mono text-emerald-400 tracking-wider">LIVE</span>
            </div>
          </div>

          {/* Profile row */}
          <div className="px-5 pt-4 pb-0 flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-[#0b0b0b] bg-zinc-800 flex items-center justify-center shadow-lg">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-[#0b0b0b] bg-amber-500/20 flex items-center justify-center">
                <span className="text-[9px] font-bold text-amber-400">LC</span>
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-[#0b0b0b] bg-blue-500/20 flex items-center justify-center">
                <span className="text-[9px] font-bold text-blue-400">in</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-zinc-300 font-medium">Arjun Sharma</p>
              <p className="text-[10px] text-zinc-600 font-mono">3 profiles synced · updated 2m ago</p>
            </div>
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.4 }}
              className="text-[9px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full"
            >
              Rising Star
            </motion.span>
          </div>

          {/* Score + section label */}
          <div className="px-5 pt-4 pb-1 flex items-center gap-2">
            <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Readiness Score</div>
          </div>

          {/* Score ring center */}
          <div className="flex justify-center pb-2">
            <ScoreRing score={73} />
          </div>

          {/* Skill bars */}
          <div className="px-5 pb-4 space-y-3">
            {skills.map((s) => (
              <SkillBar key={s.name} name={s.name} value={s.value} delay={s.delay} />
            ))}
          </div>

          {/* Next mission */}
          <div className="mx-4 mb-4 rounded-xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] to-orange-500/[0.03] p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-[9px] font-mono text-amber-400/80 uppercase tracking-widest">Next Mission</span>
            </div>
            <p className="text-xs text-zinc-200 font-medium leading-snug">Binary Trees: LCA & Traversals</p>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-zinc-600 font-mono">LeetCode Medium · 3 problems</p>
              <span className="text-[9px] text-amber-500/70 font-mono">DSA pillar</span>
            </div>
          </div>

          {/* Bottom line */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        </div>
      </motion.div>

      {/* Floating +12pts badge */}
      <motion.div
        initial={{ opacity: 0, x: 24, y: 8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.8, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -right-4 top-[38%] rounded-xl border border-emerald-500/20 bg-[#0e0e0e]/95 backdrop-blur-xl px-3 py-2.5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[11px] text-white font-medium leading-tight">+12 pts this week</p>
            <p className="text-[9px] text-zinc-500 font-mono">Consistency ↑</p>
          </div>
        </div>
      </motion.div>

      {/* Floating job match badge */}
      <motion.div
        initial={{ opacity: 0, x: -24, y: 8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -left-4 bottom-[22%] rounded-xl border border-blue-500/15 bg-[#0e0e0e]/95 backdrop-blur-xl px-3 py-2.5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-blue-400">94</span>
          </div>
          <div>
            <p className="text-[11px] text-white font-medium leading-tight">Google SWE match</p>
            <p className="text-[9px] text-zinc-500 font-mono">94% fit score</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main hero ───────────────────────────────────────────────────────── */
function fadeUpProps(delay: number) {
  const transition: Transition = { duration: 0.7, delay, ease: "easeOut" };
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition,
  };
}

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden px-6 pt-28 pb-16 lg:px-14">
      {/* Subtle noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "128px" }}
      />

      <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-10 items-center">
        {/* ── Left: copy ── */}
        <div className="flex flex-col items-start">
          {/* Badge */}
          <motion.div
            {...fadeUpProps(0.1)}
            className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-amber-500/[0.04] px-4 py-2 text-xs font-mono text-amber-300 shadow-[0_8px_30px_rgba(245,158,11,0.08)] backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
            AI-Powered Career Intelligence
          </motion.div>

          {/* Headline */}
          <motion.h1
            {...fadeUpProps(0.2)}
            className="mb-6 text-5xl sm:text-6xl lg:text-[4.2rem] xl:text-[4.8rem] font-light leading-[0.95] tracking-[-0.05em] text-white"
          >
            Build a profile
            <br />
            <span
              className="font-serif italic bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent"
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            >
              they remember.
            </span>
          </motion.h1>

          {/* Rotating word row */}
          <motion.div
            {...fadeUpProps(0.3)}
            className="mb-6 flex items-center gap-2 text-lg sm:text-xl"
          >
            <span className="whitespace-nowrap font-light text-zinc-500">Show up</span>
            <RotatingWord />
          </motion.div>

          {/* Subtitle */}
          <motion.p
            {...fadeUpProps(0.4)}
            className="mb-10 max-w-lg text-base leading-relaxed text-zinc-500 lg:text-lg"
          >
            CareerForge analyzes your GitHub, LeetCode, and resume to find gaps,
            generate a personalized roadmap, and coach you through mock interviews —
            all autonomously.
          </motion.p>

          {/* CTAs */}
          <motion.div
            {...fadeUpProps(0.5)}
            className="flex flex-wrap items-center gap-3 mb-12"
          >
            <Link href="/login">
              <motion.div
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-7 py-3.5 text-sm font-medium text-black shadow-[0_20px_60px_rgba(245,158,11,0.25)] flex items-center gap-2"
                whileHover={{ scale: 1.04, boxShadow: "0 24px 70px rgba(245,158,11,0.35)" }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10">Start for free</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </motion.div>
            </Link>
            <Link href="/login">
              <motion.div
                className="group rounded-2xl border border-zinc-800 bg-white/[0.02] px-7 py-3.5 text-sm font-medium text-zinc-400 transition-all duration-300 hover:border-zinc-700 hover:text-zinc-200 hover:bg-white/[0.04]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                View dashboard →
              </motion.div>
            </Link>
          </motion.div>

          {/* Trust signals */}
          <motion.div
            {...fadeUpProps(0.65)}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-600 font-mono"
          >
            {["Free for students", "No credit card", "Setup in 60 seconds", "GitHub sign-in"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-500/50" />
                {t}
              </span>
            ))}
          </motion.div>
        </div>

        {/* ── Right: dashboard mockup ── */}
        <motion.div
          {...fadeUpProps(0.2)}
          className="flex justify-center lg:justify-end"
        >
          <div className="w-full max-w-[340px] sm:max-w-[380px]">
            <DashboardMockup />
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2 text-zinc-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
      >
        <motion.div
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-1.5"
        >
          <span className="text-[10px] font-mono tracking-widest">SCROLL</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}
